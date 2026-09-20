import type { Pool, QueryResultRow } from 'pg';

import type {
  AdminCampaign,
  AdminCampaignDetail,
  AdminCreator,
  AdminService,
  AdminSummary,
  Asset,
  CreateCampaignInput,
  CreateCreatorInput,
  MarketplaceEvent
} from './admin-contracts.js';
import { formatAmount, type ClosedCampaign } from './marketplace.js';

interface EventRow extends QueryResultRow {
  event_id: string;
  event_type: string;
  entity_type: string;
  entity_public_id: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
}

export class AdminRepository implements AdminService {
  constructor(private readonly pool: Pool) {}

  async checkConnection(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  private async jsonQuery<T>(text: string, values: unknown[] = []): Promise<T> {
    const result = await this.pool.query<{ value: T }>(text, values);
    const row = result.rows[0];
    if (!row) throw new Error('database function did not return a value');
    return row.value;
  }

  async summary(): Promise<AdminSummary> {
    const value = await this.jsonQuery<AdminSummary>(
      'SELECT api.admin_summary() AS value'
    );
    return {
      ...value,
      budgets: value.budgets.map((item) => ({
        ...item,
        openBudget: formatAmount(item.openBudget, item.decimalPlaces),
        awardedAmount: formatAmount(item.awardedAmount, item.decimalPlaces)
      }))
    };
  }

  async listCampaigns(): Promise<AdminCampaign[]> {
    const values = await this.jsonQuery<AdminCampaign[]>(
      'SELECT api.admin_list_campaigns() AS value'
    );
    return values.map((value) => ({
      ...value,
      budget: {
        ...value.budget,
        amount: formatAmount(value.budget.amount, value.budget.decimalPlaces)
      },
      awardedAmount: formatAmount(
        value.awardedAmount,
        value.budget.decimalPlaces
      )
    }));
  }

  async campaignDetail(id: string): Promise<AdminCampaignDetail> {
    const value = await this.jsonQuery<AdminCampaignDetail>(
      'SELECT api.admin_campaign_detail($1) AS value',
      [id]
    );
    return {
      ...value,
      budget: {
        ...value.budget,
        amount: formatAmount(value.budget.amount, value.budget.decimalPlaces)
      },
      bids: value.bids.map((bid) => ({
        ...bid,
        amount: formatAmount(bid.amount, value.budget.decimalPlaces)
      }))
    };
  }

  listCreators(): Promise<AdminCreator[]> {
    return this.jsonQuery<AdminCreator[]>(
      'SELECT api.admin_list_creators() AS value'
    );
  }

  listAssets(): Promise<Asset[]> {
    return this.jsonQuery<Asset[]>('SELECT api.admin_list_assets() AS value');
  }

  createCampaign(input: CreateCampaignInput): Promise<string> {
    return this.jsonQuery<string>(
      'SELECT api.admin_create_campaign($1,$2,$3,$4,$5,$6,$7,$8) AS value',
      [
        input.title,
        input.description,
        input.targetGenre,
        input.minimumFollowers,
        input.targetEngagementRate,
        input.asset,
        input.budget,
        input.biddingDeadline
      ]
    );
  }

  createCreator(input: CreateCreatorInput): Promise<string> {
    return this.jsonQuery<string>(
      'SELECT api.admin_create_creator($1,$2,$3,$4) AS value',
      [
        input.displayName,
        input.genre,
        input.followerCount,
        input.engagementRate
      ]
    );
  }

  async processDue(batchSize: number): Promise<ClosedCampaign[]> {
    const result = await this.pool.query<ClosedCampaign>(
      'SELECT * FROM api.admin_process_due_campaigns($1)',
      [batchSize]
    );
    return result.rows;
  }

  async listEvents(afterId: string, limit = 100): Promise<MarketplaceEvent[]> {
    const result = await this.pool.query<EventRow>(
      'SELECT * FROM api.admin_list_events($1, $2)',
      [afterId, limit]
    );
    return result.rows.map(mapEvent);
  }

  async recentEvents(limit = 100): Promise<MarketplaceEvent[]> {
    const result = await this.pool.query<EventRow>(
      'SELECT * FROM api.admin_recent_events($1)',
      [limit]
    );
    return result.rows.map(mapEvent);
  }
}

function mapEvent(row: EventRow): MarketplaceEvent {
  return {
    id: row.event_id,
    type: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_public_id,
    payload: row.payload,
    occurredAt: row.occurred_at
  };
}
