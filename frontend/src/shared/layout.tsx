import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function Layout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith('de') ? 'de' : 'en';

  function switchLanguage(nextLanguage: 'en' | 'de') {
    void i18n.changeLanguage(nextLanguage);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-ink bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link
            to="/"
            className="group flex items-center gap-3"
            aria-label={t('brand.homeLabel')}
          >
            <span className="grid size-10 rotate-3 place-items-center rounded-xl border-2 border-ink bg-sun font-black shadow-[3px_3px_0_#171714] transition group-hover:-rotate-3">
              W
            </span>
            <span>
              <span className="block text-lg font-black leading-none tracking-tight">
                WePush
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600">
                {t('brand.subtitle')}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <nav className="hidden gap-1 sm:flex" aria-label={t('mode.label')}>
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-xs font-black ${isActive ? 'bg-ink text-white' : ''}`
                }
              >
                {t('mode.creator')}
              </NavLink>
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-xs font-black ${isActive ? 'bg-ink text-white' : ''}`
                }
              >
                {t('mode.admin')}
              </NavLink>
            </nav>
            <span className="hidden rounded-full border border-ink/20 bg-white/60 px-3 py-1 text-xs font-bold uppercase tracking-wider text-neutral-600 lg:block">
              {t('brand.demo')}
            </span>
            <div
              className="flex rounded-full border-2 border-ink bg-white p-0.5"
              role="group"
              aria-label={t('language.label')}
            >
              {(['en', 'de'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => switchLanguage(item)}
                  aria-pressed={language === item}
                  aria-label={
                    item === 'en' ? t('language.english') : t('language.german')
                  }
                  className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-black transition ${language === item ? 'bg-ink text-white' : 'text-neutral-500 hover:text-ink'}`}
                >
                  {item.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
