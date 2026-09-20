import type { FastifyInstance } from 'fastify';

import type {
  AdminService,
  MarketplaceEventSource
} from '../admin-contracts.js';
import type { MarketplaceService } from '../marketplace.js';

interface HealthDependencies {
  marketplace: MarketplaceService;
  admin?: AdminService;
  eventBroker?: MarketplaceEventSource;
}

export function registerHealthRoutes(
  app: FastifyInstance,
  { marketplace, admin, eventBroker }: HealthDependencies
): void {
  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/readyz', async (_request, reply) => {
    try {
      await Promise.all([
        marketplace.checkConnection(),
        ...(admin ? [admin.checkConnection()] : [])
      ]);
      if (eventBroker && !eventBroker.isReady()) {
        throw new Error('event listener is unavailable');
      }
      return { status: 'ready' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });
}
