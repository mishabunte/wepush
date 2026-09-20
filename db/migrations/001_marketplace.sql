CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'marketplace_web') THEN
    CREATE ROLE marketplace_web NOLOGIN;
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'marketplace_worker') THEN
    CREATE ROLE marketplace_worker NOLOGIN;
  END IF;
END
$roles$;

CREATE SCHEMA marketplace;
CREATE SCHEMA api;

REVOKE ALL ON SCHEMA marketplace FROM PUBLIC;
REVOKE ALL ON SCHEMA api FROM PUBLIC;

CREATE TYPE marketplace.asset_kind AS ENUM ('fiat', 'crypto');
CREATE TYPE marketplace.campaign_status AS ENUM ('open', 'closed');
CREATE TYPE marketplace.bid_status AS ENUM ('pending', 'won', 'lost');

CREATE FUNCTION marketplace.generate_public_id(p_prefix text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, marketplace
AS $function$
BEGIN
  IF p_prefix !~ '^[a-z]{2,4}$' THEN
    RAISE EXCEPTION 'invalid public ID prefix: %', p_prefix
      USING ERRCODE = '22023';
  END IF;

  RETURN p_prefix || '_' || translate(
    encode(public.gen_random_bytes(12), 'base64'),
    '+/',
    '-_'
  );
END
$function$;

CREATE TABLE marketplace.assets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text COLLATE "C" NOT NULL,
  display_symbol text NOT NULL,
  kind marketplace.asset_kind NOT NULL,
  network text COLLATE "C",
  contract_address text COLLATE "C",
  decimal_places smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT assets_code_format CHECK (code ~ '^[A-Z][A-Z0-9_-]{1,15}$'),
  CONSTRAINT assets_display_symbol_present CHECK (btrim(display_symbol) <> ''),
  CONSTRAINT assets_decimal_places_range CHECK (decimal_places BETWEEN 0 AND 18),
  CONSTRAINT assets_contract_requires_network CHECK (
    contract_address IS NULL OR network IS NOT NULL
  ),
  CONSTRAINT assets_identity_unique UNIQUE NULLS NOT DISTINCT (
    code,
    network,
    contract_address
  )
);

CREATE TABLE marketplace.creators (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id text COLLATE "C" NOT NULL
    DEFAULT marketplace.generate_public_id('cr'),
  display_name text NOT NULL,
  genre text COLLATE "C" NOT NULL,
  follower_count bigint NOT NULL,
  engagement_rate numeric(7,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT creators_public_id_unique UNIQUE (public_id),
  CONSTRAINT creators_public_id_format CHECK (
    public_id ~ '^cr_[A-Za-z0-9_-]{16}$'
  ),
  CONSTRAINT creators_display_name_present CHECK (btrim(display_name) <> ''),
  CONSTRAINT creators_genre_format CHECK (genre ~ '^[a-z][a-z0-9-]{1,31}$'),
  CONSTRAINT creators_follower_count_nonnegative CHECK (follower_count >= 0),
  CONSTRAINT creators_engagement_rate_range CHECK (
    engagement_rate BETWEEN 0 AND 100
  )
);

CREATE TABLE marketplace.campaigns (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id text COLLATE "C" NOT NULL
    DEFAULT marketplace.generate_public_id('cmp'),
  title text NOT NULL,
  description text NOT NULL,
  target_genre text COLLATE "C" NOT NULL,
  minimum_followers bigint NOT NULL,
  target_engagement_rate numeric(7,4) NOT NULL,
  asset_id bigint NOT NULL REFERENCES marketplace.assets(id),
  budget numeric(38,18) NOT NULL,
  bidding_deadline timestamptz NOT NULL,
  status marketplace.campaign_status NOT NULL DEFAULT 'open',
  closed_at timestamptz,
  selection_rule_version smallint,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT campaigns_public_id_unique UNIQUE (public_id),
  CONSTRAINT campaigns_public_id_format CHECK (
    public_id ~ '^cmp_[A-Za-z0-9_-]{16}$'
  ),
  CONSTRAINT campaigns_title_present CHECK (btrim(title) <> ''),
  CONSTRAINT campaigns_description_present CHECK (btrim(description) <> ''),
  CONSTRAINT campaigns_target_genre_format CHECK (
    target_genre ~ '^[a-z][a-z0-9-]{1,31}$'
  ),
  CONSTRAINT campaigns_minimum_followers_nonnegative CHECK (
    minimum_followers >= 0
  ),
  CONSTRAINT campaigns_target_engagement_rate_range CHECK (
    target_engagement_rate BETWEEN 0 AND 100
  ),
  CONSTRAINT campaigns_budget_positive CHECK (budget > 0),
  CONSTRAINT campaigns_closure_consistent CHECK (
    (status = 'open' AND closed_at IS NULL AND selection_rule_version IS NULL)
    OR
    (status = 'closed' AND closed_at IS NOT NULL AND selection_rule_version IS NOT NULL)
  )
);

CREATE TABLE marketplace.bids (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id text COLLATE "C" NOT NULL
    DEFAULT marketplace.generate_public_id('bid'),
  campaign_id bigint NOT NULL REFERENCES marketplace.campaigns(id),
  creator_id bigint NOT NULL REFERENCES marketplace.creators(id),
  amount numeric(38,18) NOT NULL,
  fit_score numeric(5,2) NOT NULL,
  fit_breakdown jsonb NOT NULL,
  selection_score numeric(7,4),
  selection_rank integer,
  status marketplace.bid_status NOT NULL DEFAULT 'pending',
  submitted_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  finalized_at timestamptz,
  CONSTRAINT bids_public_id_unique UNIQUE (public_id),
  CONSTRAINT bids_public_id_format CHECK (
    public_id ~ '^bid_[A-Za-z0-9_-]{16}$'
  ),
  CONSTRAINT bids_campaign_creator_unique UNIQUE (campaign_id, creator_id),
  CONSTRAINT bids_amount_positive CHECK (amount > 0),
  CONSTRAINT bids_fit_score_range CHECK (fit_score BETWEEN 0 AND 100),
  CONSTRAINT bids_fit_breakdown_object CHECK (
    jsonb_typeof(fit_breakdown) = 'object'
  ),
  CONSTRAINT bids_selection_score_range CHECK (
    selection_score IS NULL OR selection_score BETWEEN 0 AND 100
  ),
  CONSTRAINT bids_selection_rank_positive CHECK (
    selection_rank IS NULL OR selection_rank > 0
  ),
  CONSTRAINT bids_finalization_consistent CHECK (
    (
      status = 'pending'
      AND finalized_at IS NULL
      AND selection_score IS NULL
      AND selection_rank IS NULL
    )
    OR
    (
      status IN ('won', 'lost')
      AND finalized_at IS NOT NULL
      AND selection_score IS NOT NULL
      AND selection_rank IS NOT NULL
    )
  )
);

CREATE INDEX campaigns_due_open_idx
  ON marketplace.campaigns (bidding_deadline, id)
  WHERE status = 'open';

CREATE INDEX bids_campaign_status_idx
  ON marketplace.bids (campaign_id, status, submitted_at, id);

CREATE INDEX bids_creator_history_idx
  ON marketplace.bids (creator_id, submitted_at DESC, id DESC);

CREATE FUNCTION marketplace.enforce_campaign_budget_precision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, marketplace
AS $function$
DECLARE
  v_asset_code text;
  v_decimal_places smallint;
BEGIN
  SELECT asset.code, asset.decimal_places
  INTO STRICT v_asset_code, v_decimal_places
  FROM marketplace.assets AS asset
  WHERE asset.id = NEW.asset_id;

  IF NEW.budget <> trunc(NEW.budget, v_decimal_places) THEN
    RAISE EXCEPTION 'campaign budget exceeds precision for asset %', v_asset_code
      USING ERRCODE = '22003',
        DETAIL = format('maximum decimal places: %s', v_decimal_places);
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER campaigns_budget_precision
BEFORE INSERT OR UPDATE OF asset_id, budget ON marketplace.campaigns
FOR EACH ROW EXECUTE FUNCTION marketplace.enforce_campaign_budget_precision();

CREATE FUNCTION marketplace.enforce_bid_amount_precision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, marketplace
AS $function$
DECLARE
  v_asset_code text;
  v_decimal_places smallint;
BEGIN
  SELECT asset.code, asset.decimal_places
  INTO STRICT v_asset_code, v_decimal_places
  FROM marketplace.campaigns AS campaign
  JOIN marketplace.assets AS asset ON asset.id = campaign.asset_id
  WHERE campaign.id = NEW.campaign_id;

  IF NEW.amount <> trunc(NEW.amount, v_decimal_places) THEN
    RAISE EXCEPTION 'bid amount exceeds precision for asset %', v_asset_code
      USING ERRCODE = '22003',
        DETAIL = format('maximum decimal places: %s', v_decimal_places);
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER bids_amount_precision
BEFORE INSERT OR UPDATE OF campaign_id, amount ON marketplace.bids
FOR EACH ROW EXECUTE FUNCTION marketplace.enforce_bid_amount_precision();

CREATE FUNCTION marketplace.calculate_fit(
  p_creator_id bigint,
  p_campaign_id bigint
)
RETURNS TABLE (
  eligible boolean,
  fit_score numeric(5,2),
  fit_breakdown jsonb
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, marketplace
AS $function$
  SELECT
    creator.genre = campaign.target_genre
      AND creator.follower_count >= campaign.minimum_followers AS eligible,
    round(
      (
        CASE
          WHEN creator.genre = campaign.target_genre THEN 50::numeric
          ELSE 0::numeric
        END
        + CASE
            WHEN campaign.minimum_followers = 0 THEN 25::numeric
            ELSE least(
              25::numeric,
              25::numeric
                * creator.follower_count::numeric
                / (campaign.minimum_followers::numeric * 2)
            )
          END
        + CASE
            WHEN campaign.target_engagement_rate = 0 THEN 25::numeric
            ELSE least(
              25::numeric,
              25::numeric
                * creator.engagement_rate
                / campaign.target_engagement_rate
            )
          END
      ),
      2
    )::numeric(5,2) AS fit_score,
    jsonb_build_object(
      'version', 1,
      'genre', jsonb_build_object(
        'score', CASE
          WHEN creator.genre = campaign.target_genre THEN 50
          ELSE 0
        END,
        'maximum', 50,
        'matched', creator.genre = campaign.target_genre
      ),
      'followers', jsonb_build_object(
        'score', round(
          CASE
            WHEN campaign.minimum_followers = 0 THEN 25::numeric
            ELSE least(
              25::numeric,
              25::numeric
                * creator.follower_count::numeric
                / (campaign.minimum_followers::numeric * 2)
            )
          END,
          2
        ),
        'maximum', 25,
        'creator', creator.follower_count,
        'minimum', campaign.minimum_followers
      ),
      'engagement', jsonb_build_object(
        'score', round(
          CASE
            WHEN campaign.target_engagement_rate = 0 THEN 25::numeric
            ELSE least(
              25::numeric,
              25::numeric
                * creator.engagement_rate
                / campaign.target_engagement_rate
            )
          END,
          2
        ),
        'maximum', 25,
        'creator', creator.engagement_rate,
        'target', campaign.target_engagement_rate
      )
    ) AS fit_breakdown
  FROM marketplace.creators AS creator
  CROSS JOIN marketplace.campaigns AS campaign
  WHERE creator.id = p_creator_id
    AND campaign.id = p_campaign_id;
$function$;

CREATE FUNCTION api.list_creators()
RETURNS TABLE (
  creator_id text,
  display_name text,
  genre text,
  follower_count bigint,
  engagement_rate numeric(7,4)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, marketplace
AS $function$
  SELECT
    creator.public_id,
    creator.display_name,
    creator.genre,
    creator.follower_count,
    creator.engagement_rate
  FROM marketplace.creators AS creator
  ORDER BY creator.display_name, creator.id;
$function$;

CREATE FUNCTION api.list_campaign_matches(p_creator_public_id text)
RETURNS TABLE (
  campaign_id text,
  title text,
  description text,
  target_genre text,
  minimum_followers bigint,
  target_engagement_rate numeric(7,4),
  budget numeric(38,18),
  asset_code text,
  asset_symbol text,
  asset_decimal_places smallint,
  bidding_deadline timestamptz,
  fit_score numeric(5,2),
  fit_breakdown jsonb,
  bid_id text,
  bid_amount numeric(38,18),
  bid_status marketplace.bid_status
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, marketplace
AS $function$
DECLARE
  v_creator_id bigint;
BEGIN
  SELECT creator.id
  INTO v_creator_id
  FROM marketplace.creators AS creator
  WHERE creator.public_id = p_creator_public_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'creator not found'
      USING ERRCODE = 'P0002', DETAIL = p_creator_public_id;
  END IF;

  RETURN QUERY
  SELECT
    campaign.public_id,
    campaign.title,
    campaign.description,
    campaign.target_genre,
    campaign.minimum_followers,
    campaign.target_engagement_rate,
    campaign.budget,
    asset.code,
    asset.display_symbol,
    asset.decimal_places,
    campaign.bidding_deadline,
    fit.fit_score,
    fit.fit_breakdown,
    bid.public_id,
    bid.amount,
    bid.status
  FROM marketplace.campaigns AS campaign
  JOIN marketplace.assets AS asset ON asset.id = campaign.asset_id
  CROSS JOIN LATERAL marketplace.calculate_fit(
    v_creator_id,
    campaign.id
  ) AS fit
  LEFT JOIN marketplace.bids AS bid
    ON bid.campaign_id = campaign.id
   AND bid.creator_id = v_creator_id
  WHERE campaign.status = 'open'
    AND campaign.bidding_deadline > statement_timestamp()
    AND fit.eligible
  ORDER BY fit.fit_score DESC, campaign.bidding_deadline, campaign.id;
END
$function$;

CREATE FUNCTION api.list_creator_bids(p_creator_public_id text)
RETURNS TABLE (
  bid_id text,
  campaign_id text,
  campaign_title text,
  amount numeric(38,18),
  asset_code text,
  asset_symbol text,
  asset_decimal_places smallint,
  fit_score numeric(5,2),
  fit_breakdown jsonb,
  status marketplace.bid_status,
  submitted_at timestamptz,
  updated_at timestamptz,
  finalized_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, marketplace
AS $function$
DECLARE
  v_creator_id bigint;
BEGIN
  SELECT creator.id
  INTO v_creator_id
  FROM marketplace.creators AS creator
  WHERE creator.public_id = p_creator_public_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'creator not found'
      USING ERRCODE = 'P0002', DETAIL = p_creator_public_id;
  END IF;

  RETURN QUERY
  SELECT
    bid.public_id,
    campaign.public_id,
    campaign.title,
    bid.amount,
    asset.code,
    asset.display_symbol,
    asset.decimal_places,
    bid.fit_score,
    bid.fit_breakdown,
    bid.status,
    bid.submitted_at,
    bid.updated_at,
    bid.finalized_at
  FROM marketplace.bids AS bid
  JOIN marketplace.campaigns AS campaign ON campaign.id = bid.campaign_id
  JOIN marketplace.assets AS asset ON asset.id = campaign.asset_id
  WHERE bid.creator_id = v_creator_id
  ORDER BY bid.submitted_at DESC, bid.id DESC;
END
$function$;

CREATE FUNCTION api.upsert_bid(
  p_creator_public_id text,
  p_campaign_public_id text,
  p_amount numeric
)
RETURNS TABLE (
  bid_id text,
  campaign_id text,
  creator_id text,
  amount numeric(38,18),
  asset_code text,
  fit_score numeric(5,2),
  fit_breakdown jsonb,
  status marketplace.bid_status,
  submitted_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, marketplace
AS $function$
DECLARE
  v_creator marketplace.creators%ROWTYPE;
  v_campaign marketplace.campaigns%ROWTYPE;
  v_asset marketplace.assets%ROWTYPE;
  v_fit record;
  v_bid marketplace.bids%ROWTYPE;
  v_attempt smallint;
BEGIN
  SELECT creator.*
  INTO v_creator
  FROM marketplace.creators AS creator
  WHERE creator.public_id = p_creator_public_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'creator not found'
      USING ERRCODE = 'P0002', DETAIL = p_creator_public_id;
  END IF;

  SELECT campaign.*
  INTO v_campaign
  FROM marketplace.campaigns AS campaign
  WHERE campaign.public_id = p_campaign_public_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign not found'
      USING ERRCODE = 'P0002', DETAIL = p_campaign_public_id;
  END IF;

  SELECT asset.*
  INTO STRICT v_asset
  FROM marketplace.assets AS asset
  WHERE asset.id = v_campaign.asset_id;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'bid amount must be positive'
      USING ERRCODE = '22023';
  END IF;

  IF p_amount <> trunc(p_amount, v_asset.decimal_places) THEN
    RAISE EXCEPTION 'bid amount exceeds precision for asset %', v_asset.code
      USING ERRCODE = '22003',
        DETAIL = format('maximum decimal places: %s', v_asset.decimal_places);
  END IF;

  IF p_amount > v_campaign.budget THEN
    RAISE EXCEPTION 'bid amount exceeds campaign budget'
      USING ERRCODE = '22003';
  END IF;

  IF v_campaign.status <> 'open' THEN
    RAISE EXCEPTION 'campaign is closed'
      USING ERRCODE = '55000';
  END IF;

  IF v_campaign.bidding_deadline <= statement_timestamp() THEN
    RAISE EXCEPTION 'campaign bidding deadline has passed'
      USING ERRCODE = '55000';
  END IF;

  SELECT fit.*
  INTO v_fit
  FROM marketplace.calculate_fit(v_creator.id, v_campaign.id) AS fit;

  IF NOT v_fit.eligible THEN
    RAISE EXCEPTION 'creator is not eligible for campaign'
      USING ERRCODE = '42501';
  END IF;

  FOR v_attempt IN 1..3 LOOP
    BEGIN
      INSERT INTO marketplace.bids AS existing (
        public_id,
        campaign_id,
        creator_id,
        amount,
        fit_score,
        fit_breakdown
      )
      VALUES (
        marketplace.generate_public_id('bid'),
        v_campaign.id,
        v_creator.id,
        p_amount,
        v_fit.fit_score,
        v_fit.fit_breakdown
      )
      ON CONFLICT ON CONSTRAINT bids_campaign_creator_unique DO UPDATE
      SET amount = excluded.amount,
          fit_score = excluded.fit_score,
          fit_breakdown = excluded.fit_breakdown,
          updated_at = statement_timestamp()
      WHERE existing.status = 'pending'
      RETURNING existing.* INTO v_bid;

      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        IF v_attempt = 3 THEN
          RAISE;
        END IF;
    END;
  END LOOP;

  IF v_bid.id IS NULL THEN
    RAISE EXCEPTION 'finalized bid cannot be revised'
      USING ERRCODE = '55000';
  END IF;

  RETURN QUERY
  SELECT
    v_bid.public_id,
    v_campaign.public_id,
    v_creator.public_id,
    v_bid.amount,
    v_asset.code,
    v_bid.fit_score,
    v_bid.fit_breakdown,
    v_bid.status,
    v_bid.submitted_at,
    v_bid.updated_at;
END
$function$;

CREATE FUNCTION api.close_due_campaigns(p_batch_size integer DEFAULT 50)
RETURNS TABLE (
  campaign_id text,
  winning_bid_count integer,
  losing_bid_count integer,
  awarded_amount numeric(38,18),
  remaining_budget numeric(38,18)
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, marketplace
AS $function$
DECLARE
  v_campaign marketplace.campaigns%ROWTYPE;
  v_bid record;
  v_now timestamptz := statement_timestamp();
  v_remaining numeric(38,18);
  v_awarded numeric(38,18);
  v_winners integer;
  v_losers integer;
  v_rank integer;
BEGIN
  IF p_batch_size IS NULL OR p_batch_size NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'batch size must be between 1 and 1000'
      USING ERRCODE = '22023';
  END IF;

  FOR v_campaign IN
    SELECT campaign.*
    FROM marketplace.campaigns AS campaign
    WHERE campaign.status = 'open'
      AND campaign.bidding_deadline <= v_now
    ORDER BY campaign.bidding_deadline, campaign.id
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    v_remaining := v_campaign.budget;
    v_awarded := 0;
    v_winners := 0;
    v_losers := 0;
    v_rank := 0;

    FOR v_bid IN
      SELECT
        bid.id,
        bid.amount,
        round(
          0.65::numeric * bid.fit_score
          + 0.35::numeric * greatest(
            0::numeric,
            100::numeric * (1::numeric - bid.amount / v_campaign.budget)
          ),
          4
        )::numeric(7,4) AS calculated_selection_score
      FROM marketplace.bids AS bid
      WHERE bid.campaign_id = v_campaign.id
        AND bid.status = 'pending'
      ORDER BY
        calculated_selection_score DESC,
        bid.fit_score DESC,
        bid.amount,
        bid.submitted_at,
        bid.id
    LOOP
      v_rank := v_rank + 1;

      IF v_bid.amount <= v_remaining THEN
        UPDATE marketplace.bids
        SET status = 'won',
            selection_score = v_bid.calculated_selection_score,
            selection_rank = v_rank,
            finalized_at = v_now,
            updated_at = v_now
        WHERE id = v_bid.id;

        v_remaining := v_remaining - v_bid.amount;
        v_awarded := v_awarded + v_bid.amount;
        v_winners := v_winners + 1;
      ELSE
        UPDATE marketplace.bids
        SET status = 'lost',
            selection_score = v_bid.calculated_selection_score,
            selection_rank = v_rank,
            finalized_at = v_now,
            updated_at = v_now
        WHERE id = v_bid.id;

        v_losers := v_losers + 1;
      END IF;
    END LOOP;

    UPDATE marketplace.campaigns
    SET status = 'closed',
        closed_at = v_now,
        selection_rule_version = 1,
        updated_at = v_now
    WHERE id = v_campaign.id;

    campaign_id := v_campaign.public_id;
    winning_bid_count := v_winners;
    losing_bid_count := v_losers;
    awarded_amount := v_awarded;
    remaining_budget := v_remaining;
    RETURN NEXT;
  END LOOP;
END
$function$;

REVOKE ALL ON ALL TABLES IN SCHEMA marketplace FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA marketplace FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA marketplace FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA api FROM PUBLIC;

GRANT USAGE ON SCHEMA api TO marketplace_web, marketplace_worker;

GRANT EXECUTE ON FUNCTION api.list_creators() TO marketplace_web;
GRANT EXECUTE ON FUNCTION api.list_campaign_matches(text) TO marketplace_web;
GRANT EXECUTE ON FUNCTION api.list_creator_bids(text) TO marketplace_web;
GRANT EXECUTE ON FUNCTION api.upsert_bid(text, text, numeric) TO marketplace_web;
GRANT EXECUTE ON FUNCTION api.close_due_campaigns(integer) TO marketplace_worker;

COMMENT ON SCHEMA marketplace IS
  'Private marketplace data and business-logic helpers; runtime roles have no direct access.';
COMMENT ON SCHEMA api IS
  'Stable SQL API used by the Fastify application and scheduled worker.';
COMMENT ON COLUMN marketplace.campaigns.budget IS
  'Exact amount denominated by asset_id; at most the asset decimal_places may be supplied.';
COMMENT ON COLUMN marketplace.bids.amount IS
  'Exact amount in the campaign asset; accepted through api.upsert_bid as a decimal string.';
