interface IntegerOptions {
  min?: number;
  max?: number;
}

export interface ApiConfig {
  host: string;
  port: number;
  databaseUrl: string;
  databasePoolSize: number;
  adminDatabaseUrl: string;
  trustProxy: boolean;
  logLevel: string;
}

export interface WorkerConfig {
  databaseUrl: string;
  databasePoolSize: number;
  intervalMs: number;
  batchSize: number;
  runOnce: boolean;
}

function integerFromEnv(
  value: string | undefined,
  fallback: number,
  name: string,
  { min = 1, max = 65535 }: IntegerOptions = {}
): number {
  if (value === undefined || value === '') return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }

  return parsed;
}

function booleanFromEnv(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('boolean environment values must be "true" or "false"');
}

export function loadApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    host: env.HOST || '0.0.0.0',
    port: integerFromEnv(env.PORT, 3000, 'PORT'),
    databaseUrl:
      env.DATABASE_URL ||
      'postgresql://wepush_web:wepush_web@localhost:5433/wepush',
    databasePoolSize: integerFromEnv(
      env.DB_POOL_SIZE,
      10,
      'DB_POOL_SIZE',
      { min: 1, max: 100 }
    ),
    adminDatabaseUrl:
      env.ADMIN_DATABASE_URL ||
      'postgresql://wepush_admin:wepush_admin@localhost:5433/wepush',
    trustProxy: booleanFromEnv(env.TRUST_PROXY, false),
    logLevel: env.LOG_LEVEL || 'info'
  };
}

export function loadWorkerConfig(
  env: NodeJS.ProcessEnv = process.env
): WorkerConfig {
  return {
    databaseUrl:
      env.WORKER_DATABASE_URL ||
      env.DATABASE_URL ||
      'postgresql://wepush_worker:wepush_worker@localhost:5433/wepush',
    databasePoolSize: integerFromEnv(
      env.DB_POOL_SIZE,
      2,
      'DB_POOL_SIZE',
      { min: 1, max: 20 }
    ),
    intervalMs: integerFromEnv(
      env.WORKER_INTERVAL_MS,
      10_000,
      'WORKER_INTERVAL_MS',
      { min: 250, max: 3_600_000 }
    ),
    batchSize: integerFromEnv(
      env.WORKER_BATCH_SIZE,
      50,
      'WORKER_BATCH_SIZE',
      { min: 1, max: 1000 }
    ),
    runOnce: booleanFromEnv(env.WORKER_RUN_ONCE, false)
  };
}
