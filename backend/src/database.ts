import pg from 'pg';

const { Pool } = pg;

interface DatabasePoolOptions {
  connectionString: string;
  max: number;
  applicationName: string;
  connectionTimeoutMillis?: number;
}

export function createDatabasePool({
  connectionString,
  max,
  applicationName,
  connectionTimeoutMillis = 5_000
}: DatabasePoolOptions): pg.Pool {
  const pool = new Pool({
    connectionString,
    max,
    application_name: applicationName,
    connectionTimeoutMillis,
    idleTimeoutMillis: 30_000,
    allowExitOnIdle: false
  });

  pool.on('error', (error) => {
    process.stderr.write(
      `${JSON.stringify({
        level: 'error',
        event: 'database_pool_error',
        message: error.message,
        timestamp: new Date().toISOString()
      })}\n`
    );
  });

  return pool;
}
