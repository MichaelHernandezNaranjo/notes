/** Human-readable byte size (binary units, like the operating system shows them). */
export function formatBytes(bytes: number | null | undefined, digits = 1): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 100 ? 0 : digits)} ${units[i]}`;
}

/** Server timestamps are UTC without a zone marker: treat them as UTC. */
export function parseUtc(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

/** "5 min ago" style label; falls back to the date for old values. */
export function timeAgo(value: string | null, language: 'es' | 'en'): string {
  if (!value) return '—';
  const seconds = Math.max(0, Math.round((Date.now() - parseUtc(value).getTime()) / 1000));
  const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  if (seconds < 60) return rtf.format(0, 'second');
  if (seconds < 3600) return rtf.format(-Math.round(seconds / 60), 'minute');
  if (seconds < 86400) return rtf.format(-Math.round(seconds / 3600), 'hour');
  if (seconds < 86400 * 30) return rtf.format(-Math.round(seconds / 86400), 'day');
  return parseUtc(value).toLocaleDateString(language);
}

export function formatDateTime(value: string | null, language: 'es' | 'en'): string {
  if (!value) return '—';
  return parseUtc(value).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' });
}
