import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * One money language across the app: de-CH grouping (1'120'000), no symbol,
 * true minus sign, cents only where they carry information (values under
 * 1000, e.g. prices) or when `digits` is set explicitly.
 */
export function formatCurrency(
  value: number | string,
  opts?: { compact?: boolean; digits?: number; currency?: string },
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  void opts?.currency
  if (!Number.isFinite(num)) return '0'

  const digits =
    opts?.digits ?? (Math.abs(num) >= 1000 || Number.isInteger(num) ? 0 : 2)
  try {
    if (opts?.compact && Math.abs(num) >= 1000) {
      return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 2,
      })
        .format(num)
        .replace(/^-/, '−')
    }

    return new Intl.NumberFormat('de-CH', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
      .format(num)
      .replace(/^-/, '−')
  } catch {
    return num.toFixed(digits).replace(/^-/, '−')
  }
}

export function formatPercent(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (!Number.isFinite(num)) return '0.00%'
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`
}

export function formatAmount(value: number | string, digits = 4): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (!Number.isFinite(num)) return '0'
  if (Math.abs(num) >= 1000) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num)
  }
  return num.toFixed(digits).replace(/\.?0+$/, '')
}

/** Provider ids are lowercase on the wire; these are the display spellings. */
export function providerName(id?: string | null): string {
  switch ((id || '').toLowerCase()) {
    case 'snaptrade':
      return 'SnapTrade'
    case 'hyperliquid':
      return 'Hyperliquid'
    case 'manual':
      return 'Manual'
    default:
      return id || '—'
  }
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const diff = Math.max(0, Date.now() - then)
  const sec = Math.floor(diff / 1000)
  if (sec < 10) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/** Absolute timestamp for the "as of" line under live values. */
export function absoluteTime(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export type Freshness = 'fresh' | 'aging' | 'stale' | 'unknown'

/** Buckets an "as of" timestamp so rows can show when data needs attention. */
export function freshness(iso?: string | null): Freshness {
  if (!iso) return 'unknown'
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return 'unknown'
  const mins = (Date.now() - then) / 60_000
  if (mins < 30) return 'fresh'
  if (mins < 60 * 24) return 'aging'
  return 'stale'
}

/**
 * Splits a formatted amount so the fraction can be set smaller than the
 * integer part — keeps large values scannable at hero sizes.
 */
export function splitMoney(
  value: number | string,
  opts?: { currency?: string; compact?: boolean },
): { lead: string; fraction: string } {
  const formatted = formatCurrency(value, opts)
  const match = formatted.match(/^(.*)([.,]\d+)$/)
  if (!match) return { lead: formatted, fraction: '' }
  return { lead: match[1], fraction: match[2] }
}

/** "August 2026" bucket key + label, for date-grouped activity lists. */
export function monthBucket(iso?: string | null): { key: string; label: string } {
  const d = iso ? new Date(iso) : null
  if (!d || !Number.isFinite(d.getTime())) {
    return { key: 'undated', label: 'Undated' }
  }
  return {
    key: `${d.getFullYear()}-${d.getMonth()}`,
    label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  }
}

export function groupByMonth<T>(
  items: T[],
  getDate: (item: T) => string | null | undefined,
): Array<{ key: string; label: string; items: T[] }> {
  const order: string[] = []
  const map = new Map<string, { key: string; label: string; items: T[] }>()
  for (const item of items) {
    const { key, label } = monthBucket(getDate(item))
    if (!map.has(key)) {
      map.set(key, { key, label, items: [] })
      order.push(key)
    }
    map.get(key)!.items.push(item)
  }
  return order.map((k) => map.get(k)!)
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
]

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}
