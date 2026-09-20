import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import type { MarketplaceEvent } from '../src/admin-contracts.js';
import { MarketplaceEventBroker } from '../src/event-broker.js';

class FakeListenerClient extends EventEmitter {
  readonly queries: string[] = [];

  async connect(): Promise<void> {}

  async query(text: string): Promise<void> {
    this.queries.push(text);
  }

  async end(): Promise<void> {}
}

function event(id: string): MarketplaceEvent {
  return {
    id,
    type: 'bid.updated',
    entityType: 'bid',
    entityId: `bid_${id.padStart(16, '0')}`,
    payload: {},
    occurredAt: new Date(0)
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 1_000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('condition was not met');
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

test('event broker reconnects, replays missed events, and deduplicates notifications', async () => {
  const events = [event('1')];
  const clients: FakeListenerClient[] = [];
  const repository = {
    recentEvents: async () => events.slice(-1),
    listEvents: async (afterId: string, limit = 100) =>
      events.filter((item) => BigInt(item.id) > BigInt(afterId)).slice(0, limit)
  };
  const broker = new MarketplaceEventBroker('unused', repository, {
    clientFactory: () => {
      const client = new FakeListenerClient();
      clients.push(client);
      return client;
    },
    reconnectBaseDelayMs: 1,
    reconnectMaxDelayMs: 1,
    random: () => 0,
    log: () => {}
  });

  await broker.start();
  assert.equal(broker.isReady(), true);
  assert.deepEqual(clients[0]?.queries, ['LISTEN marketplace_events']);

  const received: string[] = [];
  const unsubscribe = broker.subscribe((item) => received.push(item.id));
  events.push(event('2'));
  clients[0]?.emit('notification', { payload: '2' });
  clients[0]?.emit('notification', { payload: '2' });
  await waitFor(() => received.length === 1);
  assert.deepEqual(received, ['2']);

  clients[0]?.emit('error', new Error('connection lost'));
  events.push(event('3'));
  await waitFor(() => clients.length === 2 && broker.isReady());
  await waitFor(() => received.includes('3'));
  assert.deepEqual(received, ['2', '3']);

  unsubscribe();
  await broker.close();
  assert.equal(broker.isReady(), false);
});
