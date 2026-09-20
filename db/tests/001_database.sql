\set ON_ERROR_STOP on

BEGIN;

DO $test$
DECLARE
  v_creator_id text;
  v_campaign_id text;
  v_bid_id text;
  v_revised_bid_id text;
  v_match_count integer;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM marketplace.creators
    WHERE public_id !~ '^cr_[A-Za-z0-9_-]{16}$'
  ) THEN
    RAISE EXCEPTION 'creator public ID format test failed';
  END IF;

  SELECT public_id INTO STRICT v_creator_id
  FROM marketplace.creators
  WHERE display_name = 'Ava Pulse';

  SELECT public_id INTO STRICT v_campaign_id
  FROM marketplace.campaigns
  WHERE title = 'Analog Future Headphones';

  SELECT count(*) INTO v_match_count
  FROM api.list_campaign_matches(v_creator_id)
  WHERE campaign_id = v_campaign_id
    AND fit_score BETWEEN 0 AND 100;

  IF v_match_count <> 1 THEN
    RAISE EXCEPTION 'eligible match test failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM api.list_campaign_matches(v_creator_id)
    WHERE target_genre <> 'electronic'
  ) THEN
    RAISE EXCEPTION 'hard genre eligibility test failed';
  END IF;

  SELECT bid_id INTO STRICT v_bid_id
  FROM api.upsert_bid(v_creator_id, v_campaign_id, 1250.50);

  SELECT bid_id INTO STRICT v_revised_bid_id
  FROM api.upsert_bid(v_creator_id, v_campaign_id, 1300.75);

  IF v_bid_id <> v_revised_bid_id THEN
    RAISE EXCEPTION 'bid revision created a new bid';
  END IF;

  IF (
    SELECT amount
    FROM api.list_creator_bids(v_creator_id)
    WHERE bid_id = v_bid_id
  ) <> 1300.75 THEN
    RAISE EXCEPTION 'bid revision amount test failed';
  END IF;

  BEGIN
    PERFORM api.upsert_bid(v_creator_id, v_campaign_id, 1.001);
    RAISE EXCEPTION 'asset precision test failed';
  EXCEPTION
    WHEN numeric_value_out_of_range THEN
      NULL;
  END;
END
$test$;

DO $test$
DECLARE
  v_asset_id bigint;
  v_campaign_id bigint;
  v_campaign_public_id text;
  v_creator_ids bigint[];
  v_first_result record;
  v_winning_total numeric(38,18);
  v_result_count integer;
BEGIN
  SELECT id INTO STRICT v_asset_id
  FROM marketplace.assets
  WHERE code = 'EUR';

  SELECT array_agg(id ORDER BY id) INTO v_creator_ids
  FROM (
    SELECT id
    FROM marketplace.creators
    WHERE genre = 'electronic'
    ORDER BY id
    LIMIT 3
  ) AS eligible_creators;

  INSERT INTO marketplace.campaigns (
    title,
    description,
    target_genre,
    minimum_followers,
    target_engagement_rate,
    asset_id,
    budget,
    bidding_deadline
  )
  VALUES (
    'Closure Test Campaign',
    'Transactional test fixture.',
    'electronic',
    0,
    0,
    v_asset_id,
    1000.00,
    statement_timestamp() - interval '1 minute'
  )
  RETURNING id, public_id INTO v_campaign_id, v_campaign_public_id;

  INSERT INTO marketplace.bids (
    campaign_id,
    creator_id,
    amount,
    fit_score,
    fit_breakdown
  )
  VALUES
    (v_campaign_id, v_creator_ids[1], 700.00, 100.00, '{"test": true}'),
    (v_campaign_id, v_creator_ids[2], 600.00, 90.00, '{"test": true}'),
    (v_campaign_id, v_creator_ids[3], 300.00, 70.00, '{"test": true}');

  SELECT * INTO STRICT v_first_result
  FROM api.close_due_campaigns(50)
  WHERE campaign_id = v_campaign_public_id;

  IF v_first_result.winning_bid_count <> 2
    OR v_first_result.losing_bid_count <> 1
    OR v_first_result.awarded_amount <> 1000.00
    OR v_first_result.remaining_budget <> 0 THEN
    RAISE EXCEPTION 'winner selection test failed: %', row_to_json(v_first_result);
  END IF;

  SELECT coalesce(sum(bid.amount), 0) INTO v_winning_total
  FROM marketplace.bids AS bid
  WHERE bid.campaign_id = v_campaign_id
    AND bid.status = 'won';

  IF v_winning_total > 1000.00 THEN
    RAISE EXCEPTION 'campaign budget exceeded';
  END IF;

  SELECT count(*) INTO v_result_count
  FROM api.close_due_campaigns(50)
  WHERE campaign_id = v_campaign_public_id;

  IF v_result_count <> 0 THEN
    RAISE EXCEPTION 'idempotent closure test failed';
  END IF;
END
$test$;

DO $test$
BEGIN
  IF has_schema_privilege('marketplace_web', 'marketplace', 'USAGE') THEN
    RAISE EXCEPTION 'web role unexpectedly has marketplace schema access';
  END IF;

  IF NOT has_function_privilege(
    'marketplace_web',
    'api.upsert_bid(text,text,numeric)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'web role lacks bid function access';
  END IF;

  IF has_function_privilege(
    'marketplace_web',
    'api.close_due_campaigns(integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'web role unexpectedly has closure access';
  END IF;

  IF NOT has_function_privilege(
    'marketplace_worker',
    'api.close_due_campaigns(integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'worker role lacks closure function access';
  END IF;
END
$test$;

SET LOCAL ROLE marketplace_web;
SELECT count(*) FROM api.list_creators();
RESET ROLE;

SET LOCAL ROLE marketplace_worker;
SELECT count(*) FROM api.close_due_campaigns(1);
RESET ROLE;

ROLLBACK;

\echo 'Database tests passed.'
