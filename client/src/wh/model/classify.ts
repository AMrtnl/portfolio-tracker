import type { Account } from '@/hooks/useAccounts'
import type { AnalyticsHolding } from '@/hooks/useAnalytics'
import type { ClassId } from '@/wh/Token'

/** Which token an account gets: the kind of thing it is, before a word is read. */
export function accountClassId(a: Account): ClassId {
  if (a.kind === 'liability' || a.type === 'loan') {
    const text = `${a.label} ${a.notes ?? ''}`.toLowerCase()
    if (/mortgage|hypo/.test(text)) return 'mortgage'
    if (/card|karte/.test(text)) return 'card'
    return 'loan'
  }
  if (a.type === 'estate' || a.bookClass === 'estate') return 'property'
  if (a.type === 'pension' || a.bookClass === 'pension') return 'pension'
  if (a.type === 'crypto_wallet') return a.provider === 'watch' ? 'wallet' : 'exchange'
  if (a.type === 'broker') return 'broker'
  if (a.type === 'bank') return 'bank'
  if (a.bookClass === 'crypto') return 'exchange'
  if (a.bookClass === 'stocks') return 'broker'
  if (a.bookClass === 'cash') return 'bank'
  if (a.bookClass === 'bonds') return 'bonds'
  return 'other'
}

/** The plain word under an account's name. */
export function accountKindLabel(a: Account): string {
  switch (accountClassId(a)) {
    case 'property':
      return a.provider === 'manual' ? 'Property, by hand' : 'Property'
    case 'broker':
      return 'Brokerage'
    case 'bank':
      return 'Bank'
    case 'pension':
      return 'Pension'
    case 'wallet':
      return 'Hardware wallet, read-only'
    case 'exchange':
      return 'Exchange'
    case 'mortgage':
      return 'Mortgage'
    case 'card':
      return 'Card'
    case 'loan':
      return 'Loan'
    default:
      return 'Account'
  }
}

/** Five allocation buckets the tesserae draw. */
export type Bucket = 'property' | 'equitiesAndFunds' | 'pension' | 'cash' | 'crypto'

export const BUCKET_LABEL: Record<Bucket, string> = {
  property: 'Property',
  equitiesAndFunds: 'Equities and funds',
  pension: 'Pension',
  cash: 'Cash',
  crypto: 'Crypto',
}

const CASH_SYMBOLS = new Set(['CHF', 'USD', 'EUR', 'GBP', 'USDT', 'USDC', 'CASH'])

export function holdingBucket(h: { symbol: string; assetClass?: string | null }): Bucket {
  const cls = (h.assetClass ?? '').toLowerCase()
  if (cls === 'cash' || CASH_SYMBOLS.has(h.symbol.toUpperCase())) return 'cash'
  if (cls === 'crypto') return 'crypto'
  return 'equitiesAndFunds'
}

export function accountBucket(a: Account): Bucket {
  switch (accountClassId(a)) {
    case 'property':
      return 'property'
    case 'pension':
      return 'pension'
    case 'bank':
      return 'cash'
    case 'wallet':
    case 'exchange':
      return 'crypto'
    default:
      return 'equitiesAndFunds'
  }
}

/** The token class of a position. */
export function holdingClassId(h: { symbol: string; assetClass?: string | null }): ClassId {
  const cls = (h.assetClass ?? '').toLowerCase()
  const sym = h.symbol.toUpperCase()
  if (sym === 'BTC') return 'bitcoin'
  if (cls === 'crypto') return 'crypto'
  if (cls === 'cash' || CASH_SYMBOLS.has(sym)) return 'cash'
  if (cls === 'etf' || cls === 'fund') return 'funds'
  if (cls === 'bond') return 'bonds'
  return 'equities'
}

/** "Fund, world" / "Equity" / "Crypto": what the row says a position is. */
export function holdingClassLabel(h: AnalyticsHolding): string {
  const cls = (h.assetClass ?? '').toLowerCase()
  if (h.industry && /^(Fund|Equity|Crypto|Bond)/.test(h.industry)) return h.industry
  if (cls === 'etf' || cls === 'fund') return 'Fund'
  if (cls === 'crypto') return 'Crypto'
  if (cls === 'cash') return 'Cash'
  if (cls === 'bond') return 'Bond'
  return 'Equity'
}

const COUNTRY_CODE: Record<string, string> = {
  switzerland: 'CH',
  'united states': 'US',
  us: 'US',
  usa: 'US',
  'north america': 'US',
  eurozone: 'EU',
  europe: 'EU',
  germany: 'DE',
  france: 'FR',
  japan: 'JP',
  'united kingdom': 'UK',
  uk: 'UK',
  'emerging markets': 'EM',
  emerging: 'EM',
  global: 'World',
  world: 'World',
  other: '—',
}

export function countryCode(region?: string | null): string {
  if (!region) return '—'
  const key = region.toLowerCase()
  return COUNTRY_CODE[key] ?? (region.length <= 3 ? region.toUpperCase() : region)
}

export function sentence(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}
