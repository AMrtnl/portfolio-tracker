import { usePrivacy } from '@/wealth/PrivacyContext'

export function formatMoney(
  value: number,
  opts?: { currency?: string; sign?: boolean; hidden?: boolean },
): string {
  if (opts?.hidden) return '••••••'
  const n = Number.isFinite(value) ? value : 0
  void opts?.currency
  const rounded = Math.abs(n) < 100 ? Math.round(n * 10) / 10 : Math.round(n)
  let formatted: string
  try {
    formatted = new Intl.NumberFormat('de-CH', {
      maximumFractionDigits: Math.abs(rounded) < 100 && !Number.isInteger(rounded) ? 1 : 0,
      minimumFractionDigits: 0,
    }).format(Math.abs(rounded))
  } catch {
    formatted = Math.abs(rounded).toLocaleString()
  }
  const sign = opts?.sign ? (n < 0 ? '−' : '+') : n < 0 ? '−' : ''
  return `${sign}${formatted}`
}

export function formatPct(value: number, hidden?: boolean): string {
  if (hidden) return '••'
  if (!Number.isFinite(value)) return '—'
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}%`
}

export function currencyUnit(code?: string | null): string {
  return (code || 'USD').toUpperCase()
}

/** Hook-aware wrappers used by screens. */
export function useMoney() {
  const { hidden } = usePrivacy()
  return {
    hidden,
    chf: (n: number, sign = false, currency = 'USD') =>
      formatMoney(n, { currency, sign, hidden }),
    pctStr: (p: number) => formatPct(p, hidden),
    unit: (currency?: string | null) => currencyUnit(currency),
  }
}
