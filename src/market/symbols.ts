/**
 * Symbol mapping between broker/wallet tickers and Yahoo Finance tickers.
 *
 * Every function here is pure so the mapping rules can be unit-tested without
 * touching the network. Anything we cannot confidently map returns
 * `yahooSymbol: null` and the caller degrades to `unclassified` — we never
 * guess a ticker, because a wrong guess silently prices the wrong asset.
 */

export type MarketAssetClass =
  | 'equity'
  | 'etf'
  | 'fund'
  | 'crypto'
  | 'cash'
  | 'bond'
  | 'real_estate'
  | 'pension'
  | 'other'
  | 'unclassified';

export type SymbolKind = 'equity' | 'crypto' | 'cash' | 'unknown';

export interface SymbolHint {
  /** Provider that reported the holding. */
  provider?: string;
  /** Institution label, e.g. "Kraken", "Trading212". */
  institution?: string;
  /** Reported position currency. */
  currency?: string;
  /** Broker already told us this is cash / a money-market sweep. */
  cashEquivalent?: boolean;
}

export interface MappedSymbol {
  /** Ticker as reported by the source, upper-cased and trimmed. */
  raw: string;
  /** Ticker to send to Yahoo, or null when unmappable. */
  yahooSymbol: string | null;
  kind: SymbolKind;
}

const FIAT = new Set([
  'USD',
  'EUR',
  'CHF',
  'GBP',
  'CAD',
  'AUD',
  'JPY',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'CZK',
  'HUF',
  'NZD',
  'SGD',
  'HKD',
]);

/** Pegged tokens behave as cash for allocation purposes. */
const STABLECOINS = new Set([
  'USDC',
  'USDT',
  'DAI',
  'BUSD',
  'TUSD',
  'USDE',
  'USDH',
  'USDD',
  'USDG',
  'FDUSD',
  'PYUSD',
  'EURC',
  'USDC.E',
]);

/**
 * Kraken (and similar) tokenized equities arrive as `<TICKER>x.T`
 * (e.g. `COINx.T`, `QQQx.T`, `SPCXx.T`). Yahoo prices the underlying
 * without that decoration — strip it before any other rule runs.
 */
const TOKENIZED_EQUITY = /^([A-Z0-9]+?)X\.T$/;

/** Tickers Yahoo prices as `<TICKER>-USD`. Extended by provider hints below. */
const KNOWN_CRYPTO = new Set([
  'BTC',
  'ETH',
  'SOL',
  'XRP',
  'ADA',
  'DOGE',
  'DOT',
  'AVAX',
  'MATIC',
  'POL',
  'LINK',
  'LTC',
  'BCH',
  'ATOM',
  'UNI',
  'XLM',
  'ALGO',
  'FIL',
  'ETC',
  'NEAR',
  'APT',
  'ARB',
  'OP',
  'SUI',
  'SEI',
  'TIA',
  'INJ',
  'HYPE',
  'PEPE',
  'SHIB',
  'TRX',
  'TON',
  'ICP',
  'AAVE',
  'MKR',
  'CRV',
  'LDO',
  'RNDR',
  'RENDER',
  'FTM',
  'IMX',
  'GRT',
  'SAND',
  'MANA',
  'AXS',
  'EOS',
  'XMR',
  'XTZ',
  'KSM',
  'ENS',
  'STX',
  'BONK',
  'WIF',
  'JUP',
  'PYTH',
  'W',
  'ENA',
  'ONDO',
  'STRK',
  'BLUR',
  'GMX',
  'DYDX',
  'SNX',
  'COMP',
  'YFI',
  'SUSHI',
  '1INCH',
  'BAL',
  'ZRX',
  'BAT',
  'CHZ',
  'FLOW',
  'HBAR',
  'VET',
  'THETA',
  'EGLD',
  'RUNE',
  'KAVA',
  'ROSE',
  'CELO',
  'ZEC',
  'DASH',
  'QNT',
  'CAKE',
  'GALA',
  'APE',
  'LRC',
  'KAS',
  'TAO',
  'FET',
  'AGIX',
  'OCEAN',
  'JTO',
  'MEME',
  'MOVE',
  'ME',
  'PENGU',
  'TRUMP',
  'S',
  'BERA',
  'KAIA',
]);

/** Exchange aliases that differ from the Yahoo ticker. */
const CRYPTO_ALIASES: Record<string, string> = {
  XBT: 'BTC',
  XDG: 'DOGE',
  'XBT.M': 'BTC',
  WBTC: 'WBTC',
  WETH: 'ETH',
  STETH: 'STETH',
  UBTC: 'BTC',
  UETH: 'ETH',
  USOL: 'SOL',
};

const CRYPTO_INSTITUTIONS = [
  'kraken',
  'coinbase',
  'binance',
  'bitstamp',
  'gemini',
  'crypto.com',
  'bitfinex',
  'kucoin',
  'okx',
  'bybit',
  'hyperliquid',
  'swissborg',
  'bitpanda',
];

export function normalizeTicker(symbol: string): string {
  return String(symbol || '')
    .trim()
    .toUpperCase();
}

export function isFiat(symbol: string): boolean {
  return FIAT.has(normalizeTicker(symbol));
}

export function isStablecoin(symbol: string): boolean {
  return STABLECOINS.has(normalizeTicker(symbol));
}

function looksLikeCryptoSource(hint: SymbolHint | undefined): boolean {
  if (!hint) return false;
  if (hint.provider === 'hyperliquid') return true;
  const institution = (hint.institution || '').toLowerCase();
  return CRYPTO_INSTITUTIONS.some((name) => institution.includes(name));
}

/**
 * Strips the leading/trailing decorations exchanges add to perp and spot
 * tickers so `BTC-PERP`, `kBTC` style names collapse to the base asset.
 */
function baseCryptoTicker(ticker: string): string {
  let base = ticker;
  base = base.replace(/-?PERP$/, '');
  base = base.replace(/[/-](USD|USDC|USDT|EUR)$/, '');
  return CRYPTO_ALIASES[base] || base;
}

/**
 * Maps a reported holding ticker to the Yahoo ticker that prices it.
 *
 * Symbols that already carry an exchange suffix (`NESN.SW`, `VUSA.L`) pass
 * through untouched — Yahoo uses the same convention.
 */
export function mapSymbol(symbol: string, hint: SymbolHint = {}): MappedSymbol {
  const raw = normalizeTicker(symbol);
  if (!raw) return { raw, yahooSymbol: null, kind: 'unknown' };

  // Cash / stablecoins: never call a quote API. A naive ticker lookup for
  // USD/USDC returns the wrong instrument (ProShares Ultra Semiconductors /
  // USDATA Corp) and silently corrupts totals.
  if (hint.cashEquivalent || isFiat(raw) || isStablecoin(raw)) {
    return { raw, yahooSymbol: null, kind: 'cash' };
  }

  // Kraken tokenized equities: COINx.T → COIN, QQQx.T → QQQ, SPCXx.T → SPCX.
  const tokenized = raw.match(TOKENIZED_EQUITY);
  if (tokenized) {
    return { raw, yahooSymbol: tokenized[1], kind: 'equity' };
  }

  const cryptoBase = baseCryptoTicker(raw);
  if (isStablecoin(cryptoBase)) {
    return { raw, yahooSymbol: null, kind: 'cash' };
  }

  const cryptoSource = looksLikeCryptoSource(hint);
  const hasSourceHint = Boolean(hint.institution || hint.provider);

  // Tickers like LTC exist as BOTH Litecoin and LTC Properties (a REIT). Prefer
  // crypto only when the source is a crypto venue, or when no source hint was
  // given (bare `mapSymbol('BTC')` calls from tests / tools).
  if (KNOWN_CRYPTO.has(cryptoBase)) {
    if (cryptoSource || !hasSourceHint) {
      return { raw, yahooSymbol: `${cryptoBase}-USD`, kind: 'crypto' };
    }
    // Non-crypto brokerage reported a ticker that also exists as crypto —
    // fall through and treat it as equity.
  } else if (cryptoSource && /^[A-Z0-9]{2,10}$/.test(cryptoBase)) {
    return { raw, yahooSymbol: `${cryptoBase}-USD`, kind: 'crypto' };
  }

  // Options / warrants / anything with whitespace: not priceable by ticker.
  if (/\s/.test(raw)) return { raw, yahooSymbol: null, kind: 'unknown' };

  if (/^[A-Z0-9.\-^]{1,20}$/.test(raw)) {
    return { raw, yahooSymbol: raw, kind: 'equity' };
  }

  return { raw, yahooSymbol: null, kind: 'unknown' };
}

/**
 * Yahoo FX ticker for a pair, e.g. CHF→USD is `CHFUSD=X` (price = USD per CHF).
 * Returns null for same-currency pairs, which need no lookup.
 */
export function fxSymbol(from: string, to: string): string | null {
  const a = normalizeTicker(from);
  const b = normalizeTicker(to);
  if (!a || !b || a === b) return null;
  if (!/^[A-Z]{3}$/.test(a) || !/^[A-Z]{3}$/.test(b)) return null;
  return `${a}${b}=X`;
}

/** `quoteType` from Yahoo → our asset-class vocabulary. */
export function assetClassFromQuoteType(
  quoteType: string | undefined | null,
): MarketAssetClass {
  switch ((quoteType || '').toUpperCase()) {
    case 'EQUITY':
      return 'equity';
    case 'ETF':
      return 'etf';
    case 'MUTUALFUND':
      return 'fund';
    case 'CRYPTOCURRENCY':
      return 'crypto';
    case 'CURRENCY':
      return 'cash';
    case 'INDEX':
      return 'other';
    case 'FUTURE':
    case 'OPTION':
      return 'other';
    default:
      return 'unclassified';
  }
}

const COUNTRY_TO_REGION: Record<string, string> = {
  'united states': 'North America',
  usa: 'North America',
  canada: 'North America',
  mexico: 'Latin America',
  brazil: 'Latin America',
  argentina: 'Latin America',
  chile: 'Latin America',
  switzerland: 'Europe',
  germany: 'Europe',
  france: 'Europe',
  'united kingdom': 'Europe',
  ireland: 'Europe',
  netherlands: 'Europe',
  belgium: 'Europe',
  spain: 'Europe',
  italy: 'Europe',
  portugal: 'Europe',
  sweden: 'Europe',
  norway: 'Europe',
  denmark: 'Europe',
  finland: 'Europe',
  austria: 'Europe',
  poland: 'Europe',
  luxembourg: 'Europe',
  jersey: 'Europe',
  guernsey: 'Europe',
  'isle of man': 'Europe',
  greece: 'Europe',
  japan: 'Asia-Pacific',
  china: 'Asia-Pacific',
  'hong kong': 'Asia-Pacific',
  taiwan: 'Asia-Pacific',
  'south korea': 'Asia-Pacific',
  korea: 'Asia-Pacific',
  singapore: 'Asia-Pacific',
  india: 'Asia-Pacific',
  australia: 'Asia-Pacific',
  'new zealand': 'Asia-Pacific',
  indonesia: 'Asia-Pacific',
  thailand: 'Asia-Pacific',
  vietnam: 'Asia-Pacific',
  israel: 'Middle East & Africa',
  'united arab emirates': 'Middle East & Africa',
  'saudi arabia': 'Middle East & Africa',
  'south africa': 'Middle East & Africa',
  turkey: 'Middle East & Africa',
};

/** Exchange suffix → region, used when Yahoo has no `assetProfile.country`. */
const SUFFIX_TO_REGION: Record<string, string> = {
  SW: 'Europe',
  L: 'Europe',
  DE: 'Europe',
  F: 'Europe',
  PA: 'Europe',
  AS: 'Europe',
  BR: 'Europe',
  MI: 'Europe',
  MC: 'Europe',
  LS: 'Europe',
  VI: 'Europe',
  ST: 'Europe',
  OL: 'Europe',
  CO: 'Europe',
  HE: 'Europe',
  IR: 'Europe',
  WA: 'Europe',
  TO: 'North America',
  V: 'North America',
  NE: 'North America',
  T: 'Asia-Pacific',
  HK: 'Asia-Pacific',
  SS: 'Asia-Pacific',
  SZ: 'Asia-Pacific',
  KS: 'Asia-Pacific',
  KQ: 'Asia-Pacific',
  TW: 'Asia-Pacific',
  SI: 'Asia-Pacific',
  AX: 'Asia-Pacific',
  NZ: 'Asia-Pacific',
  NS: 'Asia-Pacific',
  BO: 'Asia-Pacific',
  JO: 'Middle East & Africa',
  TA: 'Middle East & Africa',
  SR: 'Middle East & Africa',
  SA: 'Latin America',
  MX: 'Latin America',
  BA: 'Latin America',
  SN: 'Latin America',
};

export function regionFromCountry(country: string | undefined | null): string | null {
  if (!country) return null;
  return COUNTRY_TO_REGION[country.trim().toLowerCase()] || null;
}

/** Falls back to the listing venue when the issuer country is unknown. */
export function regionFromSymbol(yahooSymbol: string | undefined | null): string | null {
  if (!yahooSymbol) return null;
  const upper = normalizeTicker(yahooSymbol);
  if (upper.endsWith('-USD')) return 'Crypto';
  const dot = upper.lastIndexOf('.');
  if (dot < 0) {
    // Unsuffixed tickers are US listings on Yahoo.
    return /^[A-Z.]{1,6}$/.test(upper) ? 'North America' : null;
  }
  return SUFFIX_TO_REGION[upper.slice(dot + 1)] || null;
}
