import type { FastifyInstance } from 'fastify';

import type { MarketplaceService } from '../marketplace.js';
import {
  bidBodySchema,
  bidParamsSchema,
  creatorParamsSchema,
  type BidBody,
  type BidParams,
  type CreatorParams
} from '../http/schemas.js';

export function registerCreatorRoutes(
  app: FastifyInstance,
  marketplace: MarketplaceService
): void {
  app.get('/api/v1/creators', async () => ({
    data: await marketplace.listCreators()
  }));

  app.get<{ Params: CreatorParams }>(
    '/api/v1/creators/:creatorId/matches',
    { schema: { params: creatorParamsSchema } },
    async (request) => ({
      data: await marketplace.listCampaignMatches(request.params.creatorId)
    })
  );

  app.get<{ Params: CreatorParams }>(
    '/api/v1/creators/:creatorId/bids',
    { schema: { params: creatorParamsSchema } },
    async (request) => ({
      data: await marketplace.listCreatorBids(request.params.creatorId)
    })
  );

  app.put<{ Params: BidParams; Body: BidBody }>(
    '/api/v1/creators/:creatorId/bids/:campaignId',
    { schema: { params: bidParamsSchema, body: bidBodySchema } },
    async (request, reply) => {
      const bid = await marketplace.upsertBid(
        request.params.creatorId,
        request.params.campaignId,
        request.body.amount
      );
      return reply.code(200).send({ data: bid });
    }
  );
}
