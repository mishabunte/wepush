CREATE INDEX campaigns_admin_list_idx
  ON marketplace.campaigns (status, bidding_deadline, id);

CREATE OR REPLACE FUNCTION api.admin_list_campaigns()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, marketplace
AS $function$
  WITH selected AS (
    SELECT
      campaign.*,
      CASE WHEN campaign.status = 'open' THEN 0 ELSE 1 END AS status_order,
      CASE WHEN campaign.status = 'open' THEN campaign.bidding_deadline END AS open_deadline,
      CASE WHEN campaign.status = 'closed' THEN campaign.bidding_deadline END AS closed_deadline
    FROM marketplace.campaigns AS campaign
    ORDER BY
      status_order,
      open_deadline,
      closed_deadline DESC,
      campaign.id
    LIMIT 100
  ), projected AS (
    SELECT
      campaign.status_order,
      campaign.open_deadline,
      campaign.closed_deadline,
      campaign.id AS internal_id,
      jsonb_build_object(
        'id', campaign.public_id,
        'title', campaign.title,
        'description', campaign.description,
        'targetGenre', campaign.target_genre,
        'minimumFollowers', campaign.minimum_followers,
        'targetEngagementRate', campaign.target_engagement_rate::text,
        'budget', jsonb_build_object(
          'amount', campaign.budget::text,
          'asset', asset.code,
          'symbol', asset.display_symbol,
          'decimalPlaces', asset.decimal_places
        ),
        'biddingDeadline', campaign.bidding_deadline,
        'status', campaign.status,
        'closedAt', campaign.closed_at,
        'bidCount', bid_totals.bid_count,
        'winningBidCount', bid_totals.winning_bid_count,
        'awardedAmount', bid_totals.awarded_amount::text
      ) AS value
    FROM selected AS campaign
    JOIN marketplace.assets AS asset ON asset.id = campaign.asset_id
    LEFT JOIN LATERAL (
      SELECT
        count(*) AS bid_count,
        count(*) FILTER (WHERE bid.status = 'won') AS winning_bid_count,
        coalesce(sum(bid.amount) FILTER (WHERE bid.status = 'won'), 0) AS awarded_amount
      FROM marketplace.bids AS bid
      WHERE bid.campaign_id = campaign.id
    ) AS bid_totals ON true
  )
  SELECT coalesce(
    jsonb_agg(
      projected.value
      ORDER BY
        projected.status_order,
        projected.open_deadline,
        projected.closed_deadline DESC,
        projected.internal_id
    ),
    '[]'::jsonb
  )
  FROM projected;
$function$;

REVOKE ALL ON FUNCTION api.admin_list_campaigns() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.admin_list_campaigns() TO marketplace_admin;
