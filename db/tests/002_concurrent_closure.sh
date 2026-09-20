#!/usr/bin/env bash
set -euo pipefail

database_url="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/wepush}"
fixture_title="Concurrent Closure Test Campaign"

cleanup() {
  psql "$database_url" -v ON_ERROR_STOP=1 -v fixture_title="$fixture_title" >/dev/null <<'SQL'
DELETE FROM marketplace.bids
WHERE campaign_id IN (
  SELECT id FROM marketplace.campaigns WHERE title = :'fixture_title'
);
DELETE FROM marketplace.campaigns WHERE title = :'fixture_title';
SQL
}
trap cleanup EXIT

# Remove unrelated due work so both sessions contend for the same campaign.
psql "$database_url" -v ON_ERROR_STOP=1 -Atqc \
  "SELECT count(*) FROM api.close_due_campaigns(1000)" >/dev/null

campaign_id="$(psql "$database_url" -v ON_ERROR_STOP=1 -At -v fixture_title="$fixture_title" <<'SQL'
WITH new_campaign AS (
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
    :'fixture_title',
    'Fixture used to verify concurrent worker safety.',
    'electronic',
    0,
    0,
    (SELECT id FROM marketplace.assets WHERE code = 'EUR'),
    1000.00,
    statement_timestamp() - interval '1 minute'
  )
  RETURNING id, public_id
), new_bids AS (
  INSERT INTO marketplace.bids (
    campaign_id,
    creator_id,
    amount,
    fit_score,
    fit_breakdown
  )
  SELECT
    new_campaign.id,
    creator.id,
    CASE row_number() OVER (ORDER BY creator.id)
      WHEN 1 THEN 700.00
      WHEN 2 THEN 600.00
      ELSE 300.00
    END,
    CASE row_number() OVER (ORDER BY creator.id)
      WHEN 1 THEN 100.00
      WHEN 2 THEN 90.00
      ELSE 70.00
    END,
    '{"test": true}'::jsonb
  FROM new_campaign
  CROSS JOIN LATERAL (
    SELECT id
    FROM marketplace.creators
    WHERE genre = 'electronic'
    ORDER BY id
    LIMIT 3
  ) AS creator
)
SELECT public_id FROM new_campaign;
SQL
)"

# Keep the first transaction open after closure so the second worker must skip
# the locked campaign rather than processing it a second time.
psql "$database_url" -v ON_ERROR_STOP=1 -Atqc \
  "BEGIN; SELECT campaign_id FROM api.close_due_campaigns(1); SELECT pg_sleep(1); COMMIT" \
  >/dev/null &
first_worker_pid=$!

sleep 0.1

second_worker_count="$(psql "$database_url" -v ON_ERROR_STOP=1 -Atqc \
  "SELECT count(*) FROM api.close_due_campaigns(1)")"

wait "$first_worker_pid"

if [[ "$second_worker_count" != "0" ]]; then
  echo "Concurrent worker unexpectedly closed a locked campaign" >&2
  exit 1
fi

psql "$database_url" -v ON_ERROR_STOP=1 -At -v campaign_id="$campaign_id" <<'SQL'
SET test.campaign_id TO :'campaign_id';

DO $test$
DECLARE
  v_campaign_id bigint;
  v_budget numeric(38,18);
  v_winning_total numeric(38,18);
BEGIN
  SELECT id, budget INTO STRICT v_campaign_id, v_budget
  FROM marketplace.campaigns
  WHERE public_id = current_setting('test.campaign_id')
    AND status = 'closed';

  IF EXISTS (
    SELECT 1 FROM marketplace.bids
    WHERE campaign_id = v_campaign_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'concurrent closure left pending bids';
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_winning_total
  FROM marketplace.bids
  WHERE campaign_id = v_campaign_id AND status = 'won';

  IF v_winning_total > v_budget THEN
    RAISE EXCEPTION 'concurrent closure exceeded campaign budget';
  END IF;
END
$test$;
SQL

echo 'Concurrent closure test passed.'
