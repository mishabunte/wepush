import assert from 'node:assert/strict';
import test from 'node:test';

import { createHttpServer } from '../../src/http-server.js';
import { createDatabasePool } from '../../src/database.js';
import {
  MarketplaceRepository,
  type CampaignMatch,
  type Creator,
  type CreatorBid
} from '../../src/marketplace.js';
import { AdminRepository } from '../../src/admin.js';

const connectionString =
  process.env.TEST_DATABASE_URL ||
  'postgresql://wepush_web:wepush_web@localhost:5433/wepush';

const pool = createDatabasePool({
  connectionString,
  max: 2,
  applicationName: 'wepush-api-integration-test'
});
const adminPool = createDatabasePool({
  connectionString: process.env.ADMIN_DATABASE_URL || 'postgresql://wepush_admin:wepush_admin@localhost:5433/wepush',
  max: 2,
  applicationName: 'wepush-admin-integration-test'
});
const marketplace = new MarketplaceRepository(pool);
const admin = new AdminRepository(adminPool);
const app = createHttpServer({ marketplace, admin, logger: false });

test.after(async () => {
  await app.close();
  await pool.end();
  await adminPool.end();
});

test('serves the live admin overview and campaign detail', async () => {
  const summary = await app.inject({ method: 'GET', url: '/api/v1/admin/summary' });
  assert.equal(summary.statusCode, 200);
  assert.ok(summary.json().data.creatorCount >= 6);

  const campaigns = await app.inject({ method: 'GET', url: '/api/v1/admin/campaigns' });
  assert.equal(campaigns.statusCode, 200);
  const first = campaigns.json().data[0];
  assert.ok(first?.id);
  const detail = await app.inject({ method: 'GET', url: `/api/v1/admin/campaigns/${first.id}` });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().data.id, first.id);
});

test('creates an admin campaign through the SQL API boundary', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/campaigns',
    payload: {
      title: 'Integration Live Campaign',
      description: 'Created by the admin HTTP integration test.',
      targetGenre: 'electronic',
      minimumFollowers: 50000,
      targetEngagementRate: '5.5',
      asset: 'EUR',
      budget: '2500.00',
      biddingDeadline: new Date(Date.now() + 3_600_000).toISOString()
    }
  });
  assert.equal(response.statusCode, 201);
  const campaignId = response.json().data.id;
  assert.match(campaignId, /^cmp_[A-Za-z0-9_-]{16}$/);
  const detail = await app.inject({ method: 'GET', url: `/api/v1/admin/campaigns/${campaignId}` });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().data.budget.amount, '2500.00');
});

test('serves seeded creators and their matched campaigns', async () => {
  const creatorsResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/creators'
  });
  assert.equal(creatorsResponse.statusCode, 200);

  const creators = (creatorsResponse.json() as { data: Creator[] }).data;
  assert.ok(creators.length >= 6);
  const creator = creators.find((item) => item.displayName === 'Ava Pulse');
  assert.ok(creator);

  const matchesResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/creators/${creator.id}/matches`
  });
  assert.equal(matchesResponse.statusCode, 200);

  const matches = (matchesResponse.json() as { data: CampaignMatch[] }).data;
  assert.ok(matches.length >= 1);
  assert.ok(matches.every((campaign) => campaign.requirements.genre === 'electronic'));
  assert.ok(matches.every((campaign) => campaign.budget.asset === 'EUR'));
});

test('places and revises a bid through the HTTP contract', async () => {
  const creators = (
    await app.inject({ method: 'GET', url: '/api/v1/creators' })
  ).json() as { data: Creator[] };
  const creatorList = creators.data;
  const creator = creatorList.find((item) => item.displayName === 'Ava Pulse');
  assert.ok(creator);
  const matchesResponseBody = (
    await app.inject({
      method: 'GET',
      url: `/api/v1/creators/${creator.id}/matches`
    })
  ).json() as { data: CampaignMatch[] };
  const campaign = matchesResponseBody.data.find(
    (item) => item.title === 'Analog Future Headphones'
  );
  assert.ok(campaign);

  const first = await app.inject({
    method: 'PUT',
    url: `/api/v1/creators/${creator.id}/bids/${campaign.id}`,
    payload: { amount: '1200.50' }
  });
  assert.equal(first.statusCode, 200);

  const second = await app.inject({
    method: 'PUT',
    url: `/api/v1/creators/${creator.id}/bids/${campaign.id}`,
    payload: { amount: '1250.75' }
  });
  assert.equal(second.statusCode, 200);
  assert.equal(second.json().data.id, first.json().data.id);
  assert.equal(second.json().data.amount.value, '1250.75');

  const bidsResponseBody = (
    await app.inject({
      method: 'GET',
      url: `/api/v1/creators/${creator.id}/bids`
    })
  ).json() as { data: CreatorBid[] };
  const firstBidId = (first.json() as { data: { id: string } }).data.id;
  assert.equal(
    bidsResponseBody.data.find((bid) => bid.id === firstBidId)?.amount.value,
    '1250.75'
  );
});
