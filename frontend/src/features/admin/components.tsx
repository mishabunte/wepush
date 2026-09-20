import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import type { AdminCampaign } from '../../types';
import { useLiveEvents } from './live-events';

export function AdminFrame({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { connected } = useLiveEvents();
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-5 border-b-2 border-ink pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-coral">
            {t('admin.eyebrow')}
          </p>
          <h1 className="mt-1 text-4xl font-black tracking-tight">
            {t('admin.title')}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 flex items-center gap-2 text-xs font-bold">
            <span
              className={`size-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-coral'}`}
            />
            {connected ? t('admin.live') : t('admin.reconnecting')}
          </span>
          <AdminNav />
        </div>
      </div>
      {children}
    </main>
  );
}

function AdminNav() {
  const { t } = useTranslation();
  const style = ({ isActive }: { isActive: boolean }) =>
    `rounded-full border-2 border-ink px-3 py-1.5 text-sm font-bold ${isActive ? 'bg-ink text-white' : 'bg-white'}`;
  return (
    <nav className="flex gap-2" aria-label={t('admin.navigation')}>
      <NavLink end to="/admin" className={style}>
        {t('admin.overview')}
      </NavLink>
      <NavLink to="/admin/creators" className={style}>
        {t('admin.creators')}
      </NavLink>
      <NavLink to="/admin/campaigns/new" className={style}>
        {t('admin.newCampaign')}
      </NavLink>
    </nav>
  );
}

export function Countdown({ deadline }: { deadline: string }) {
  const { t } = useTranslation();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1_000);
    return () => clearInterval(timer);
  }, []);
  if (now === null) return <span aria-hidden="true">—</span>;
  const seconds = Math.max(
    0,
    Math.floor((new Date(deadline).getTime() - now) / 1_000)
  );
  if (seconds === 0) {
    return <span className="text-coral">{t('admin.due')}</span>;
  }
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return (
    <span>
      {hours}h {minutes}m {seconds % 60}s
    </span>
  );
}

export function CampaignRow({ campaign }: { campaign: AdminCampaign }) {
  const { t } = useTranslation();
  return (
    <Link
      to={`/admin/campaigns/${campaign.id}`}
      className="grid gap-3 border-b border-ink/15 p-5 transition last:border-0 hover:bg-sun/10 sm:grid-cols-[1fr_auto_auto] sm:items-center"
    >
      <div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${campaign.status === 'open' ? 'bg-mint' : 'bg-neutral-200'}`}
          >
            {t(`status.${campaign.status}`)}
          </span>
          <h3 className="font-black">{campaign.title}</h3>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          {campaign.targetGenre} · {campaign.bidCount} {t('admin.bids')}
        </p>
      </div>
      <strong>
        {campaign.budget.symbol}
        {campaign.budget.amount} {campaign.budget.asset}
      </strong>
      <span className="min-w-28 text-right font-mono text-sm">
        {campaign.status === 'open' ? (
          <Countdown deadline={campaign.biddingDeadline} />
        ) : (
          `${campaign.winningBidCount} ${t('admin.winners')}`
        )}
      </span>
    </Link>
  );
}
