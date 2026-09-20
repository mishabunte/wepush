import { Link, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { AdminArea } from './features/admin/pages';
import { CreatorPage, CreatorsPage } from './features/creators/pages';
import { Layout } from './shared/layout';

function NotFound() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-3xl px-5 py-24 text-center">
      <p className="text-8xl font-black text-coral">404</p>
      <h1 className="mt-4 text-3xl font-black">{t('notFound.title')}</h1>
      <Link
        to="/"
        className="mt-7 inline-block rounded-full border-2 border-ink bg-sun px-6 py-3 font-black shadow-[4px_4px_0_#171714]"
      >
        {t('notFound.action')}
      </Link>
    </main>
  );
}

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<CreatorsPage />} />
        <Route
          path="/creators/:creatorId"
          element={<CreatorPage view="matches" />}
        />
        <Route
          path="/creators/:creatorId/bids"
          element={<CreatorPage view="bids" />}
        />
        <Route path="/admin/*" element={<AdminArea />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
