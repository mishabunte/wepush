import pg from 'pg';
import type { Notification } from 'pg';

import type {
  AdminService,
  EventHandler,
  MarketplaceEventSource
} from './admin-contracts.js';

interface ListenerClient {
  connect(): Promise<unknown>;
  query(text: string): Promise<unknown>;
  end(): Promise<void>;
  on(event: 'notification', listener: (notification: Notification) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'end', listener: () => void): this;
}

interface EventBrokerOptions {
  clientFactory?: () => ListenerClient;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  random?: () => number;
  log?: (
    level: 'info' | 'error',
    event: string,
    details?: Record<string, unknown>
  ) => void;
}

export class MarketplaceEventBroker implements MarketplaceEventSource {
  private readonly handlers = new Set<EventHandler>();
  private readonly clientFactory: () => ListenerClient;
  private readonly reconnectBaseDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly random: () => number;
  private readonly log: NonNullable<EventBrokerOptions['log']>;
  private client: ListenerClient | undefined;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private connected = false;
  private stopping = false;
  private generation = 0;
  private reconnectAttempt = 0;
  private cursor = 0n;
  private drainPromise: Promise<void> | undefined;
  private drainAgain = false;

  constructor(
    connectionString: string,
    private readonly repository: Pick<
      AdminService,
      'listEvents' | 'recentEvents'
    >,
    options: EventBrokerOptions = {}
  ) {
    this.clientFactory =
      options.clientFactory ??
      (() =>
        new pg.Client({
          connectionString,
          application_name: 'wepush-event-listener'
        }));
    this.reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? 250;
    this.reconnectMaxDelayMs = options.reconnectMaxDelayMs ?? 10_000;
    this.random = options.random ?? Math.random;
    this.log = options.log ?? defaultEventLog;
  }

  isReady(): boolean {
    return this.connected;
  }

  async start(): Promise<void> {
    this.stopping = false;
    const latest = await this.repository.recentEvents(1);
    const latestId = latest.at(-1)?.id;
    if (latestId) this.cursor = BigInt(latestId);
    await this.connect();
  }

  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async close(): Promise<void> {
    this.stopping = true;
    this.connected = false;
    this.generation += 1;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    await this.drainPromise?.catch(() => undefined);
    const client = this.client;
    this.client = undefined;
    if (client) await client.end().catch(() => undefined);
  }

  private async connect(): Promise<void> {
    const client = this.clientFactory();
    const generation = ++this.generation;
    this.client = client;

    client.on('notification', () => this.queueDrain());
    client.on('error', (error) => {
      this.log('error', 'event_listener_error', { message: error.message });
      this.handleDisconnect(generation, client);
    });
    client.on('end', () => this.handleDisconnect(generation, client));

    try {
      await client.connect();
      await client.query('LISTEN marketplace_events');
      if (this.stopping || generation !== this.generation) {
        await client.end().catch(() => undefined);
        return;
      }
      this.connected = true;
      this.reconnectAttempt = 0;
      this.log('info', 'event_listener_connected');
      await this.ensureDrain();
    } catch (error) {
      if (this.client === client) this.client = undefined;
      this.connected = false;
      await client.end().catch(() => undefined);
      throw error;
    }
  }

  private handleDisconnect(
    generation: number,
    client: ListenerClient
  ): void {
    if (this.stopping || generation !== this.generation) return;
    this.connected = false;
    this.client = undefined;
    this.generation += 1;
    void client.end().catch(() => undefined);
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.stopping || this.reconnectTimer) return;
    const exponential = Math.min(
      this.reconnectMaxDelayMs,
      this.reconnectBaseDelayMs * 2 ** this.reconnectAttempt
    );
    const delay = Math.round(exponential * (0.75 + this.random() * 0.5));
    this.reconnectAttempt += 1;
    this.log('info', 'event_listener_reconnecting', { delayMs: delay });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect().catch((error: unknown) => {
        this.log('error', 'event_listener_reconnect_failed', {
          message: error instanceof Error ? error.message : String(error)
        });
        this.scheduleReconnect();
      });
    }, delay);
  }

  private queueDrain(): void {
    void this.ensureDrain();
  }

  private ensureDrain(): Promise<void> {
    if (this.drainPromise) {
      this.drainAgain = true;
      return this.drainPromise;
    }
    this.drainPromise = this.drain()
      .catch((error: unknown) => {
        this.log('error', 'event_delivery_failed', {
          message: error instanceof Error ? error.message : String(error)
        });
      })
      .finally(() => {
        this.drainPromise = undefined;
        if (this.drainAgain) {
          this.drainAgain = false;
          this.queueDrain();
        }
      });
    return this.drainPromise;
  }

  private async drain(): Promise<void> {
    for (;;) {
      const events = await this.repository.listEvents(this.cursor.toString(), 100);
      for (const event of events) {
        const eventId = BigInt(event.id);
        if (eventId <= this.cursor) continue;
        this.cursor = eventId;
        for (const handler of this.handlers) handler(event);
      }
      if (events.length < 100) return;
    }
  }
}

function defaultEventLog(
  level: 'info' | 'error',
  event: string,
  details: Record<string, unknown> = {}
): void {
  const output = level === 'error' ? process.stderr : process.stdout;
  output.write(
    `${JSON.stringify({
      level,
      event,
      ...details,
      timestamp: new Date().toISOString()
    })}\n`
  );
}
