import Fastify from 'fastify';
import type { FastifyError, FastifyInstance } from 'fastify';

import type { MarketplaceService } from './marketplace.js';
import type {
  AdminService,
  MarketplaceEventSource
} from './admin-contracts.js';
import { databaseErrorResponse } from './http/errors.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerCreatorRoutes } from './routes/creators.js';
import { registerEventRoutes } from './routes/events.js';
import { registerHealthRoutes } from './routes/health.js';

interface BuildAppOptions {
  marketplace: MarketplaceService;
  admin?: AdminService;
  eventBroker?: MarketplaceEventSource;
  logger?: boolean;
  trustProxy?: boolean;
  logLevel?: string;
}

export function createHttpServer({
  marketplace,
  admin,
  eventBroker,
  logger = true,
  trustProxy = false,
  logLevel = 'info'
}: BuildAppOptions): FastifyInstance {
  const app = Fastify({
    logger: logger ? { level: logLevel } : false,
    trustProxy,
    bodyLimit: 16 * 1024,
    requestIdHeader: 'x-request-id',
    ajv: {
      customOptions: {
        coerceTypes: false
      }
    }
  });

  registerHealthRoutes(app, { marketplace, admin, eventBroker });
  registerCreatorRoutes(app, marketplace);
  if (admin) registerAdminRoutes(app, admin);
  if (admin && eventBroker) registerEventRoutes(app, admin, eventBroker);

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({
      error: { code: 'not_found', message: 'route not found' }
    });
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({
        error: {
          code: 'invalid_request',
          message: error.message
        }
      });
    }

    const mapped = databaseErrorResponse(error);
    if (mapped) return reply.code(mapped.statusCode).send(mapped.body);

    request.log.error({ err: error }, 'request failed');
    return reply.code(500).send({
      error: {
        code: 'internal_error',
        message: 'an unexpected error occurred'
      }
    });
  });

  return app;
}
