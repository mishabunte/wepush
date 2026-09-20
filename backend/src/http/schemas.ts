export interface CreatorParams {
  creatorId: string;
}

export interface BidParams extends CreatorParams {
  campaignId: string;
}

export interface CampaignParams {
  campaignId: string;
}

export interface BidBody {
  amount: string;
}

export const creatorIdPattern = '^cr_[A-Za-z0-9_-]{16}$';
export const campaignIdPattern = '^cmp_[A-Za-z0-9_-]{16}$';
export const amountPattern = '^(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$';

export const decimalStringSchema = {
  type: 'string',
  minLength: 1,
  maxLength: 58,
  pattern: amountPattern
} as const;

export const creatorParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['creatorId'],
  properties: {
    creatorId: { type: 'string', pattern: creatorIdPattern }
  }
} as const;

export const campaignParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['campaignId'],
  properties: {
    campaignId: { type: 'string', pattern: campaignIdPattern }
  }
} as const;

export const bidParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['creatorId', 'campaignId'],
  properties: {
    creatorId: { type: 'string', pattern: creatorIdPattern },
    campaignId: { type: 'string', pattern: campaignIdPattern }
  }
} as const;

export const bidBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['amount'],
  properties: { amount: decimalStringSchema }
} as const;
