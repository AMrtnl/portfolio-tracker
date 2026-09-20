import { usePrivacy } from '@/wealth/PrivacyContext'
import { useSettings } from '@/hooks/useSettings'

export const HIDDEN = '••••••'

/** Decimals a figure gets: one below 100, none above. */
export function moneyDigits(value: number): number {
  return Math.abs(value) < 100 && !Number.isInteger(value) ? 1 : 0
}

export function formatMoney(
  value: number,
  opts?: { sign?: boolean; hidden?: boolean },
): string {
  if (opts?.hidden) return HIDDEN
  const n = Number.isFinite(value) ? value : 0
  const rounded = Math.abs(n) < 100 ? Math.round(n * 10) / 10 : Math.round(n)
  let formatted: string
  try {
    formatted = new Intl.NumberFormat('en-GB', {
      maximumFractionDigits: moneyDigits(rounded),
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

/**
 * Money helpers bound to the privacy toggle and the display currency.
 * Figures arrive in whatever currency their source reports (accounts in
 * USD, analytics already in the display currency); `chf` converts with the
 * server's published rate and formats. When no rate is known the figure is
 * shown unconverted rather than invented.
 */
export function useMoney() {
  const { hidden } = usePrivacy()
  const { data: settings } = useSettings()
  const display = settings?.displayCurrency ?? 'USD'
  const rates = settings?.rates ?? {}
  const toDisplay = (n: number, from = 'USD') => {
    const code = (from || 'USD').toUpperCase()
    if (code === display) return n
    const rate = rates[code]
    return rate != null ? n * rate : n
  }
  return {
    hidden,
    display,
    toDisplay,
    chf: (n: number, sign = false, currency = 'USD') =>
      formatMoney(toDisplay(n, currency), { sign, hidden }),
    pctStr: (p: number) => formatPct(p, hidden),
    /** The currency label every figure carries once converted. */
    unit: (_currency?: string | null) => display,
  }
}
