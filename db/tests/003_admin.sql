\set ON_ERROR_STOP on
BEGIN;

DO $test$
DECLARE
  v_campaign_id text;
  v_event_count integer;
  v_summary jsonb;
  v_campaigns jsonb;
  v_early_position bigint;
  v_late_position bigint;
  v_initial_event_id bigint;
BEGIN
  SELECT coalesce(max(id), 0) INTO v_initial_event_id
  FROM marketplace.events;

  v_campaign_id := api.admin_create_campaign(
    'Admin SQL Test', 'Transactional admin function test', 'electronic', 10,
    1.5, 'EUR', 100.00, statement_timestamp() + interval '1 day'
  );
  IF v_campaign_id !~ '^cmp_[A-Za-z0-9_-]{16}$' THEN RAISE EXCEPTION 'invalid campaign ID'; END IF;
  SELECT count(*) INTO v_event_count
  FROM api.admin_list_events(v_initial_event_id, 500)
  WHERE event_type = 'campaign.created' AND entity_public_id = v_campaign_id;
  IF v_event_count <> 1 THEN RAISE EXCEPTION 'campaign event was not recorded'; END IF;
  v_summary := api.admin_summary();
  IF (v_summary->>'creatorCount')::integer < 1 THEN RAISE EXCEPTION 'invalid admin summary'; END IF;

  PERFORM api.admin_create_campaign(
    'Admin Ordering Early', 'Projection ordering test', 'electronic', 10,
    1.5, 'EUR', 100.00, statement_timestamp() + interval '1 minute'
  );
  PERFORM api.admin_create_campaign(
    'Admin Ordering Late', 'Projection ordering test', 'electronic', 10,
    1.5, 'EUR', 100.00, statement_timestamp() + interval '2 minutes'
  );
  v_campaigns := api.admin_list_campaigns();
  IF jsonb_array_length(v_campaigns) > 100 THEN
    RAISE EXCEPTION 'admin campaign projection exceeded its limit';
  END IF;
  SELECT item.ordinality INTO STRICT v_early_position
  FROM jsonb_array_elements(v_campaigns) WITH ORDINALITY AS item(value, ordinality)
  WHERE item.value->>'title' = 'Admin Ordering Early';
  SELECT item.ordinality INTO STRICT v_late_position
  FROM jsonb_array_elements(v_campaigns) WITH ORDINALITY AS item(value, ordinality)
  WHERE item.value->>'title' = 'Admin Ordering Late';
  IF v_early_position >= v_late_position THEN
    RAISE EXCEPTION 'open admin campaigns are not ordered by ascending deadline';
  END IF;
END
$test$;

SET LOCAL ROLE marketplace_admin;
SELECT api.admin_summary();
DO $permissions$
BEGIN
  BEGIN
    PERFORM count(*) FROM marketplace.events;
    RAISE EXCEPTION 'admin role unexpectedly read private events';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$permissions$;

ROLLBACK;
