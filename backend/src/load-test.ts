import { createRandom, generateBidAmount, generateCampaign, generateCreator } from './mock-data.js';

interface ApiEnvelope<T> { data: T }
interface CreatorResult { id: string }
interface CampaignResult { id: string }
interface Match { id: string; budget: { amount: string; decimalPlaces: number }; bid: { id: string } | null }

function integerEnv(name: string, fallback: number, minimum = 1): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum) throw new Error(`${name} must be an integer >= ${minimum}`);
  return value;
}

const config = {
  baseUrl: (process.env.LOAD_BASE_URL || 'http://localhost:8080').replace(/\/$/, ''),
  durationMs: process.env.LOAD_DURATION_SECONDS
    ? integerEnv('LOAD_DURATION_SECONDS', 60) * 1_000
    : integerEnv('LOAD_DURATION_MINUTES', 60) * 60_000,
  creatorTarget: integerEnv('LOAD_CREATORS', 10_000, 0),
  campaignTarget: integerEnv('LOAD_CAMPAIGNS', 1_000, 0),
  bidTarget: integerEnv('LOAD_BIDS', 9_000, 0),
  seed: integerEnv('LOAD_SEED', 20_260_919, 0),
  maxRetries: integerEnv('LOAD_RETRIES', 3, 0)
};

const creatorRandom = createRandom(config.seed);
const campaignRandom = createRandom(config.seed ^ 0x9e3779b9);
const bidRandom = createRandom(config.seed ^ 0x85ebca6b);
const creatorIds: string[] = [];
const placedBids: Array<{ creatorId: string; campaignId: string; budget: string; decimalPlaces: number }> = [];
const counters = { creators: 0, campaigns: 0, bids: 0, revisions: 0, skippedBids: 0, errors: 0 };
let stopping = false;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${config.baseUrl}${path}`, { ...init, headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) } });
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${path}: ${response.status} ${await response.text()}`);
  return ((await response.json()) as ApiEnvelope<T>).data;
}

async function retry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    try { return await operation(); } catch (error) {
      lastError = error;
      if (attempt < config.maxRetries) await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }
  throw lastError;
}

async function pace(total: number, start: number, duration: number, operation: (index: number) => Promise<void>): Promise<void> {
  if (total === 0) return;
  for (let index = 0; index < total && !stopping; index += 1) {
    const dueAt = start + Math.floor((index * duration) / total);
    const delay = dueAt - Date.now();
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    try { await retry(() => operation(index)); } catch (error) {
      counters.errors += 1;
      process.stderr.write(`${JSON.stringify({ level: 'error', index, message: error instanceof Error ? error.message : String(error), timestamp: new Date().toISOString() })}\n`);
    }
  }
}

async function createCreator(index: number) {
  const result = await request<CreatorResult>('/api/v1/admin/creators', { method: 'POST', body: JSON.stringify(generateCreator(index, creatorRandom)) });
  creatorIds.push(result.id); counters.creators += 1;
}

async function createCampaign(index: number) {
  const campaign = generateCampaign(index, campaignRandom);
  const { assetDecimalPlaces: _, ...body } = campaign;
  await request<CampaignResult>('/api/v1/admin/campaigns', { method: 'POST', body: JSON.stringify(body) });
  counters.campaigns += 1;
}

async function placeBid(index: number) {
  if (creatorIds.length === 0) throw new Error('no creators are available yet');

  if (index % 4 === 3 && placedBids.length > 0) {
    const pairIndex = Math.floor(bidRandom() * placedBids.length);
    const pair = placedBids[pairIndex];
    if (pair) {
      try {
        const amount = generateBidAmount(pair.budget, pair.decimalPlaces, bidRandom);
        await request(`/api/v1/creators/${pair.creatorId}/bids/${pair.campaignId}`, { method: 'PUT', body: JSON.stringify({ amount }) });
        counters.bids += 1; counters.revisions += 1; return;
      } catch {
        placedBids.splice(pairIndex, 1);
      }
    }
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const creatorId = creatorIds[Math.floor(bidRandom() * creatorIds.length)];
    if (!creatorId) continue;
    const matches = await request<Match[]>(`/api/v1/creators/${creatorId}/matches`);
    const available = matches.filter((match) => !match.bid);
    const match = available[Math.floor(bidRandom() * available.length)];
    if (!match) continue;
    const amount = generateBidAmount(match.budget.amount, match.budget.decimalPlaces, bidRandom);
    await request(`/api/v1/creators/${creatorId}/bids/${match.id}`, { method: 'PUT', body: JSON.stringify({ amount }) });
    placedBids.push({ creatorId, campaignId: match.id, budget: match.budget.amount, decimalPlaces: match.budget.decimalPlaces });
    counters.bids += 1; return;
  }
  counters.skippedBids += 1;
  throw new Error('no eligible campaign match found after 10 creator selections');
}

function logProgress(startedAt: number) {
  process.stdout.write(`${JSON.stringify({ event: 'load_progress', elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000), targets: { creators: config.creatorTarget, campaigns: config.campaignTarget, bids: config.bidTarget }, ...counters, timestamp: new Date().toISOString() })}\n`);
}

process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

const startedAt = Date.now();
process.stdout.write(`${JSON.stringify({ event: 'load_started', config, timestamp: new Date().toISOString() })}\n`);
const progress = setInterval(() => logProgress(startedAt), 5_000);

await Promise.all([
  pace(config.creatorTarget, startedAt, config.durationMs, createCreator),
  pace(config.campaignTarget, startedAt, config.durationMs, createCampaign),
  pace(config.bidTarget, startedAt + 5_000, Math.max(1, config.durationMs - 5_000), placeBid)
]);

clearInterval(progress);
logProgress(startedAt);
process.stdout.write(`${JSON.stringify({ event: 'load_finished', interrupted: stopping, ...counters, timestamp: new Date().toISOString() })}\n`);
if (counters.errors > 0) process.exitCode = 1;
