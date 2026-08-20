import { useState } from 'react'

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

export function LogoAvatar({
  symbol,
  name,
  institution,
  color = '#8E8E93',
  className = '',
}: {
  symbol?: string
  name?: string
  institution?: string
  /** Tint for the letter fallback. */
  color?: string
  /** Extra classes on the `.a-av` shell, e.g. `lg`. */
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const url = failed ? null : logoUrl({ symbol, name, institution })
  const letter = (institution || name || symbol || '?').slice(0, 1).toUpperCase()
  return (
    <span
      className={`a-av ${url ? 'logo' : ''} ${className}`.trim()}
      style={url ? undefined : { background: `${color}22`, color }}
      aria-hidden
    >
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        letter
      )}
    </span>
  )
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
