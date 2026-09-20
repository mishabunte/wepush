export interface Creator {
  id: string;
  displayName: string;
  genre: string;
  followerCount: number;
  engagementRate: string;
}

export interface CampaignMatch {
  id: string;
  title: string;
  description: string;
  requirements: {
    genre: string;
    minimumFollowers: number;
    targetEngagementRate: string;
  };
  budget: {
    amount: string;
    asset: string;
    symbol: string;
    decimalPlaces: number;
  };
  biddingDeadline: string;
  fit: {
    score: string;
    breakdown: Record<string, unknown>;
  };
  bid: {
    id: string;
    amount: string;
    status: string;
  } | null;
}

export interface CreatorBid {
  id: string;
  campaign: { id: string; title: string };
  amount: {
    value: string;
    asset: string;
    symbol: string;
    decimalPlaces: number;
  };
  fit: { score: string; breakdown: Record<string, unknown> };
  status: string;
  submittedAt: string;
  updatedAt: string;
  finalizedAt: string | null;
}

export interface Asset {
  code: string;
  symbol: string;
  kind: string;
  network: string | null;
  decimalPlaces: number;
}
export interface AdminSummary {
  creatorCount: number;
  openCampaignCount: number;
  pendingBidCount: number;
  recentlyClosedCount: number;
  generatedAt: string;
  budgets: Array<{
    asset: string;
    symbol: string;
    decimalPlaces: number;
    openBudget: string;
    awardedAmount: string;
  }>;
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
export interface AdminCreator extends Creator {
  bidCount: number;
  winCount: number;
  createdAt: string;
}
export interface MarketplaceEvent {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}
export interface ClosedCampaign {
  campaign_id: string;
  winning_bid_count: number;
  losing_bid_count: number;
  awarded_amount: string;
  remaining_budget: string;
}
