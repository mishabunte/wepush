import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../api';
import {
  EmptyState,
  ErrorNotice,
  LoadingCards,
  localizedErrorMessage
} from '../../shared/components';
import { formatDate, isZeroDecimal } from '../../shared/format';
import { useApiData } from '../../use-api-data';
import { AdminFrame, CampaignRow, Countdown } from './components';
import { LiveEventsProvider, useLiveEvents } from './live-events';

export function AdminArea() {
  return (
    <LiveEventsProvider>
      <Routes>
        <Route index element={<AdminDashboard />} />
        <Route path="campaigns/new" element={<AdminNewCampaignPage />} />
        <Route path="campaigns/:campaignId" element={<AdminCampaignPage />} />
        <Route path="creators" element={<AdminCreatorsPage />} />
      </Routes>
    </LiveEventsProvider>
  );
}

function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const live = useLiveEvents();
  const summary = useApiData(adminApi.summary, []);
  const campaigns = useApiData(adminApi.campaigns, []);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<Error | null>(null);
  const refreshSummary = summary.refresh;
  const refreshCampaigns = campaigns.refresh;

  useEffect(() => {
    if (live.revision === 0) return;
    void Promise.all([refreshSummary(), refreshCampaigns()]);
  }, [live.revision, refreshCampaigns, refreshSummary]);

  async function processDue() {
    if (!window.confirm(t('admin.processConfirm'))) return;
    setProcessing(true);
    setNotice(null);
    setActionError(null);
    try {
      const result = await adminApi.processDue();
      setNotice(t('admin.processed', { count: result.length }));
      await Promise.all([summary.refresh(), campaigns.refresh()]);
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason : new Error(t('error.generic'))
      );
    } finally {
      setProcessing(false);
    }
  }

  const cards = summary.data
    ? [
        [t('admin.activeCreators'), summary.data.creatorCount],
        [t('admin.openCampaigns'), summary.data.openCampaignCount],
        [t('admin.pendingBids'), summary.data.pendingBidCount],
        [t('admin.closed24h'), summary.data.recentlyClosedCount]
      ]
    : [];

  return (
    <AdminFrame>
      {(summary.loading || campaigns.loading) && <LoadingCards />}
      {summary.error && (
        <ErrorNotice
          error={summary.error}
          retry={() => void summary.reload()}
        />
      )}
      {campaigns.error && (
        <ErrorNotice
          error={campaigns.error}
          retry={() => void campaigns.reload()}
        />
      )}
      {actionError && (
        <ErrorNotice error={actionError} retry={() => void processDue()} />
      )}
      {notice && (
        <p
          role="status"
          className="mb-5 rounded-xl border border-ink bg-mint/50 px-4 py-3 font-bold"
        >
          {notice}
        </p>
      )}
      <div className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl border-2 border-ink bg-white p-5 shadow-[4px_4px_0_#171714]"
          >
            <strong className="text-3xl font-black">{value}</strong>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-neutral-500">
              {label}
            </p>
          </div>
        ))}
      </div>
      {summary.data && (
        <div className="mb-7 flex flex-wrap gap-3">
          {summary.data.budgets
            .filter((item) => !isZeroDecimal(item.openBudget))
            .map((item) => (
              <span
                key={item.asset}
                className="rounded-full border border-ink/20 bg-white px-4 py-2 text-sm"
              >
                <b>
                  {item.symbol}
                  {item.openBudget}
                </b>{' '}
                {item.asset} {t('admin.openBudget')}
              </span>
            ))}
        </div>
      )}
      <div className="grid gap-7 lg:grid-cols-[1.7fr_1fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xl font-black">
              {t('admin.campaignMonitor')}
            </h2>
            <button
              type="button"
              onClick={() => void processDue()}
              disabled={processing}
              className="cursor-pointer rounded-full bg-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {processing ? t('bidForm.saving') : t('admin.processDue')}
            </button>
          </div>
          <div className="h-[32rem] overflow-auto rounded-3xl border-2 border-ink bg-white shadow-[5px_5px_0_#171714] lg:h-[38rem]">
            {campaigns.data?.map((campaign) => (
              <CampaignRow key={campaign.id} campaign={campaign} />
            ))}
            {campaigns.data?.length === 0 && (
              <EmptyState
                title={t('admin.noCampaignsTitle')}
                text={t('admin.noCampaignsText')}
              />
            )}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-2xl font-black">{t('admin.activity')}</h2>
          <div className="h-[32rem] overflow-auto rounded-3xl border-2 border-ink bg-ink p-3 text-white lg:h-[38rem]">
            {live.events.length === 0 && (
              <p className="p-4 text-white/60">{t('admin.waitingEvents')}</p>
            )}
            {live.events.map((event) => (
              <div
                key={event.id}
                className="border-b border-white/15 p-3 last:border-0"
              >
                <p className="font-bold">
                  {t(`admin.events.${event.type}`, {
                    defaultValue: event.type
                  })}
                </p>
                <p className="mt-1 font-mono text-xs text-white/55">
                  {event.entityId} ·{' '}
                  {formatDate(event.occurredAt, i18n.resolvedLanguage ?? 'en')}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminFrame>
  );
}

function AdminCampaignPage() {
  const { campaignId = '' } = useParams();
  const { t, i18n } = useTranslation();
  const live = useLiveEvents();
  const campaign = useApiData(
    (signal) => adminApi.campaign(campaignId, signal),
    [campaignId]
  );
  const refreshCampaign = campaign.refresh;

  useEffect(() => {
    if (live.revision === 0) return;
    void refreshCampaign();
  }, [live.revision, refreshCampaign]);

  const data = campaign.data;

  return (
    <AdminFrame>
      {campaign.loading && <LoadingCards />}
      {campaign.error && (
        <ErrorNotice
          error={campaign.error}
          retry={() => void campaign.reload()}
        />
      )}
      {data && (
        <>
          <Link to="/admin" className="font-bold underline">
            ← {t('admin.overview')}
          </Link>
          <div className="mt-5 rounded-3xl border-2 border-ink bg-white p-7 shadow-[5px_5px_0_#171714]">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black">{data.title}</h2>
                <p className="mt-2 max-w-2xl text-neutral-600">
                  {data.description}
                </p>
              </div>
              <div className="text-right">
                <strong className="text-2xl">
                  {data.budget.symbol}
                  {data.budget.amount}
                </strong>
                <p>
                  {data.status === 'open' ? (
                    <Countdown deadline={data.biddingDeadline} />
                  ) : (
                    t('status.closed')
                  )}
                </p>
              </div>
            </div>
          </div>
          <h3 className="mb-3 mt-8 text-2xl font-black">
            {t('admin.rankedBids')}
          </h3>
          {data.bids.length === 0 ? (
            <EmptyState
              title={t('admin.noBidsTitle')}
              text={t('admin.noBidsText')}
            />
          ) : (
            <div className="overflow-x-auto rounded-3xl border-2 border-ink bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-ink text-white">
                  <tr>
                    {[
                      'rank',
                      'creator',
                      'amount',
                      'fit',
                      'score',
                      'status'
                    ].map((key) => (
                      <th key={key} className="p-3">
                        {t(`admin.${key}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.bids.map((bid) => (
                    <tr key={bid.id} className="border-b border-ink/10">
                      <td className="p-3 font-black">#{bid.selectionRank}</td>
                      <td className="p-3">
                        <b>{bid.creator.displayName}</b>
                        <br />
                        <span className="text-neutral-500">
                          {bid.creator.followers.toLocaleString(
                            i18n.resolvedLanguage
                          )}
                        </span>
                      </td>
                      <td className="p-3 font-mono">
                        {data.budget.symbol}
                        {bid.amount}
                      </td>
                      <td className="p-3">{bid.fitScore}%</td>
                      <td className="p-3">
                        {bid.selectionScore}
                        {bid.provisional && (
                          <span className="ml-1 text-xs text-coral">
                            {t('admin.provisional')}
                          </span>
                        )}
                      </td>
                      <td className="p-3">{t(`status.${bid.status}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AdminFrame>
  );
}

function AdminCreatorsPage() {
  const { t, i18n } = useTranslation();
  const creators = useApiData(adminApi.creators, []);
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () =>
      creators.data?.filter((item) =>
        `${item.displayName} ${item.genre}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ) ?? [],
    [creators.data, query]
  );

  return (
    <AdminFrame>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-black">{t('admin.creatorRoster')}</h2>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('admin.search')}
          aria-label={t('admin.search')}
          className="rounded-full border-2 border-ink bg-white px-4 py-2"
        />
      </div>
      {creators.loading && <LoadingCards />}
      {creators.error && (
        <ErrorNotice
          error={creators.error}
          retry={() => void creators.reload()}
        />
      )}
      {creators.data && filtered.length === 0 && (
        <EmptyState
          title={t('admin.noCreatorsTitle')}
          text={t('admin.noCreatorsText')}
        />
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((creator) => (
          <article
            key={creator.id}
            className="rounded-2xl border-2 border-ink bg-white p-5"
          >
            <h3 className="text-xl font-black">{creator.displayName}</h3>
            <p className="capitalize text-neutral-500">{creator.genre}</p>
            <div className="mt-4 flex justify-between text-sm">
              <span>
                {creator.followerCount.toLocaleString(i18n.resolvedLanguage)}{' '}
                {t('creators.followers')}
              </span>
              <b>
                {creator.bidCount} {t('admin.bids')} · {creator.winCount}{' '}
                {t('admin.wins')}
              </b>
            </div>
          </article>
        ))}
      </div>
    </AdminFrame>
  );
}

function AdminNewCampaignPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const assets = useApiData(adminApi.assets, []);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const result = await adminApi.createCampaign({
        title: String(data.get('title')),
        description: String(data.get('description')),
        targetGenre: String(data.get('targetGenre')),
        minimumFollowers: Number(data.get('minimumFollowers')),
        targetEngagementRate: String(data.get('targetEngagementRate')),
        asset: String(data.get('asset')),
        budget: String(data.get('budget')).replace(',', '.'),
        biddingDeadline: new Date(
          String(data.get('biddingDeadline'))
        ).toISOString()
      });
      navigate(`/admin/campaigns/${result.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason : new Error(t('error.generic'))
      );
    } finally {
      setSaving(false);
    }
  }

  const input = 'w-full rounded-xl border-2 border-ink bg-white px-4 py-3';
  return (
    <AdminFrame>
      {assets.loading && <LoadingCards />}
      {assets.error && (
        <ErrorNotice error={assets.error} retry={() => void assets.reload()} />
      )}
      <form
        onSubmit={submit}
        className="mx-auto max-w-3xl rounded-3xl border-2 border-ink bg-white p-7 shadow-[6px_6px_0_#171714]"
      >
        <h2 className="mb-6 text-3xl font-black">{t('admin.newCampaign')}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="sm:col-span-2">
            {t('admin.campaignTitle')}
            <input name="title" required maxLength={200} className={input} />
          </label>
          <label className="sm:col-span-2">
            {t('admin.description')}
            <textarea
              name="description"
              required
              maxLength={2000}
              className={`${input} min-h-28`}
            />
          </label>
          <label>
            {t('admin.genre')}
            <input
              name="targetGenre"
              required
              pattern="[a-z][a-z0-9-]{1,31}"
              className={input}
            />
          </label>
          <label>
            {t('admin.minimumFollowers')}
            <input
              name="minimumFollowers"
              required
              type="number"
              min="0"
              className={input}
            />
          </label>
          <label>
            {t('admin.targetEngagement')}
            <input
              name="targetEngagementRate"
              required
              inputMode="decimal"
              pattern="(?:0|[1-9][0-9]*)(?:[.,][0-9]+)?"
              className={input}
            />
          </label>
          <label>
            {t('admin.deadline')}
            <input
              name="biddingDeadline"
              required
              type="datetime-local"
              className={input}
            />
          </label>
          <label>
            {t('admin.asset')}
            <select name="asset" required className={input}>
              {assets.data?.map((asset) => (
                <option key={asset.code}>{asset.code}</option>
              ))}
            </select>
          </label>
          <label>
            {t('admin.budget')}
            <input
              name="budget"
              required
              inputMode="decimal"
              pattern="(?:0|[1-9][0-9]*)(?:[.,][0-9]+)?"
              className={input}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-4 text-coral">
            {localizedErrorMessage(error, t)}
          </p>
        )}
        <button
          disabled={saving || !assets.data?.length}
          className="mt-6 cursor-pointer rounded-xl bg-sun px-6 py-3 font-black shadow-[3px_3px_0_#171714] disabled:opacity-50"
        >
          {saving ? t('bidForm.saving') : t('admin.createCampaign')}
        </button>
      </form>
    </AdminFrame>
  );
}
