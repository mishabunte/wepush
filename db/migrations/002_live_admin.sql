DO $roles$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'marketplace_admin') THEN
    CREATE ROLE marketplace_admin NOLOGIN;
  END IF;
END
$roles$;

CREATE TABLE marketplace.events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type text COLLATE "C" NOT NULL,
  entity_type text COLLATE "C" NOT NULL,
  entity_public_id text COLLATE "C" NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT events_type_format CHECK (event_type ~ '^[a-z]+\.[a-z]+$'),
  CONSTRAINT events_entity_format CHECK (entity_type ~ '^[a-z]+$'),
  CONSTRAINT events_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX events_occurred_idx ON marketplace.events (occurred_at DESC, id DESC);

CREATE FUNCTION marketplace.emit_event(
  p_event_type text,
  p_entity_type text,
  p_entity_public_id text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, marketplace
AS $function$
DECLARE
  v_id bigint;
BEGIN
  INSERT INTO marketplace.events (event_type, entity_type, entity_public_id, payload)
  VALUES (p_event_type, p_entity_type, p_entity_public_id, coalesce(p_payload, '{}'::jsonb))
  RETURNING id INTO v_id;
  PERFORM pg_catalog.pg_notify('marketplace_events', v_id::text);
  RETURN v_id;
END
$function$;

CREATE FUNCTION marketplace.capture_creator_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, marketplace
AS $function$
BEGIN
  PERFORM marketplace.emit_event(
    'creator.created', 'creator', NEW.public_id,
    jsonb_build_object('displayName', NEW.display_name, 'genre', NEW.genre)
  );
  RETURN NEW;
END
$function$;

CREATE TRIGGER creators_event AFTER INSERT ON marketplace.creators
FOR EACH ROW EXECUTE FUNCTION marketplace.capture_creator_event();

CREATE FUNCTION marketplace.capture_campaign_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, marketplace
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM marketplace.emit_event(
      'campaign.created', 'campaign', NEW.public_id,
      jsonb_build_object('title', NEW.title, 'deadline', NEW.bidding_deadline)
    );
  ELSIF OLD.status = 'open' AND NEW.status = 'closed' THEN
    PERFORM marketplace.emit_event(
      'campaign.closed', 'campaign', NEW.public_id,
      jsonb_build_object(
        'title', NEW.title,
        'winningBidCount', (SELECT count(*) FROM marketplace.bids WHERE campaign_id = NEW.id AND status = 'won'),
        'losingBidCount', (SELECT count(*) FROM marketplace.bids WHERE campaign_id = NEW.id AND status = 'lost')
      )
    );
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER campaigns_event AFTER INSERT OR UPDATE OF status ON marketplace.campaigns
FOR EACH ROW EXECUTE FUNCTION marketplace.capture_campaign_event();

CREATE FUNCTION marketplace.capture_bid_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, marketplace
AS $function$
DECLARE
  v_campaign_id text;
  v_creator_id text;
  v_event_type text;
BEGIN
  SELECT public_id INTO STRICT v_campaign_id FROM marketplace.campaigns WHERE id = NEW.campaign_id;
  SELECT public_id INTO STRICT v_creator_id FROM marketplace.creators WHERE id = NEW.creator_id;
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'bid.created';
  ELSIF OLD.status = 'pending' AND NEW.status IN ('won', 'lost') THEN
    v_event_type := 'bid.finalized';
  ELSIF OLD.amount IS DISTINCT FROM NEW.amount THEN
    v_event_type := 'bid.updated';
  ELSE
    RETURN NEW;
  END IF;
  PERFORM marketplace.emit_event(
    v_event_type, 'bid', NEW.public_id,
    jsonb_build_object(
      'campaignId', v_campaign_id, 'creatorId', v_creator_id,
      'amount', NEW.amount::text, 'status', NEW.status
    )
  );
  RETURN NEW;
END
$function$;

CREATE TRIGGER bids_event AFTER INSERT OR UPDATE OF amount, status ON marketplace.bids
FOR EACH ROW EXECUTE FUNCTION marketplace.capture_bid_event();

CREATE FUNCTION api.admin_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, marketplace
AS $function$
  SELECT jsonb_build_object(
    'creatorCount', (SELECT count(*) FROM marketplace.creators),
    'openCampaignCount', (SELECT count(*) FROM marketplace.campaigns WHERE status = 'open'),
    'pendingBidCount', (SELECT count(*) FROM marketplace.bids WHERE status = 'pending'),
    'recentlyClosedCount', (SELECT count(*) FROM marketplace.campaigns WHERE status = 'closed' AND closed_at >= statement_timestamp() - interval '24 hours'),
    'budgets', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'asset', grouped.code, 'symbol', grouped.display_symbol,
        'decimalPlaces', grouped.decimal_places,
        'openBudget', grouped.open_budget::text,
        'awardedAmount', grouped.awarded_amount::text
      ) ORDER BY grouped.code)
      FROM (
        SELECT asset.code, asset.display_symbol, asset.decimal_places,
          coalesce(sum(campaign.budget) FILTER (WHERE campaign.status = 'open'), 0) AS open_budget,
          coalesce(sum(bid.amount) FILTER (WHERE bid.status = 'won'), 0) AS awarded_amount
        FROM marketplace.assets asset
        LEFT JOIN marketplace.campaigns campaign ON campaign.asset_id = asset.id
        LEFT JOIN marketplace.bids bid ON bid.campaign_id = campaign.id
        GROUP BY asset.id
      ) grouped
    ), '[]'::jsonb),
    'generatedAt', statement_timestamp()
  );
$function$;

CREATE FUNCTION api.admin_list_campaigns()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, marketplace
AS $function$
  SELECT coalesce(jsonb_agg(item.value ORDER BY item.deadline DESC), '[]'::jsonb)
  FROM (
    SELECT campaign.bidding_deadline AS deadline, jsonb_build_object(
      'id', campaign.public_id, 'title', campaign.title, 'description', campaign.description,
      'targetGenre', campaign.target_genre, 'minimumFollowers', campaign.minimum_followers,
      'targetEngagementRate', campaign.target_engagement_rate::text,
      'budget', jsonb_build_object('amount', campaign.budget::text, 'asset', asset.code, 'symbol', asset.display_symbol, 'decimalPlaces', asset.decimal_places),
      'biddingDeadline', campaign.bidding_deadline, 'status', campaign.status,
      'closedAt', campaign.closed_at, 'bidCount', count(bid.id),
      'winningBidCount', count(bid.id) FILTER (WHERE bid.status = 'won'),
      'awardedAmount', coalesce(sum(bid.amount) FILTER (WHERE bid.status = 'won'), 0)::text
    ) AS value
    FROM marketplace.campaigns campaign
    JOIN marketplace.assets asset ON asset.id = campaign.asset_id
    LEFT JOIN marketplace.bids bid ON bid.campaign_id = campaign.id
    GROUP BY campaign.id, asset.id
  ) item;
$function$;

CREATE FUNCTION api.admin_campaign_detail(p_campaign_public_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, marketplace
AS $function$
DECLARE v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', campaign.public_id, 'title', campaign.title, 'description', campaign.description,
    'targetGenre', campaign.target_genre, 'minimumFollowers', campaign.minimum_followers,
    'targetEngagementRate', campaign.target_engagement_rate::text,
    'budget', jsonb_build_object('amount', campaign.budget::text, 'asset', asset.code, 'symbol', asset.display_symbol, 'decimalPlaces', asset.decimal_places),
    'biddingDeadline', campaign.bidding_deadline, 'status', campaign.status, 'closedAt', campaign.closed_at,
    'bids', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', ranked.public_id, 'creator', jsonb_build_object('id', ranked.creator_public_id, 'displayName', ranked.display_name, 'followers', ranked.follower_count, 'engagementRate', ranked.engagement_rate::text),
      'amount', ranked.amount::text, 'fitScore', ranked.fit_score::text,
      'selectionScore', coalesce(ranked.selection_score, ranked.provisional_score)::text,
      'selectionRank', coalesce(ranked.selection_rank, ranked.provisional_rank),
      'provisional', ranked.selection_score IS NULL, 'status', ranked.status,
      'submittedAt', ranked.submitted_at, 'updatedAt', ranked.updated_at
    ) ORDER BY coalesce(ranked.selection_rank, ranked.provisional_rank)) FROM (
      SELECT bid.*, creator.public_id creator_public_id, creator.display_name, creator.follower_count, creator.engagement_rate,
        round(0.65::numeric * bid.fit_score + 0.35::numeric * greatest(0::numeric, 100::numeric * (1::numeric - bid.amount / campaign.budget)), 4)::numeric(7,4) provisional_score,
        row_number() OVER (ORDER BY round(0.65::numeric * bid.fit_score + 0.35::numeric * greatest(0::numeric, 100::numeric * (1::numeric - bid.amount / campaign.budget)), 4) DESC, bid.fit_score DESC, bid.amount, bid.submitted_at, bid.id)::integer provisional_rank
      FROM marketplace.bids bid JOIN marketplace.creators creator ON creator.id = bid.creator_id
      WHERE bid.campaign_id = campaign.id
    ) ranked), '[]'::jsonb)
  ) INTO v_result
  FROM marketplace.campaigns campaign JOIN marketplace.assets asset ON asset.id = campaign.asset_id
  WHERE campaign.public_id = p_campaign_public_id;
  IF v_result IS NULL THEN RAISE EXCEPTION 'campaign not found' USING ERRCODE = 'P0002'; END IF;
  RETURN v_result;
END
$function$;

CREATE FUNCTION api.admin_list_creators()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, marketplace
AS $function$
  SELECT coalesce(jsonb_agg(item.value ORDER BY item.display_name), '[]'::jsonb)
  FROM (
    SELECT creator.display_name, jsonb_build_object(
      'id', creator.public_id, 'displayName', creator.display_name, 'genre', creator.genre,
      'followerCount', creator.follower_count, 'engagementRate', creator.engagement_rate::text,
      'bidCount', count(bid.id), 'winCount', count(bid.id) FILTER (WHERE bid.status = 'won'),
      'createdAt', creator.created_at
    ) AS value
    FROM marketplace.creators creator LEFT JOIN marketplace.bids bid ON bid.creator_id = creator.id
    GROUP BY creator.id
  ) item;
$function$;

CREATE FUNCTION api.admin_list_assets()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, marketplace
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object('code', code, 'symbol', display_symbol, 'kind', kind, 'network', network, 'decimalPlaces', decimal_places) ORDER BY code), '[]'::jsonb)
  FROM marketplace.assets;
$function$;

CREATE FUNCTION api.admin_create_creator(p_display_name text, p_genre text, p_follower_count bigint, p_engagement_rate numeric)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, marketplace
AS $function$
DECLARE v_id text;
BEGIN
  INSERT INTO marketplace.creators(display_name, genre, follower_count, engagement_rate)
  VALUES (btrim(p_display_name), lower(btrim(p_genre)), p_follower_count, p_engagement_rate)
  RETURNING public_id INTO v_id;
  RETURN v_id;
END
$function$;

CREATE FUNCTION api.admin_create_campaign(p_title text, p_description text, p_target_genre text, p_minimum_followers bigint, p_target_engagement_rate numeric, p_asset_code text, p_budget numeric, p_bidding_deadline timestamptz)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, marketplace
AS $function$
DECLARE v_asset_id bigint; v_id text;
BEGIN
  IF p_bidding_deadline <= statement_timestamp() THEN RAISE EXCEPTION 'bidding deadline must be in the future' USING ERRCODE = '22023'; END IF;
  SELECT id INTO v_asset_id FROM marketplace.assets WHERE code = upper(p_asset_code);
  IF NOT FOUND THEN RAISE EXCEPTION 'asset not found' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO marketplace.campaigns(title, description, target_genre, minimum_followers, target_engagement_rate, asset_id, budget, bidding_deadline)
  VALUES (btrim(p_title), btrim(p_description), lower(btrim(p_target_genre)), p_minimum_followers, p_target_engagement_rate, v_asset_id, p_budget, p_bidding_deadline)
  RETURNING public_id INTO v_id;
  RETURN v_id;
END
$function$;

CREATE FUNCTION api.admin_list_events(p_after_id bigint DEFAULT 0, p_limit integer DEFAULT 100)
RETURNS TABLE(event_id bigint, event_type text, entity_type text, entity_public_id text, payload jsonb, occurred_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, marketplace
AS $function$
BEGIN
  IF p_after_id < 0 OR p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'invalid event cursor or limit' USING ERRCODE = '22023'; END IF;
  RETURN QUERY SELECT id, events.event_type, events.entity_type, events.entity_public_id, events.payload, events.occurred_at
  FROM marketplace.events events WHERE id > p_after_id ORDER BY id LIMIT p_limit;
END
$function$;

CREATE FUNCTION api.admin_process_due_campaigns(p_batch_size integer DEFAULT 50)
RETURNS TABLE(campaign_id text, winning_bid_count integer, losing_bid_count integer, awarded_amount numeric, remaining_budget numeric)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, api
AS $function$ SELECT * FROM api.close_due_campaigns(p_batch_size); $function$;

REVOKE ALL ON TABLE marketplace.events FROM PUBLIC;
REVOKE ALL ON SEQUENCE marketplace.events_id_seq FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA api FROM PUBLIC;
GRANT USAGE ON SCHEMA api TO marketplace_admin;
GRANT EXECUTE ON FUNCTION api.admin_summary() TO marketplace_admin;
GRANT EXECUTE ON FUNCTION api.admin_list_campaigns() TO marketplace_admin;
GRANT EXECUTE ON FUNCTION api.admin_campaign_detail(text) TO marketplace_admin;
GRANT EXECUTE ON FUNCTION api.admin_list_creators() TO marketplace_admin;
GRANT EXECUTE ON FUNCTION api.admin_list_assets() TO marketplace_admin;
GRANT EXECUTE ON FUNCTION api.admin_create_creator(text,text,bigint,numeric) TO marketplace_admin;
GRANT EXECUTE ON FUNCTION api.admin_create_campaign(text,text,text,bigint,numeric,text,numeric,timestamptz) TO marketplace_admin;
GRANT EXECUTE ON FUNCTION api.admin_list_events(bigint,integer) TO marketplace_admin;
GRANT EXECUTE ON FUNCTION api.admin_process_due_campaigns(integer) TO marketplace_admin;
