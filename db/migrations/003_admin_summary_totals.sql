CREATE OR REPLACE FUNCTION api.admin_summary()
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
        'asset', asset.code, 'symbol', asset.display_symbol,
        'decimalPlaces', asset.decimal_places,
        'openBudget', coalesce(campaign_totals.open_budget, 0)::text,
        'awardedAmount', coalesce(bid_totals.awarded_amount, 0)::text
      ) ORDER BY asset.code)
      FROM marketplace.assets asset
      LEFT JOIN LATERAL (
        SELECT sum(campaign.budget) AS open_budget
        FROM marketplace.campaigns campaign
        WHERE campaign.asset_id = asset.id AND campaign.status = 'open'
      ) campaign_totals ON true
      LEFT JOIN LATERAL (
        SELECT sum(bid.amount) AS awarded_amount
        FROM marketplace.bids bid
        JOIN marketplace.campaigns campaign ON campaign.id = bid.campaign_id
        WHERE campaign.asset_id = asset.id AND bid.status = 'won'
      ) bid_totals ON true
    ), '[]'::jsonb),
    'generatedAt', statement_timestamp()
  );
$function$;

REVOKE ALL ON FUNCTION api.admin_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.admin_summary() TO marketplace_admin;
