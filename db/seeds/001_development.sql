TRUNCATE TABLE
  marketplace.bids,
  marketplace.campaigns,
  marketplace.creators,
  marketplace.assets,
  marketplace.events
RESTART IDENTITY CASCADE;

INSERT INTO marketplace.assets (
  code,
  display_symbol,
  kind,
  network,
  decimal_places
)
VALUES
  ('EUR', '€', 'fiat', NULL, 2),
  ('BTC', '₿', 'crypto', 'bitcoin', 8),
  ('ZEC', 'ZEC', 'crypto', 'zcash', 8),
  ('ETH', 'Ξ', 'crypto', 'ethereum', 18);

INSERT INTO marketplace.creators (
  display_name,
  genre,
  follower_count,
  engagement_rate
)
VALUES
  ('Ava Pulse', 'electronic', 120000, 6.5000),
  ('Liam Current', 'electronic', 250000, 8.4000),
  ('Noah Loop', 'electronic', 80000, 4.2000),
  ('Mia Mode', 'fashion', 180000, 5.8000),
  ('Sofia Trail', 'travel', 95000, 7.1000),
  ('Ethan Frame', 'gaming', 420000, 3.9000);

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
VALUES
  (
    'Neon Sessions Launch',
    'Introduce a new live electronic music series with a short-form launch package.',
    'electronic',
    50000,
    5.0000,
    (SELECT id FROM marketplace.assets WHERE code = 'EUR'),
    5000.00,
    statement_timestamp() + interval '3 minutes'
  ),
  (
    'Analog Future Headphones',
    'Create an authentic product story for studio-focused wireless headphones.',
    'electronic',
    100000,
    6.0000,
    (SELECT id FROM marketplace.assets WHERE code = 'EUR'),
    8500.00,
    statement_timestamp() + interval '2 days'
  ),
  (
    'City Layers Autumn Edit',
    'Style and publish a seasonal urban fashion lookbook.',
    'fashion',
    100000,
    4.5000,
    (SELECT id FROM marketplace.assets WHERE code = 'EUR'),
    6000.00,
    statement_timestamp() + interval '1 day'
  ),
  (
    'Slow Roads Weekend',
    'Document a low-impact regional travel itinerary.',
    'travel',
    75000,
    6.0000,
    (SELECT id FROM marketplace.assets WHERE code = 'EUR'),
    4200.00,
    statement_timestamp() + interval '36 hours'
  ),
  (
    'Archived Gaming Drop',
    'An already-expired campaign used to demonstrate scheduled closure.',
    'gaming',
    200000,
    3.5000,
    (SELECT id FROM marketplace.assets WHERE code = 'EUR'),
    10000.00,
    statement_timestamp() - interval '1 hour'
  );
