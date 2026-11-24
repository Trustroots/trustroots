const UNITS = [
  ['year', 365 * 86400],
  ['month', 30 * 86400],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
] as const;

/** Relative time such as "3 days ago", localised with Intl. */
export function timeAgo(date: Date, locale = 'en'): string {
  const seconds = (date.getTime() - Date.now()) / 1000;
  if (!Number.isFinite(seconds)) return 'Invalid date';
  const [unit, size] =
    UNITS.find(([, size]) => Math.abs(seconds) >= size) ?? UNITS[5];
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
    Math.trunc(seconds / size),
    unit,
  );
}
