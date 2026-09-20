import type {
  AdminCampaign,
  AdminCampaignDetail,
  AdminCreator,
  AdminSummary,
  Asset,
  CampaignMatch,
  ClosedCampaign,
  Creator,
  CreatorBid
} from './types';

interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorEnvelope {
  error?: { code?: string; message?: string };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers
    }
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorEnvelope;
    throw new ApiError(
      body.error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      body.error?.code
    );
  }

  return ((await response.json()) as ApiEnvelope<T>).data;
}

export const marketplaceApi = {
  listCreators: (signal?: AbortSignal) =>
    request<Creator[]>('/api/v1/creators', { signal }),
  listMatches: (creatorId: string, signal?: AbortSignal) =>
    request<CampaignMatch[]>(`/api/v1/creators/${creatorId}/matches`, {
      signal
    }),
  listBids: (creatorId: string, signal?: AbortSignal) =>
    request<CreatorBid[]>(`/api/v1/creators/${creatorId}/bids`, { signal }),
  saveBid: (
    creatorId: string,
    campaignId: string,
    amount: string,
    signal?: AbortSignal
  ) =>
    request(`/api/v1/creators/${creatorId}/bids/${campaignId}`, {
      method: 'PUT',
      body: JSON.stringify({ amount }),
      signal
    })
};

export interface NewCampaign {
  title: string;
  description: string;
  targetGenre: string;
  minimumFollowers: number;
  targetEngagementRate: string;
  asset: string;
  budget: string;
  biddingDeadline: string;
}

export const adminApi = {
  summary: (signal?: AbortSignal) =>
    request<AdminSummary>('/api/v1/admin/summary', { signal }),
  campaigns: (signal?: AbortSignal) =>
    request<AdminCampaign[]>('/api/v1/admin/campaigns', { signal }),
  campaign: (id: string, signal?: AbortSignal) =>
    request<AdminCampaignDetail>(`/api/v1/admin/campaigns/${id}`, { signal }),
  creators: (signal?: AbortSignal) =>
    request<AdminCreator[]>('/api/v1/admin/creators', { signal }),
  assets: (signal?: AbortSignal) =>
    request<Asset[]>('/api/v1/admin/assets', { signal }),
  createCampaign: (input: NewCampaign, signal?: AbortSignal) =>
    request<{ id: string }>('/api/v1/admin/campaigns', {
      method: 'POST',
      body: JSON.stringify(input),
      signal
    }),
  processDue: (signal?: AbortSignal) =>
    request<ClosedCampaign[]>('/api/v1/admin/auctions/process-due', {
      method: 'POST',
      signal
    })
};
