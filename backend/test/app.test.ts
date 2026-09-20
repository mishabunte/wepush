import assert from 'node:assert/strict';
import test from 'node:test';

import { createHttpServer } from '../src/http-server.js';
import type {
  AdminService,
  MarketplaceEvent,
  MarketplaceEventSource
} from '../src/admin-contracts.js';
import type { MarketplaceService, UpsertedBid } from '../src/marketplace.js';

const fakeBid: UpsertedBid = {
  id: 'bid_1234567890abcdef',
  campaignId: 'cmp_1234567890abcdef',
  creatorId: 'cr_1234567890abcdef',
  amount: { value: '12.50', asset: 'EUR' },
  fit: { score: '90.00', breakdown: {} },
  status: 'pending',
  submittedAt: new Date(0),
  updatedAt: new Date(0)
};

function fakeMarketplace(
  overrides: Partial<MarketplaceService> = {}
): MarketplaceService {
  return {
    checkConnection: async () => {},
    listCreators: async () => [],
    listCampaignMatches: async () => [],
    listCreatorBids: async () => [],
    upsertBid: async () => fakeBid,
    closeDueCampaigns: async () => [],
    ...overrides
  };
}

function fakeAdmin(
  checkConnection: () => Promise<void> = async () => {}
): AdminService {
  return {
    checkConnection,
    summary: async () => ({
      creatorCount: 0,
      openCampaignCount: 0,
      pendingBidCount: 0,
      recentlyClosedCount: 0,
      generatedAt: new Date(0).toISOString(),
      budgets: []
    }),
    listCampaigns: async () => [],
    campaignDetail: async () => {
      throw new Error('not implemented');
    },
    listCreators: async () => [],
    listAssets: async () => [],
    createCampaign: async () => 'cmp_1234567890abcdef',
    createCreator: async () => 'cr_1234567890abcdef',
    processDue: async () => [],
    listEvents: async () => [],
    recentEvents: async () => []
  };
}

function fakeEventSource(ready: boolean): MarketplaceEventSource {
  return {
    isReady: () => ready,
    subscribe: () => () => {}
  };
}

test('liveness and readiness are separate', async () => {
  const app = createHttpServer({ marketplace: fakeMarketplace(), logger: false });

  const health = await app.inject({ method: 'GET', url: '/healthz' });
  const ready = await app.inject({ method: 'GET', url: '/readyz' });

  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { status: 'ok' });
  assert.equal(ready.statusCode, 200);
  assert.deepEqual(ready.json(), { status: 'ready' });

  await app.close();
});

test('readiness fails when the database is unavailable', async () => {
  const app = createHttpServer({
    marketplace: fakeMarketplace({
      checkConnection: async () => {
        throw new Error('offline');
      }
    }),
    logger: false
  });

  const response = await app.inject({ method: 'GET', url: '/readyz' });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), { status: 'unavailable' });

  await app.close();
});

test('readiness includes the admin pool and event listener', async () => {
  const adminOffline = createHttpServer({
    marketplace: fakeMarketplace(),
    admin: fakeAdmin(async () => {
      throw new Error('admin offline');
    }),
    eventBroker: fakeEventSource(true),
    logger: false
  });
  assert.equal(
    (await adminOffline.inject({ method: 'GET', url: '/readyz' })).statusCode,
    503
  );
  await adminOffline.close();

  const listenerOffline = createHttpServer({
    marketplace: fakeMarketplace(),
    admin: fakeAdmin(),
    eventBroker: fakeEventSource(false),
    logger: false
  });
  assert.equal(
    (await listenerOffline.inject({ method: 'GET', url: '/readyz' })).statusCode,
    503
  );
  await listenerOffline.close();
});

test('closes and cleans up an SSE connection when event replay fails', async () => {
  let rejectReplay: (error: Error) => void = () => {};
  const replay = new Promise<MarketplaceEvent[]>((_resolve, reject) => {
    rejectReplay = reject;
  });
  let receiveEvent: ((event: MarketplaceEvent) => void) | undefined;
  let markSubscribed: () => void = () => {};
  const subscribed = new Promise<void>((resolve) => {
    markSubscribed = resolve;
  });
  let unsubscribeCount = 0;
  const eventBroker: MarketplaceEventSource = {
    isReady: () => true,
    subscribe: (handler) => {
      receiveEvent = handler;
      markSubscribed();
      return () => {
        unsubscribeCount += 1;
      };
    }
  };
  const admin: AdminService = {
    ...fakeAdmin(),
    listEvents: async () => replay
  };
  const app = createHttpServer({
    marketplace: fakeMarketplace(),
    admin,
    eventBroker,
    logger: false
  });
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_000);

  try {
    const responsePromise = fetch(`${address}/api/v1/admin/events`, {
      headers: { 'last-event-id': '10' },
      signal: controller.signal
    });
    await subscribed;
    receiveEvent?.({
      id: '11',
      type: 'bid.updated',
      entityType: 'bid',
      entityId: 'bid_1234567890abcdef',
      payload: {},
      occurredAt: new Date(0)
    });
    rejectReplay(new Error('replay unavailable'));

    const response = await responsePromise;
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/event-stream');
    assert.equal(await response.text(), '');
    assert.equal(unsubscribeCount, 1);
  } finally {
    clearTimeout(timeout);
    await app.close();
  }
});

test('lists creators through the repository boundary', async () => {
  const creators = [
    {
      id: 'cr_1234567890abcdef',
      displayName: 'Ava',
      genre: 'electronic',
      followerCount: 100_000,
      engagementRate: '6.5000'
    }
  ];
  const app = createHttpServer({
    marketplace: fakeMarketplace({ listCreators: async () => creators }),
    logger: false
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/creators'
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { data: creators });

  await app.close();
});

test('rejects malformed public identifiers before querying', async () => {
  let called = false;
  const app = createHttpServer({
    marketplace: fakeMarketplace({
      listCampaignMatches: async () => {
        called = true;
        return [];
      }
    }),
    logger: false
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/creators/not-an-id/matches'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'invalid_request');
  assert.equal(called, false);

  await app.close();
});

test('requires bid amounts to be decimal strings', async () => {
  let called = false;
  const app = createHttpServer({
    marketplace: fakeMarketplace({
      upsertBid: async () => {
        called = true;
        return fakeBid;
      }
    }),
    logger: false
  });

  const response = await app.inject({
    method: 'PUT',
    url: '/api/v1/creators/cr_1234567890abcdef/bids/cmp_1234567890abcdef',
    payload: { amount: 12.5 }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'invalid_request');
  assert.equal(called, false);

  await app.close();
});

test('maps known database state errors to an API conflict', async () => {
  const databaseError = Object.assign(new Error('campaign is closed'), {
    code: '55000'
  });
  const app = createHttpServer({
    marketplace: fakeMarketplace({
      upsertBid: async () => {
        throw databaseError;
      }
    }),
    logger: false
  });

  const response = await app.inject({
    method: 'PUT',
    url: '/api/v1/creators/cr_1234567890abcdef/bids/cmp_1234567890abcdef',
    payload: { amount: '12.50' }
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), {
    error: {
      code: 'campaign_unavailable',
      message: 'The campaign is not available for bidding.'
    }
  });

  await app.close();
});
