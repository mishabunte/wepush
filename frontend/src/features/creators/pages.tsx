import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { marketplaceApi } from '../../api';
import {
  EmptyState,
  ErrorNotice,
  LoadingCards,
  PageIntro,
  Stat,
  localizedErrorMessage
} from '../../shared/components';
import { formatDate, formatFollowers, formatMoney } from '../../shared/format';
import type { CampaignMatch, Creator } from '../../types';
import { useApiData } from '../../use-api-data';

export function CreatorsPage() {
  const { t, i18n } = useTranslation();
  const creators = useApiData(marketplaceApi.listCreators, []);
  const locale = i18n.resolvedLanguage ?? 'en';

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-20">
      <PageIntro eyebrow={t('creators.eyebrow')} title={t('creators.title')}>
        {t('creators.intro')}
      </PageIntro>
      {creators.loading && <LoadingCards />}
      {creators.error && (
        <ErrorNotice
          error={creators.error}
          retry={() => void creators.reload()}
        />
      )}
      {creators.data && (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {creators.data.map((creator, index) => (
            <Link
              key={creator.id}
              to={`/creators/${creator.id}`}
              aria-label={t('creators.openProfile', {
                name: creator.displayName
              })}
              className="group relative overflow-hidden rounded-3xl border-2 border-ink bg-white p-6 shadow-[5px_5px_0_#171714] transition hover:-translate-y-1 hover:shadow-[8px_8px_0_#171714]"
            >
              <div
                className={`absolute -right-8 -top-8 size-28 rounded-full ${index % 3 === 0 ? 'bg-sun' : index % 3 === 1 ? 'bg-mint' : 'bg-coral/70'}`}
              />
              <div className="relative flex min-h-44 flex-col justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-neutral-500">
                    {creator.genre}
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight">
                    {creator.displayName}
                  </h2>
                </div>
                <div className="flex items-end justify-between">
                  <div className="flex gap-5">
                    <Stat
                      value={formatFollowers(creator.followerCount, locale)}
                      label={t('creators.followers')}
                    />
                    <Stat
                      value={`${creator.engagementRate}%`}
                      label={t('creators.engagement')}
                    />
                  </div>
                  <span
                    className="grid size-10 place-items-center rounded-full border-2 border-ink transition group-hover:bg-ink group-hover:text-white"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

export function CreatorPage({ view }: { view: 'matches' | 'bids' }) {
  const { creatorId = '' } = useParams();
  const creators = useApiData(marketplaceApi.listCreators, []);
  const creator = creators.data?.find((item) => item.id === creatorId);

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
      {creators.loading && (
        <div className="h-28 animate-pulse rounded-3xl bg-white/50" />
      )}
      {creators.error && (
        <ErrorNotice
          error={creators.error}
          retry={() => void creators.reload()}
        />
      )}
      {creators.data && !creator && <Navigate to="/" replace />}
      {creator && (
        <>
          <CreatorHeader creator={creator} active={view} />
          {view === 'matches' ? (
            <Matches creator={creator} />
          ) : (
            <Bids creator={creator} />
          )}
        </>
      )}
    </main>
  );
}

function CreatorHeader({
  creator,
  active
}: {
  creator: Creator;
  active: 'matches' | 'bids';
}) {
  const { t, i18n } = useTranslation();
  const base = `/creators/${creator.id}`;
  const locale = i18n.resolvedLanguage ?? 'en';
  return (
    <div className="mb-10 flex flex-col justify-between gap-5 border-b-2 border-ink pb-6 sm:flex-row sm:items-end">
      <div>
        <Link
          to="/"
          className="text-sm font-bold text-neutral-500 underline underline-offset-4"
        >
          {t('navigation.switchCreator')}
        </Link>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">
          {creator.displayName}
        </h1>
        <p className="mt-1 capitalize text-neutral-600">
          {creator.genre} · {formatFollowers(creator.followerCount, locale)}{' '}
          {t('creators.followers')}
        </p>
      </div>
      <nav className="flex gap-2" aria-label={t('navigation.workspace')}>
        <NavLink
          to={base}
          end
          className={`rounded-full border-2 border-ink px-4 py-2 text-sm font-bold ${active === 'matches' ? 'bg-ink text-white' : 'bg-white'}`}
        >
          {t('navigation.matches')}
        </NavLink>
        <NavLink
          to={`${base}/bids`}
          className={`rounded-full border-2 border-ink px-4 py-2 text-sm font-bold ${active === 'bids' ? 'bg-ink text-white' : 'bg-white'}`}
        >
          {t('navigation.bids')}
        </NavLink>
      </nav>
    </div>
  );
}

function Matches({ creator }: { creator: Creator }) {
  const { t } = useTranslation();
  const matches = useApiData(
    (signal) => marketplaceApi.listMatches(creator.id, signal),
    [creator.id]
  );
  return (
    <section>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-coral">
            {t('matches.eyebrow')}
          </p>
          <h2 className="mt-1 text-2xl font-black">{t('matches.title')}</h2>
        </div>
        {matches.data && (
          <span className="font-mono text-sm text-neutral-500">
            {t('matches.count', { count: matches.data.length })}
          </span>
        )}
      </div>
      {matches.loading && <LoadingCards />}
      {matches.error && (
        <ErrorNotice
          error={matches.error}
          retry={() => void matches.reload()}
        />
      )}
      {matches.data?.length === 0 && (
        <EmptyState
          title={t('matches.emptyTitle')}
          text={t('matches.emptyText')}
        />
      )}
      {matches.data && (
        <div className="grid gap-6 lg:grid-cols-2">
          {matches.data.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              creatorId={creator.id}
              onSaved={matches.reload}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CampaignCard({
  campaign,
  creatorId,
  onSaved
}: {
  campaign: CampaignMatch;
  creatorId: string;
  onSaved: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const [amount, setAmount] = useState(campaign.bid?.amount ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const locale = i18n.resolvedLanguage ?? 'en';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await marketplaceApi.saveBid(
        creatorId,
        campaign.id,
        amount.replace(',', '.')
      );
      await onSaved();
      setMessage(campaign.bid ? t('bidForm.updated') : t('bidForm.submitted'));
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? localizedErrorMessage(reason, t)
          : t('bidForm.saveError')
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="flex flex-col rounded-3xl border-2 border-ink bg-white shadow-[5px_5px_0_#171714]">
      <div className="flex-1 p-6 sm:p-7">
        <div className="flex items-start justify-between gap-5">
          <span className="rounded-full bg-mint px-3 py-1 text-xs font-black uppercase tracking-wider">
            {t('matches.fit', { score: Number(campaign.fit.score).toFixed(0) })}
          </span>
          <span className="text-right text-sm font-semibold text-neutral-500">
            {t('matches.closes', {
              date: formatDate(campaign.biddingDeadline, locale)
            })}
          </span>
        </div>
        <h3 className="mt-5 text-2xl font-black tracking-tight">
          {campaign.title}
        </h3>
        <p className="mt-3 leading-6 text-neutral-600">
          {campaign.description}
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3 border-y border-ink/15 py-4">
          <Stat
            value={formatMoney(
              campaign.budget.amount,
              campaign.budget.symbol,
              campaign.budget.asset
            )}
            label={t('matches.budget')}
          />
          <Stat
            value={formatFollowers(
              campaign.requirements.minimumFollowers,
              locale
            )}
            label={t('matches.minimumFollowers')}
          />
          <Stat
            value={`${campaign.requirements.targetEngagementRate}%`}
            label={t('matches.targetEngagement')}
          />
        </div>
      </div>
      <form
        onSubmit={submit}
        className="rounded-b-[1.35rem] bg-ink p-5 text-white sm:px-7"
      >
        <label
          htmlFor={`bid-${campaign.id}`}
          className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/65"
        >
          {campaign.bid ? t('bidForm.reviseLabel') : t('bidForm.newLabel')} ·{' '}
          {campaign.budget.asset}
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-ink">
              {campaign.budget.symbol}
            </span>
            <input
              id={`bid-${campaign.id}`}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              inputMode="decimal"
              pattern="(?:0|[1-9][0-9]*)(?:[.,][0-9]+)?"
              placeholder={t('bidForm.placeholder')}
              className="w-full rounded-xl border-0 bg-white py-3 pl-9 pr-3 font-mono font-bold text-ink"
            />
          </div>
          <button
            disabled={saving}
            className="cursor-pointer rounded-xl bg-sun px-5 font-black text-ink transition hover:bg-white disabled:cursor-wait disabled:opacity-60"
          >
            {saving
              ? t('bidForm.saving')
              : campaign.bid
                ? t('bidForm.update')
                : t('bidForm.submit')}
          </button>
        </div>
        {message && (
          <p aria-live="polite" className="mt-2 text-sm text-white/75">
            {message}
          </p>
        )}
      </form>
    </article>
  );
}

function Bids({ creator }: { creator: Creator }) {
  const { t, i18n } = useTranslation();
  const bids = useApiData(
    (signal) => marketplaceApi.listBids(creator.id, signal),
    [creator.id]
  );
  const refreshBids = bids.refresh;
  const locale = i18n.resolvedLanguage ?? 'en';

  useEffect(() => {
    const refreshVisiblePage = () => {
      if (document.visibilityState === 'visible') void refreshBids();
    };
    const timer = window.setInterval(refreshVisiblePage, 5_000);
    document.addEventListener('visibilitychange', refreshVisiblePage);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshVisiblePage);
    };
  }, [refreshBids]);

  return (
    <section>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-coral">
        {t('bids.eyebrow')}
      </p>
      <h2 className="mt-1 text-2xl font-black">{t('bids.title')}</h2>
      <div className="mt-6">
        {bids.loading && <LoadingCards />}
        {bids.error && (
          <ErrorNotice error={bids.error} retry={() => void bids.reload()} />
        )}
        {bids.data?.length === 0 && (
          <EmptyState
            title={t('bids.emptyTitle')}
            text={t('bids.emptyText')}
            action={`/creators/${creator.id}`}
          />
        )}
        {bids.data && bids.data.length > 0 && (
          <div className="overflow-hidden rounded-3xl border-2 border-ink bg-white shadow-[5px_5px_0_#171714]">
            {bids.data.map((bid) => (
              <div
                key={bid.id}
                className="flex flex-col gap-3 border-b border-ink/15 p-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:p-6"
              >
                <div>
                  <h3 className="font-black">{bid.campaign.title}</h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    {t('bids.updated', {
                      date: formatDate(bid.updatedAt, locale)
                    })}{' '}
                    ·{' '}
                    {t('bids.fit', { score: Number(bid.fit.score).toFixed(0) })}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-6 sm:justify-end">
                  <span className="text-lg font-black">
                    {formatMoney(
                      bid.amount.value,
                      bid.amount.symbol,
                      bid.amount.asset
                    )}
                  </span>
                  <span className="rounded-full border border-ink px-3 py-1 text-xs font-black uppercase tracking-wider">
                    {t(`status.${bid.status}`, { defaultValue: bid.status })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
