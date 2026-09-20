export function formatFollowers(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);
}

export function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function formatMoney(
  value: string,
  symbol: string,
  asset: string
): string {
  return `${symbol}${value} ${asset}`;
}

export function isZeroDecimal(value: string): boolean {
  return /^0+(?:\.0+)?$/.test(value);
}
