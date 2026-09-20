import type { FastifyInstance } from 'fastify';

import type {
  AdminService,
  MarketplaceEvent,
  MarketplaceEventSource
} from '../admin-contracts.js';

export function registerEventRoutes(
  app: FastifyInstance,
  admin: AdminService,
  eventBroker: MarketplaceEventSource
): void {
  app.get('/api/v1/admin/events', async (request, reply) => {
    const rawHeader = request.headers['last-event-id'];
    const hasCursor = typeof rawHeader === 'string' && /^\d+$/.test(rawHeader);
    const afterId = hasCursor ? rawHeader : '0';

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    let cursor = BigInt(afterId);
    let replaying = true;
    let closed = false;
    let heartbeat: NodeJS.Timeout | undefined;
    const queued: MarketplaceEvent[] = [];
    const send = (event: MarketplaceEvent) => {
      if (closed || reply.raw.destroyed || reply.raw.writableEnded) return;
      if (BigInt(event.id) <= cursor) return;
      cursor = BigInt(event.id);
      reply.raw.write(
        `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
      );
    };
    const unsubscribe = eventBroker.subscribe((event) => {
      if (replaying) queued.push(event);
      else send(event);
    });
    const cleanup = () => {
      if (closed) return;
      closed = true;
      replaying = false;
      queued.length = 0;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
    };
    reply.raw.once('close', cleanup);

    try {
      if (!hasCursor) {
        (await admin.recentEvents(100)).forEach(send);
      } else {
        let replayAfter = afterId;
        for (;;) {
          const replay = await admin.listEvents(replayAfter, 100);
          replay.forEach(send);
          if (replay.length < 100) break;
          replayAfter = replay.at(-1)?.id ?? replayAfter;
        }
      }
      if (closed) return;
      replaying = false;
      queued
        .sort((left, right) => (BigInt(left.id) < BigInt(right.id) ? -1 : 1))
        .forEach(send);
      queued.length = 0;
    } catch (error) {
      request.log.error({ err: error }, 'event replay failed');
      cleanup();
      if (!reply.raw.destroyed && !reply.raw.writableEnded) reply.raw.end();
      return;
    }

    heartbeat = setInterval(() => {
      if (!closed && !reply.raw.destroyed && !reply.raw.writableEnded) {
        reply.raw.write(': heartbeat\n\n');
      }
    }, 15_000);
  });
}
