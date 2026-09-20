import { loadWorkerConfig } from './config.js';
import { createDatabasePool } from './database.js';
import { MarketplaceRepository } from './marketplace.js';

const config = loadWorkerConfig();
const pool = createDatabasePool({
  connectionString: config.databaseUrl,
  max: config.databasePoolSize,
  applicationName: 'wepush-auction-worker'
});
const marketplace = new MarketplaceRepository(pool);

let running = false;
let stopping = false;
let timer: NodeJS.Timeout | undefined;

function errorDetails(error: unknown): { message: string; code?: string } {
  if (error instanceof Error) {
    const code = 'code' in error ? String(error.code) : undefined;
    return code ? { message: error.message, code } : { message: error.message };
  }
  return { message: String(error) };
}

function log(
  level: 'info' | 'error',
  event: string,
  details: Record<string, unknown> = {}
): void {
  process.stdout.write(
    `${JSON.stringify({
      level,
      event,
      ...details,
      timestamp: new Date().toISOString()
    })}\n`
  );
}

async function closeAuctions(): Promise<void> {
  if (running || stopping) return;
  running = true;
  const startedAt = Date.now();

  try {
    const campaigns = await marketplace.closeDueCampaigns(config.batchSize);
    log('info', 'auction_close_completed', {
      campaignCount: campaigns.length,
      durationMs: Date.now() - startedAt,
      campaigns
    });
  } catch (error) {
    log('error', 'auction_close_failed', {
      durationMs: Date.now() - startedAt,
      ...errorDetails(error)
    });
    if (config.runOnce) process.exitCode = 1;
  } finally {
    running = false;
  }
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (stopping) return;
  stopping = true;
  if (timer) clearInterval(timer);
  log('info', 'worker_shutdown', { signal });

  while (running) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  await pool.end();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

try {
  await marketplace.checkConnection();
  await closeAuctions();

  if (config.runOnce) {
    await pool.end();
  } else {
    timer = setInterval(closeAuctions, config.intervalMs);
    log('info', 'worker_started', {
      intervalMs: config.intervalMs,
      batchSize: config.batchSize
    });
  }
} catch (error) {
  log('error', 'worker_start_failed', {
    ...errorDetails(error)
  });
  await pool.end();
  process.exitCode = 1;
}
