import assert from 'node:assert/strict';
import test from 'node:test';

import { createRandom, formatUnits, generateBidAmount, generateCampaign, generateCreator, parseUnits } from '../src/mock-data.js';

test('mock records are deterministic for a seed', () => {
  const first = createRandom(42);
  const second = createRandom(42);
  assert.deepEqual(generateCreator(123, first), generateCreator(123, second));
  assert.deepEqual(generateCampaign(456, first, new Date('2026-01-01T00:00:00Z')),
    generateCampaign(456, second, new Date('2026-01-01T00:00:00Z')));
});

test('exact decimal units round-trip up to crypto precision', () => {
  const value = '19.123456789012345678';
  assert.equal(formatUnits(parseUnits(value, 18), 18), value);
});

test('generated bids are positive, exact, and below budget', () => {
  const random = createRandom(7);
  const budget = '0.50000000';
  const amount = generateBidAmount(budget, 8, random);
  assert.ok(parseUnits(amount, 8) > 0n);
  assert.ok(parseUnits(amount, 8) <= parseUnits(budget, 8));
  assert.match(amount, /^\d+\.\d{8}$/);
});
