import type { ClosedCampaign } from './marketplace.js';

export interface MarketplaceEvent {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

export interface Asset {
  code: string;
  symbol: string;
  kind: string;
  network: string | null;
  decimalPlaces: number;
}

export interface AdminBudget {
  asset: string;
  symbol: string;
  decimalPlaces: number;
  openBudget: string;
  awardedAmount: string;
}

export interface AdminSummary {
  creatorCount: number;
  openCampaignCount: number;
  pendingBidCount: number;
  recentlyClosedCount: number;
  generatedAt: string;
  budgets: AdminBudget[];
}

export interface AdminCampaign {
  id: string;
  title: string;
  description: string;
  targetGenre: string;
  minimumFollowers: number;
  targetEngagementRate: string;
  budget: {
    amount: string;
    asset: string;
    symbol: string;
    decimalPlaces: number;
  };
  biddingDeadline: string;
  status: 'open' | 'closed';
  closedAt: string | null;
  bidCount: number;
  winningBidCount: number;
  awardedAmount: string;
}

export interface AdminBid {
  id: string;
  creator: {
    id: string;
    displayName: string;
    followers: number;
    engagementRate: string;
  };
  amount: string;
  fitScore: string;
  selectionScore: string;
  selectionRank: number;
  provisional: boolean;
  status: string;
  submittedAt: string;
  updatedAt: string;
}

export interface AdminCampaignDetail extends AdminCampaign {
  bids: AdminBid[];
}

export interface AdminCreator {
  id: string;
  displayName: string;
  genre: string;
  followerCount: number;
  engagementRate: string;
  bidCount: number;
  winCount: number;
  createdAt: string;
}

export interface CreateCampaignInput {
  title: string;
  description: string;
  targetGenre: string;
  minimumFollowers: number;
  targetEngagementRate: string;
  asset: string;
  budget: string;
  biddingDeadline: string;
}

export interface CreateCreatorInput {
  displayName: string;
  genre: string;
  followerCount: number;
  engagementRate: string;
}

export interface AdminService {
  checkConnection(): Promise<void>;
  summary(): Promise<AdminSummary>;
  listCampaigns(): Promise<AdminCampaign[]>;
  campaignDetail(id: string): Promise<AdminCampaignDetail>;
  listCreators(): Promise<AdminCreator[]>;
  listAssets(): Promise<Asset[]>;
  createCampaign(input: CreateCampaignInput): Promise<string>;
  createCreator(input: CreateCreatorInput): Promise<string>;
  processDue(batchSize: number): Promise<ClosedCampaign[]>;
  listEvents(afterId: string, limit?: number): Promise<MarketplaceEvent[]>;
  recentEvents(limit?: number): Promise<MarketplaceEvent[]>;
}

export type EventHandler = (event: MarketplaceEvent) => void;

export interface MarketplaceEventSource {
  isReady(): boolean;
  subscribe(handler: EventHandler): () => void;
}
