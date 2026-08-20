/**
 * Formatting helpers. Currency is always an explicit argument taken from the
 * API payload — nothing here defaults to USD silently, so a CHF account renders
 * as CHF even though the aggregate endpoint reports in USD today.
 */

export function formatMoney(
  value: number | string | null | undefined,
  currency: string,
  opts?: { compact?: boolean; digits?: number; signed?: boolean },
): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? NaN);
  const code = (currency || 'USD').toUpperCase();
  if (!Number.isFinite(num)) return '—';

  const digits = opts?.digits ?? 2;
  // Compact notation only kicks in once it actually saves space.
  const scale = opts?.compact ? compactScale(num) : null;
  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: scale ? 0 : digits,
      maximumFractionDigits: scale ? 1 : digits,
      signDisplay: opts?.signed ? 'exceptZero' : 'auto',
    }).format(scale ? num / scale.divisor : num);
    return scale ? `${formatted}${scale.suffix}` : formatted;
  } catch {
    // Unknown ISO code (some brokerages report non-standard strings).
    const sign = opts?.signed && num > 0 ? '+' : '';
    return `${sign}${num.toFixed(digits)} ${code}`;
  }
}

/**
 * Hermes' Intl on iOS silently ignores `notation: 'compact'` — it hands off to
 * NSNumberFormatter, which has no equivalent — so the abbreviation is applied by
 * hand instead of trusting the flag.
 */
function compactScale(value: number): { divisor: number; suffix: string } | null {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000_000) return { divisor: 1_000_000_000, suffix: 'B' };
  if (magnitude >= 1_000_000) return { divisor: 1_000_000, suffix: 'M' };
  if (magnitude >= 10_000) return { divisor: 1_000, suffix: 'K' };
  return null;
}

export function formatFigure(
  value: number,
  opts?: { hidden?: boolean; signed?: boolean },
): string {
  if (opts?.hidden) return '••••••';
  const n = Number.isFinite(value) ? value : 0;
  const rounded = Math.abs(n) < 100 ? Math.round(n * 10) / 10 : Math.round(n);
  let formatted: string;
  try {
    formatted = new Intl.NumberFormat('de-CH', {
      maximumFractionDigits:
        Math.abs(rounded) < 100 && !Number.isInteger(rounded) ? 1 : 0,
      minimumFractionDigits: 0,
    }).format(Math.abs(rounded));
  } catch {
    formatted = Math.abs(rounded).toLocaleString();
  }
  const sign = opts?.signed ? (n < 0 ? '−' : '+') : n < 0 ? '−' : '';
  return `${sign}${formatted}`;
}

export function formatPercent(
  value: number | string | null | undefined,
): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? NaN);
  if (!Number.isFinite(num)) return '—';
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
}

/** Bare percentage without a forced sign, for allocation weights. */
export function formatWeight(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(value < 1 ? 2 : 1)}%`;
}

export function formatQuantity(
  value: number | string | null | undefined,
  digits = 4,
): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? NaN);
  if (!Number.isFinite(num)) return '—';
  if (Math.abs(num) >= 1000) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
  }
  const fixed = num.toFixed(digits);
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

export function toNumber(value: number | string | null | undefined): number {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? NaN);
  return Number.isFinite(num) ? num : 0;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'unknown';
  const seconds = Math.floor(Math.max(0, Date.now() - then) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

export function formatClockTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** `0xabc…1234` for wallet addresses. */
export function shortenIdentifier(value: string | undefined, chars = 4): string {
  if (!value) return '';
  if (value.length < 12) return value;
  return `${value.slice(0, 2 + chars)}…${value.slice(-chars)}`;
}

/** Groups items into date buckets, newest first, for activity feeds. */
export function groupByDay<T>(
  items: T[],
  getDate: (item: T) => string | null | undefined,
): { key: string; label: string; items: T[] }[] {
  const buckets = new Map<string, { label: string; sort: number; items: T[] }>();
  for (const item of items) {
    const iso = getDate(item);
    const time = iso ? new Date(iso).getTime() : NaN;
    const key = Number.isFinite(time)
      ? new Date(time).toISOString().slice(0, 10)
      : 'unknown';
    const label = Number.isFinite(time) ? formatDate(iso) : 'Date unavailable';
    const bucket = buckets.get(key) ?? {
      label,
      sort: Number.isFinite(time) ? time : -Infinity,
      items: [],
    };
    bucket.items.push(item);
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[1].sort - a[1].sort)
    .map(([key, bucket]) => ({ key, label: bucket.label, items: bucket.items }));
}
