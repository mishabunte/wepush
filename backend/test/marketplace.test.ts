import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';

import { formatAmount, MarketplaceRepository } from '../src/marketplace.js';

test('formats exact database amounts at asset precision', () => {
  assert.equal(formatAmount('12.500000000000000000', 2), '12.50');
  assert.equal(formatAmount('0.000000010000000000', 8), '0.00000001');
  assert.equal(formatAmount('1.000000000000000001', 18), '1.000000000000000001');
  assert.equal(formatAmount('42.000000000000000000', 0), '42');
});

test('repository only queries api schema functions', async () => {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const pool = {
    query: async (text: string, values?: unknown[]) => {
      queries.push({ text, values });
      return { rows: [] };
    }
  };
  const repository = new MarketplaceRepository(pool as unknown as Pool);

  await repository.listCreators();
  await repository.listCampaignMatches('cr_1234567890abcdef');
  await repository.listCreatorBids('cr_1234567890abcdef');
  await repository.closeDueCampaigns(50);

  assert.equal(queries.length, 4);
  for (const query of queries) {
    assert.match(query.text, /FROM api\./);
    assert.doesNotMatch(query.text, /marketplace\./);
  }
});
