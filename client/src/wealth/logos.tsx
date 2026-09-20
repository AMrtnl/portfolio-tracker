import { Token, type ClassId } from '@/wh/Token'

/**
 * Rounded brand avatars: real logos where we know the brand, tinted
 * initials everywhere else. Logos load from public CDNs and fall back to
 * the letter avatar the moment a request fails, so a missing logo never
 * leaves a hole in a row.
 */

/** Ticker → brand domain, for symbols whose logo beats a generic lookup. */
const SYMBOL_DOMAINS: Record<string, string> = {
  AAPL: 'apple.com',
  MSFT: 'microsoft.com',
  NVDA: 'nvidia.com',
  GOOGL: 'abc.xyz',
  GOOG: 'abc.xyz',
  AMZN: 'amazon.com',
  META: 'meta.com',
  TSLA: 'tesla.com',
  NESN: 'nestle.com',
  NOVN: 'novartis.com',
  ROG: 'roche.com',
  UBSG: 'ubs.com',
  ZURN: 'zurich.com',
  VWCE: 'vanguard.com',
  VT: 'vanguard.com',
  VOO: 'vanguard.com',
  SPY: 'ssga.com',
  IWDA: 'ishares.com',
  BTC: 'bitcoin.org',
  ETH: 'ethereum.org',
}

/** Institution / brand name → domain. Matched on the lowercased full name, then the first word. */
const NAME_DOMAINS: Record<string, string> = {
  ubs: 'ubs.com',
  'interactive brokers': 'interactivebrokers.com',
  ibkr: 'interactivebrokers.com',
  viac: 'viac.ch',
  zkb: 'zkb.ch',
  postfinance: 'postfinance.ch',
  raiffeisen: 'raiffeisen.ch',
  swissquote: 'swissquote.ch',
  'credit suisse': 'credit-suisse.com',
  revolut: 'revolut.com',
  wise: 'wise.com',
  yuh: 'yuh.com',
  n26: 'n26.com',
  hyperliquid: 'hyperliquid.xyz',
  kraken: 'kraken.com',
  binance: 'binance.com',
  coinbase: 'coinbase.com',
  netflix: 'netflix.com',
  spotify: 'spotify.com',
  icloud: 'icloud.com',
  'icloud+': 'icloud.com',
  apple: 'apple.com',
  chatgpt: 'openai.com',
  openai: 'openai.com',
  swisscom: 'swisscom.ch',
  sunrise: 'sunrise.ch',
  salt: 'salt.ch',
  css: 'css.ch',
  sbb: 'sbb.ch',
  'sbb ga': 'sbb.ch',
  migros: 'migros.ch',
  'migros fitness': 'migros.ch',
  coop: 'coop.ch',
}

/** Brand icon via Google's favicon service — reliable, no key, cached hard. */
function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
}

export function logoUrl(opts: {
  symbol?: string
  name?: string
  institution?: string
}): string | null {
  const sym = opts.symbol?.toUpperCase()
  if (sym && SYMBOL_DOMAINS[sym]) return faviconUrl(SYMBOL_DOMAINS[sym])
  for (const raw of [opts.institution, opts.name]) {
    if (!raw) continue
    const full = raw.toLowerCase().trim()
    const hit = NAME_DOMAINS[full] ?? NAME_DOMAINS[full.split(/[\s·]+/)[0]]
    if (hit) return faviconUrl(hit)
  }
  return null
}

/** The legacy avatar now draws the product token, so every row starts with the same tile. */
export function LogoAvatar({
  symbol,
  name,
  institution,
  className = '',
}: {
  symbol?: string
  name?: string
  institution?: string
  /** Kept for callers; the token takes its colour from the brand. */
  color?: string
  /** `lg` for the identity block at the top of a holding. */
  className?: string
}) {
  const sym = symbol?.toUpperCase()
  const classId: ClassId = sym === 'BTC' ? 'bitcoin' : sym === 'ETH' || sym === 'SOL' ? 'crypto' : sym ? 'equities' : institution ? 'bank' : 'other'
  const size = className.includes('lg') ? 46 : 32
  return <Token name={institution || name || sym} symbol={sym} classId={classId} size={size} />
}

/** Country / region flags for allocation rows. Emoji renders crisply on Apple platforms. */
export const FLAGS: Record<string, string> = {
  CH: '🇨🇭',
  US: '🇺🇸',
  EU: '🇪🇺',
  UK: '🇬🇧',
  GB: '🇬🇧',
  JP: '🇯🇵',
  DE: '🇩🇪',
  FR: '🇫🇷',
  CN: '🇨🇳',
  EM: '🌍',
  switzerland: '🇨🇭',
  'united states': '🇺🇸',
  'north america': '🇺🇸',
  europe: '🇪🇺',
  'united kingdom': '🇬🇧',
  japan: '🇯🇵',
  china: '🇨🇳',
  emerging: '🌍',
  asia: '🌏',
  global: '🌐',
}

export function flagFor(key: string, label?: string): string | undefined {
  return (
    FLAGS[key] ??
    FLAGS[key.toLowerCase()] ??
    (label ? FLAGS[label.toLowerCase()] : undefined)
  )
}
