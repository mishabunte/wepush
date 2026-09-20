import type { Pool, QueryResultRow } from 'pg';

export interface Creator {
  id: string;
  displayName: string;
  genre: string;
  followerCount: number;
  engagementRate: string;
}

export interface AssetAmount {
  value: string;
  asset: string;
  symbol?: string;
  decimalPlaces?: number;
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
  biddingDeadline: Date;
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
  campaign: {
    id: string;
    title: string;
  };
  amount: Required<AssetAmount>;
  fit: {
    score: string;
    breakdown: Record<string, unknown>;
  };
  status: string;
  submittedAt: Date;
  updatedAt: Date;
  finalizedAt: Date | null;
}

export interface UpsertedBid {
  id: string;
  campaignId: string;
  creatorId: string;
  amount: AssetAmount;
  fit: {
    score: string;
    breakdown: Record<string, unknown>;
  };
  status: string;
  submittedAt: Date;
  updatedAt: Date;
}

export interface ClosedCampaign {
  campaign_id: string;
  winning_bid_count: number;
  losing_bid_count: number;
  awarded_amount: string;
  remaining_budget: string;
}

export interface MarketplaceService {
  checkConnection(): Promise<void>;
  listCreators(): Promise<Creator[]>;
  listCampaignMatches(creatorId: string): Promise<CampaignMatch[]>;
  listCreatorBids(creatorId: string): Promise<CreatorBid[]>;
  upsertBid(
    creatorId: string,
    campaignId: string,
    amount: string
  ): Promise<UpsertedBid>;
  closeDueCampaigns(batchSize: number): Promise<ClosedCampaign[]>;
}

interface CreatorRow extends QueryResultRow {
  creator_id: string;
  display_name: string;
  genre: string;
  follower_count: string;
  engagement_rate: string;
}

interface MatchRow extends QueryResultRow {
  campaign_id: string;
  title: string;
  description: string;
  target_genre: string;
  minimum_followers: string;
  target_engagement_rate: string;
  budget: string;
  asset_code: string;
  asset_symbol: string;
  asset_decimal_places: number;
  bidding_deadline: Date;
  fit_score: string;
  fit_breakdown: Record<string, unknown>;
  bid_id: string | null;
  bid_amount: string | null;
  bid_status: string | null;
}

interface BidRow extends QueryResultRow {
  bid_id: string;
  campaign_id: string;
  campaign_title: string;
  amount: string;
  asset_code: string;
  asset_symbol: string;
  asset_decimal_places: number;
  fit_score: string;
  fit_breakdown: Record<string, unknown>;
  status: string;
  submitted_at: Date;
  updated_at: Date;
  finalized_at: Date | null;
}

interface UpsertedBidRow extends QueryResultRow {
  bid_id: string;
  campaign_id: string;
  creator_id: string;
  amount: string;
  asset_code: string;
  fit_score: string;
  fit_breakdown: Record<string, unknown>;
  status: string;
  submitted_at: Date;
  updated_at: Date;
}

interface ClosedCampaignRow extends QueryResultRow, ClosedCampaign {}

export function formatAmount(value: string, decimalPlaces: number): string {
  const [integerPart = '0', fractionPart = ''] = value.split('.');
  if (decimalPlaces === 0) return integerPart;
  return `${integerPart}.${fractionPart.padEnd(decimalPlaces, '0').slice(0, decimalPlaces)}`;
}

function mapCreator(row: CreatorRow): Creator {
  return {
    id: row.creator_id,
    displayName: row.display_name,
    genre: row.genre,
    followerCount: Number(row.follower_count),
    engagementRate: row.engagement_rate
  };
}

function mapMatch(row: MatchRow): CampaignMatch {
  const decimals = Number(row.asset_decimal_places);
  return {
    id: row.campaign_id,
    title: row.title,
    description: row.description,
    requirements: {
      genre: row.target_genre,
      minimumFollowers: Number(row.minimum_followers),
      targetEngagementRate: row.target_engagement_rate
    },
    budget: {
      amount: formatAmount(row.budget, decimals),
      asset: row.asset_code,
      symbol: row.asset_symbol,
      decimalPlaces: decimals
    },
    biddingDeadline: row.bidding_deadline,
    fit: {
      score: row.fit_score,
      breakdown: row.fit_breakdown
    },
    bid: row.bid_id
      ? {
          id: row.bid_id,
          amount: formatAmount(row.bid_amount ?? '0', decimals),
          status: row.bid_status ?? 'pending'
        }
      : null
  };
}

function mapBid(row: BidRow): CreatorBid {
  const decimals = Number(row.asset_decimal_places);
  return {
    id: row.bid_id,
    campaign: {
      id: row.campaign_id,
      title: row.campaign_title
    },
    amount: {
      value: formatAmount(row.amount, decimals),
      asset: row.asset_code,
      symbol: row.asset_symbol,
      decimalPlaces: decimals
    },
    fit: {
      score: row.fit_score,
      breakdown: row.fit_breakdown
    },
    status: row.status,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    finalizedAt: row.finalized_at
  };
}

export class MarketplaceRepository implements MarketplaceService {
  constructor(private readonly pool: Pool) {}

  async checkConnection(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async listCreators(): Promise<Creator[]> {
    const result = await this.pool.query<CreatorRow>(
      'SELECT * FROM api.list_creators()'
    );
    return result.rows.map(mapCreator);
  }

  async listCampaignMatches(creatorId: string): Promise<CampaignMatch[]> {
    const result = await this.pool.query<MatchRow>(
      'SELECT * FROM api.list_campaign_matches($1)',
      [creatorId]
    );
    return result.rows.map(mapMatch);
  }

  async listCreatorBids(creatorId: string): Promise<CreatorBid[]> {
    const result = await this.pool.query<BidRow>(
      'SELECT * FROM api.list_creator_bids($1)',
      [creatorId]
    );
    return result.rows.map(mapBid);
  }

  async upsertBid(
    creatorId: string,
    campaignId: string,
    amount: string
  ): Promise<UpsertedBid> {
    const result = await this.pool.query<UpsertedBidRow>(
      'SELECT * FROM api.upsert_bid($1, $2, $3::numeric)',
      [creatorId, campaignId, amount]
    );
    const row = result.rows[0];
    if (!row) throw new Error('database did not return the upserted bid');

    return {
      id: row.bid_id,
      campaignId: row.campaign_id,
      creatorId: row.creator_id,
      amount: {
        value: amount,
        asset: row.asset_code
      },
      fit: {
        score: row.fit_score,
        breakdown: row.fit_breakdown
      },
      status: row.status,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at
    };
  }

  async closeDueCampaigns(batchSize: number): Promise<ClosedCampaign[]> {
    const result = await this.pool.query<ClosedCampaignRow>(
      'SELECT * FROM api.close_due_campaigns($1)',
      [batchSize]
    );
    return result.rows;
  }
}
