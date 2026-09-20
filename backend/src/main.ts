import { createHttpServer } from './http-server.js';
import { loadApiConfig } from './config.js';
import { createDatabasePool } from './database.js';
import { MarketplaceRepository } from './marketplace.js';
import { AdminRepository } from './admin.js';
import { MarketplaceEventBroker } from './event-broker.js';

const config = loadApiConfig();
const pool = createDatabasePool({
  connectionString: config.databaseUrl,
  max: config.databasePoolSize,
  applicationName: 'wepush-api'
});
const marketplace = new MarketplaceRepository(pool);
const adminPool = createDatabasePool({ connectionString: config.adminDatabaseUrl,
  max: 5, applicationName: 'wepush-admin-api' });
const admin = new AdminRepository(adminPool);
const eventBroker = new MarketplaceEventBroker(config.adminDatabaseUrl, admin);
const app = createHttpServer({
  marketplace,
  admin,
  eventBroker,
  trustProxy: config.trustProxy,
  logLevel: config.logLevel
});

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, 'shutting down');

  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  await app.close();
  await eventBroker.close();
  await adminPool.end();
  await pool.end();
  clearTimeout(forceExit);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

try {
  await marketplace.checkConnection();
  await eventBroker.start();
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.fatal({ err: error }, 'failed to start API');
  await eventBroker.close();
  await pool.end();
  await adminPool.end();
  process.exitCode = 1;
}
