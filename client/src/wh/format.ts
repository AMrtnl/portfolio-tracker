import { useMoney } from '@/wealth/format'

/** The design's figures: comma groups, a true minus, no decimals above 100. */
export function fmt(n: number, opts: { sign?: boolean; digits?: number } = {}): string {
  if (!Number.isFinite(n)) return '—'
  const digits = opts.digits ?? (Math.abs(n) < 100 && !Number.isInteger(n) ? (Math.abs(n) < 10 ? 2 : 1) : 0)
  const body = new Intl.NumberFormat('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(n))
  const sign = n < 0 ? '−' : opts.sign && n > 0 ? '+' : ''
  return `${sign}${body}`
}

/** "+6.4%" or "−1.8%", one decimal by default. */
export function fmtPct(p: number, digits = 1, sign = true): string {
  if (!Number.isFinite(p)) return '—'
  const body = Math.abs(p).toFixed(digits)
  return `${p < 0 ? '−' : sign && p > 0 ? '+' : ''}${body}%`
}

/** Money helpers bound to the privacy toggle and the display currency, formatted the design's way. */
export function useFigures() {
  const { hidden, display, toDisplay } = useMoney()
  const money = (n: number, from?: string, opts: { sign?: boolean; digits?: number } = {}) => (hidden ? '••••••' : fmt(toDisplay(n, from ?? display), opts))
  return {
    hidden,
    unit: display,
    /** Converts into the display currency and formats. */
    money,
    /** "CHF 1,284,650": the unit before the figure, for the headline only. */
    headline: (n: number, from?: string) => (hidden ? `${display} ••••••` : `${display} ${fmt(toDisplay(n, from ?? display))}`),
    pct: (p: number, digits = 1) => (hidden ? '••' : fmtPct(p, digits)),
    toDisplay,
  }
}
