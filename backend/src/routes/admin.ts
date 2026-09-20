import type { FastifyInstance } from 'fastify';

import type {
  AdminService,
  CreateCampaignInput,
  CreateCreatorInput
} from '../admin-contracts.js';
import {
  campaignParamsSchema,
  decimalStringSchema,
  type CampaignParams
} from '../http/schemas.js';

const campaignBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'description',
    'targetGenre',
    'minimumFollowers',
    'targetEngagementRate',
    'asset',
    'budget',
    'biddingDeadline'
  ],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', minLength: 1, maxLength: 2000 },
    targetGenre: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,31}$' },
    minimumFollowers: { type: 'integer', minimum: 0 },
    targetEngagementRate: decimalStringSchema,
    asset: { type: 'string', pattern: '^[A-Z][A-Z0-9_-]{1,15}$' },
    budget: decimalStringSchema,
    biddingDeadline: { type: 'string', format: 'date-time' }
  }
} as const;

const creatorBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['displayName', 'genre', 'followerCount', 'engagementRate'],
  properties: {
    displayName: { type: 'string', minLength: 1, maxLength: 200 },
    genre: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,31}$' },
    followerCount: { type: 'integer', minimum: 0 },
    engagementRate: decimalStringSchema
  }
} as const;

export function registerAdminRoutes(
  app: FastifyInstance,
  admin: AdminService
): void {
  app.get('/api/v1/admin/summary', async () => ({ data: await admin.summary() }));
  app.get('/api/v1/admin/campaigns', async () => ({ data: await admin.listCampaigns() }));
  app.get<{ Params: CampaignParams }>(
    '/api/v1/admin/campaigns/:campaignId',
    { schema: { params: campaignParamsSchema } },
    async (request) => ({ data: await admin.campaignDetail(request.params.campaignId) })
  );
  app.get('/api/v1/admin/creators', async () => ({ data: await admin.listCreators() }));
  app.get('/api/v1/admin/assets', async () => ({ data: await admin.listAssets() }));

  app.post<{ Body: CreateCampaignInput }>(
    '/api/v1/admin/campaigns',
    { schema: { body: campaignBodySchema } },
    async (request, reply) =>
      reply.code(201).send({ data: { id: await admin.createCampaign(request.body) } })
  );

  app.post<{ Body: CreateCreatorInput }>(
    '/api/v1/admin/creators',
    { schema: { body: creatorBodySchema } },
    async (request, reply) =>
      reply.code(201).send({ data: { id: await admin.createCreator(request.body) } })
  );

  app.post('/api/v1/admin/auctions/process-due', async () => ({
    data: await admin.processDue(50)
  }));
}
