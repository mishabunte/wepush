import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';

import type { MarketplaceEvent } from '../../types';

interface LiveEventsState {
  events: MarketplaceEvent[];
  connected: boolean;
  revision: number;
}

const LiveEventsContext = createContext<LiveEventsState | null>(null);
const eventTypes = [
  'creator.created',
  'campaign.created',
  'bid.created',
  'bid.updated',
  'bid.finalized',
  'campaign.closed'
];

export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<MarketplaceEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const source = new EventSource('/api/v1/admin/events');
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const receive = (message: MessageEvent<string>) => {
      try {
        const event = JSON.parse(message.data) as MarketplaceEvent;
        if (!event.id || !event.type) return;
        setEvents((current) =>
          [event, ...current.filter((item) => item.id !== event.id)].slice(
            0,
            30
          )
        );
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => setRevision((value) => value + 1), 100);
      } catch {
        // Ignore malformed events; the next durable event remains usable.
      }
    };

    eventTypes.forEach((type) =>
      source.addEventListener(type, receive as EventListener)
    );
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    return () => {
      source.close();
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, []);

  const value = useMemo(
    () => ({ events, connected, revision }),
    [events, connected, revision]
  );
  return (
    <LiveEventsContext.Provider value={value}>
      {children}
    </LiveEventsContext.Provider>
  );
}

export function useLiveEvents(): LiveEventsState {
  const value = useContext(LiveEventsContext);
  if (!value) throw new Error('useLiveEvents requires LiveEventsProvider');
  return value;
}
