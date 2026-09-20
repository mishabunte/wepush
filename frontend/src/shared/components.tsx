import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../api';

export function PageIntro({
  eyebrow,
  title,
  children
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-10 max-w-3xl">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-coral">
        {eyebrow}
      </p>
      <h1 className="text-4xl font-black leading-[0.95] tracking-[-0.04em] sm:text-6xl">
        {title}
      </h1>
      <div className="mt-5 max-w-2xl text-base leading-7 text-neutral-600 sm:text-lg">
        {children}
      </div>
    </div>
  );
}

export function LoadingCards() {
  const { t } = useTranslation();
  return (
    <div
      className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
      aria-label={t('loading')}
    >
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-56 animate-pulse rounded-3xl border-2 border-ink/10 bg-white/50"
        />
      ))}
    </div>
  );
}

export function localizedErrorMessage(
  error: Error,
  translate: (key: string, options?: Record<string, unknown>) => string
): string {
  if (error instanceof ApiError && error.code) {
    return translate(`error.codes.${error.code}`, {
      defaultValue: translate('error.generic')
    });
  }
  return translate('error.generic');
}

export function ErrorNotice({
  error,
  retry
}: {
  error: Error;
  retry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="rounded-2xl border-2 border-coral bg-white p-5 shadow-[4px_4px_0_#ee6b4d]"
    >
      <p className="font-bold">{t('error.title')}</p>
      <p className="mt-1 text-sm text-neutral-600">
        {localizedErrorMessage(error, t)}
      </p>
      <button
        type="button"
        className="mt-4 cursor-pointer font-bold underline decoration-2 underline-offset-4"
        onClick={retry}
      >
        {t('error.retry')}
      </button>
    </div>
  );
}

export function EmptyState({
  title,
  text,
  action
}: {
  title: string;
  text: string;
  action?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-3xl border-2 border-dashed border-ink/30 bg-white/50 p-10 text-center">
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-2 text-neutral-600">{text}</p>
      {action && (
        <Link
          to={action}
          className="mt-5 inline-block rounded-full bg-ink px-5 py-2 font-bold text-white"
        >
          {t('bids.browse')}
        </Link>
      )}
    </div>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span>
      <strong className="block text-lg font-black">{value}</strong>
      <span className="text-xs font-semibold text-neutral-500">{label}</span>
    </span>
  );
}
