/**
 * Logos for tokens, behind one interface, in the handoff's fallback order:
 *   1. a logo from a source (the bundled Simple Icons set, then a remote service by domain),
 *   2. a monogram in the brand colour,
 *   3. the class token alone.
 * Nothing here decides layout; the Token component keeps the tile the same whichever resolves.
 */
import {
  siApple,
  siBinance,
  siBitcoin,
  siClaude,
  siCoinbase,
  siEthereum,
  siGoogle,
  siIcloud,
  siMeta,
  siN26,
  siNetflix,
  siNotion,
  siNvidia,
  siRevolut,
  siSolana,
  siSpotify,
  siTesla,
  siTether,
  siWise,
  siYoutube,
} from 'simple-icons'

export interface LogoQuery {
  name?: string | null
  symbol?: string | null
  domain?: string | null
  isin?: string | null
}

export interface SvgLogo {
  kind: 'svg'
  title: string
  /** SVG path on a 24 x 24 grid. */
  path: string
  /** Brand colour, six hex digits, no hash. */
  hex: string
}

export interface ImageLogo {
  kind: 'image'
  url: string
  /** Brand colour when a source knows it; the tile stays neutral otherwise. */
  hex?: string
}

export type Logo = SvgLogo | ImageLogo

export interface LogoSource {
  id: string
  resolve(query: LogoQuery): Logo | null
}

/** What a brand looks like when no logo resolves: its initials in its colour. */
export interface Brand {
  mono: string
  hex: string
  domain?: string
}

type SimpleIcon = { title: string; hex: string; path: string }

/* ---- Bundled marks: CC0 from Simple Icons, tree-shaken to the ones the product needs ---- */

const BUNDLED: Record<string, SimpleIcon> = {
  apple: siApple,
  bitcoin: siBitcoin,
  ethereum: siEthereum,
  revolut: siRevolut,
  netflix: siNetflix,
  spotify: siSpotify,
  youtube: siYoutube,
  'youtube premium': siYoutube,
  icloud: siIcloud,
  'icloud+': siIcloud,
  claude: siClaude,
  anthropic: siClaude,
  notion: siNotion,
  nvidia: siNvidia,
  google: siGoogle,
  alphabet: siGoogle,
  meta: siMeta,
  tesla: siTesla,
  solana: siSolana,
  tether: siTether,
  binance: siBinance,
  coinbase: siCoinbase,
  wise: siWise,
  n26: siN26,
}

const SYMBOL_TO_BUNDLED: Record<string, string> = {
  AAPL: 'apple',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  NVDA: 'nvidia',
  GOOGL: 'google',
  GOOG: 'google',
  META: 'meta',
  TSLA: 'tesla',
  SOL: 'solana',
  USDT: 'tether',
  BNB: 'binance',
  COIN: 'coinbase',
  NFLX: 'netflix',
  SPOT: 'spotify',
}

/* ---- Brands with no open logo: initials in the brand colour, and a domain for a logo service ---- */

export const BRANDS: Record<string, Brand> = {
  ubs: { mono: 'UBS', hex: '1A1A1A', domain: 'ubs.com' },
  'interactive brokers': { mono: 'IB', hex: 'C8102E', domain: 'interactivebrokers.com' },
  ibkr: { mono: 'IB', hex: 'C8102E', domain: 'interactivebrokers.com' },
  ledger: { mono: 'L', hex: '111111', domain: 'ledger.com' },
  vanguard: { mono: 'VG', hex: '96151D', domain: 'vanguard.com' },
  ishares: { mono: 'iSh', hex: '1A1A1A', domain: 'ishares.com' },
  'pillar 3a': { mono: '3a', hex: '4F6B3A' },
  '3a': { mono: '3a', hex: '4F6B3A' },
  viac: { mono: 'VIAC', hex: '4F6B3A', domain: 'viac.ch' },
  swisscom: { mono: 'SC', hex: '0B3A8F', domain: 'swisscom.ch' },
  nestle: { mono: 'N', hex: '7A5C48', domain: 'nestle.com' },
  nestlé: { mono: 'N', hex: '7A5C48', domain: 'nestle.com' },
  microsoft: { mono: 'MS', hex: '737373', domain: 'microsoft.com' },
  zkb: { mono: 'ZKB', hex: '0A5CB5', domain: 'zkb.ch' },
  postfinance: { mono: 'PF', hex: 'B58A00', domain: 'postfinance.ch' },
  raiffeisen: { mono: 'R', hex: 'E30613', domain: 'raiffeisen.ch' },
  swissquote: { mono: 'SQ', hex: 'E30613', domain: 'swissquote.ch' },
  'credit suisse': { mono: 'CS', hex: '0A2F6E', domain: 'credit-suisse.com' },
  hyperliquid: { mono: 'HL', hex: '1C8C7A', domain: 'hyperliquid.xyz' },
  kraken: { mono: 'K', hex: '5741D9', domain: 'kraken.com' },
  css: { mono: 'CSS', hex: 'E2001A', domain: 'css.ch' },
  sbb: { mono: 'SBB', hex: 'EB0000', domain: 'sbb.ch' },
  migros: { mono: 'M', hex: 'FF6600', domain: 'migros.ch' },
  coop: { mono: 'C', hex: 'E2001A', domain: 'coop.ch' },
  sunrise: { mono: 'SR', hex: 'E2001A', domain: 'sunrise.ch' },
  salt: { mono: 'S', hex: '1A1A1A', domain: 'salt.ch' },
  chatgpt: { mono: 'GPT', hex: '10A37F', domain: 'openai.com' },
  openai: { mono: 'AI', hex: '10A37F', domain: 'openai.com' },
}

const SYMBOL_TO_BRAND: Record<string, string> = {
  NESN: 'nestle',
  MSFT: 'microsoft',
  VWCE: 'vanguard',
  VT: 'vanguard',
  VOO: 'vanguard',
  VWRL: 'vanguard',
  IWDA: 'ishares',
  CSPX: 'ishares',
  UBSG: 'ubs',
}

const norm = (s?: string | null) => (s ?? '').toLowerCase().replace(/[·|,]/g, ' ').replace(/\s+/g, ' ').trim()

/** Progressively shorter prefixes of a name: "interactive brokers main" tries the whole, then two words, then one. */
function prefixes(name: string): string[] {
  const words = name.split(' ').filter(Boolean)
  const out: string[] = []
  for (let n = Math.min(words.length, 4); n >= 1; n--) out.push(words.slice(0, n).join(' '))
  return out
}

function lookup<T>(table: Record<string, T>, query: LogoQuery, bySymbol?: Record<string, string>): T | null {
  const sym = query.symbol?.toUpperCase()
  if (sym && bySymbol?.[sym] && table[bySymbol[sym]]) return table[bySymbol[sym]]
  const domain = norm(query.domain).replace(/^www\./, '').split('.')[0]
  if (domain && table[domain]) return table[domain]
  for (const raw of [query.name]) {
    const name = norm(raw)
    if (!name) continue
    for (const p of prefixes(name)) if (table[p]) return table[p]
  }
  return null
}

/** The CC0 set that ships with the app. Synchronous, offline. */
export const bundledSource: LogoSource = {
  id: 'simple-icons',
  resolve(query) {
    const hit = lookup(BUNDLED, query, SYMBOL_TO_BUNDLED)
    return hit ? { kind: 'svg', title: hit.title, path: hit.path, hex: hit.hex } : null
  },
}

/** The brand table: initials and colour for things no open set covers. */
export function brandFor(query: LogoQuery): Brand | null {
  return lookup(BRANDS, query, SYMBOL_TO_BRAND)
}

/**
 * A remote logo service by domain. Wired here as a favicon lookup; swap the
 * URL builder for Brandfetch, Logo.dev or a broker feed without touching
 * any row. Off when VITE_LOGO_SERVICE is "off".
 */
function remoteUrl(domain: string): string | null {
  const mode = (import.meta.env.VITE_LOGO_SERVICE as string | undefined) ?? 'favicon'
  if (mode === 'off') return null
  if (mode === 'logo.dev') {
    const token = import.meta.env.VITE_LOGO_DEV_TOKEN as string | undefined
    return token ? `https://img.logo.dev/${domain}?token=${encodeURIComponent(token)}&size=96&format=png` : null
  }
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
}

export const remoteSource: LogoSource = {
  id: 'remote',
  resolve(query) {
    const brand = brandFor(query)
    const domain = norm(query.domain) || brand?.domain
    if (!domain) return null
    const url = remoteUrl(domain)
    return url ? { kind: 'image', url, hex: brand?.hex } : null
  },
}

/** Initials for anything without a brand entry: "Interactive Brokers" becomes IB, "Gym" becomes G. */
export function initialsOf(name?: string | null, symbol?: string | null): string {
  const words = (name ?? '').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  if (words.length === 1) return words[0].slice(0, words[0].length > 3 ? 1 : words[0].length === 3 ? 3 : 2)
  return (symbol ?? '?').slice(0, 3).toUpperCase()
}

/** Relative luminance of a hex colour, for deciding whether a brand is near-black. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(0, 6), 16)
  const ch = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255)
}

export interface ResolvedLogo {
  logo: Logo | null
  brand: Brand | null
  /** Colour the tile is tinted with. Null means neutral. */
  hex: string | null
  mono: string
}

/** One call for the token: what to draw, what colour to tint, what initials if nothing loads. */
export function resolveLogo(query: LogoQuery, opts: { remote?: boolean; mono?: string; hex?: string } = {}): ResolvedLogo {
  const brand = brandFor(query)
  const bundled = bundledSource.resolve(query)
  const remote = !bundled && opts.remote !== false ? remoteSource.resolve(query) : null
  const logo = bundled ?? remote
  const rawHex = opts.hex ?? (logo?.kind === 'svg' ? logo.hex : logo?.hex) ?? brand?.hex ?? null
  // Pure black reads as a hole on marble; the design lifts it to near-black.
  const hex = rawHex ? (parseInt(rawHex, 16) < 0x101010 ? '111111' : rawHex.toUpperCase()) : null
  return { logo, brand, hex, mono: opts.mono ?? brand?.mono ?? initialsOf(query.name, query.symbol) }
}
