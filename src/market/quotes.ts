/** Batched, cached Yahoo quotes. */
import { InFlightMap, TTL, TtlCache } from './cache';
import { getYahooClient, guarded } from './yahoo';

export interface MarketQuote {
  symbol: string;
  name: string | null;
  price: number | null;
  currency: string | null;
  dayChange: number | null;
  dayChangePercent: number | null;
  previousClose: number | null;
  quoteType: string | null;
  marketCap: number | null;
  peRatio: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  marketTime: string | null;
}

export interface QuoteLookup {
  quotes: Map<string, MarketQuote>;
  /** Symbols served from an expired cache entry because the refresh failed. */
  stale: Set<string>;
  /** Symbols Yahoo returned nothing for. */
  missing: string[];
  warnings: string[];
}

const quoteCache = new TtlCache<MarketQuote>('quotes', TTL.QUOTE, true);
const inFlight = new InFlightMap<void>();

/** Yahoo tolerates large symbol lists but splits keep any single failure small. */
const BATCH_SIZE = 40;

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toQuote(raw: Record<string, unknown>): MarketQuote | null {
  const symbol = typeof raw.symbol === 'string' ? raw.symbol.toUpperCase() : null;
  if (!symbol) return null;
  const time = raw.regularMarketTime;
  return {
    symbol,
    name:
      (typeof raw.shortName === 'string' && raw.shortName) ||
      (typeof raw.longName === 'string' && raw.longName) ||
      null,
    price: num(raw.regularMarketPrice),
    currency: typeof raw.currency === 'string' ? raw.currency.toUpperCase() : null,
    dayChange: num(raw.regularMarketChange),
    dayChangePercent: num(raw.regularMarketChangePercent),
    previousClose: num(raw.regularMarketPreviousClose),
    quoteType: typeof raw.quoteType === 'string' ? raw.quoteType : null,
    marketCap: num(raw.marketCap),
    peRatio: num(raw.trailingPE),
    fiftyTwoWeekHigh: num(raw.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: num(raw.fiftyTwoWeekLow),
    marketTime:
      time instanceof Date
        ? time.toISOString()
        : typeof time === 'number'
          ? new Date(time * 1000).toISOString()
          : null,
  };
}

async function fetchBatch(symbols: string[]): Promise<string | undefined> {
  const client = getYahooClient();
  const result = await guarded(`quote(${symbols.length} symbols)`, () =>
    client.quote(symbols),
  );
  if (!result.data) return result.error;
  const rows = Array.isArray(result.data) ? result.data : [result.data];
  for (const row of rows) {
    const quote = toQuote(row as unknown as Record<string, unknown>);
    if (quote) quoteCache.set(quote.symbol, quote);
  }
  return undefined;
}

/**
 * Resolves quotes for `symbols`, hitting Yahoo only for cache misses.
 * Never throws: unresolved symbols come back in `missing`.
 */
export async function getQuotes(symbols: string[]): Promise<QuoteLookup> {
  const wanted = Array.from(
    new Set(symbols.filter(Boolean).map((s) => s.toUpperCase())),
  );
  const quotes = new Map<string, MarketQuote>();
  const stale = new Set<string>();
  const warnings: string[] = [];
  const misses: string[] = [];

  for (const symbol of wanted) {
    const hit = quoteCache.get(symbol);
    if (hit) quotes.set(symbol, hit);
    else misses.push(symbol);
  }

  if (misses.length > 0) {
    const batches: string[][] = [];
    for (let i = 0; i < misses.length; i += BATCH_SIZE) {
      batches.push(misses.slice(i, i + BATCH_SIZE));
    }
    const errors = await Promise.all(
      batches.map((batch) =>
        inFlight
          .run(`quote:${batch.join(',')}`, async () => {
            await fetchBatch(batch);
          })
          .then(() => undefined)
          .catch((err: unknown) =>
            err instanceof Error ? err.message : 'quote batch failed',
          ),
      ),
    );
    for (const error of errors) {
      if (error) warnings.push(error);
    }
  }

  const missing: string[] = [];
  for (const symbol of misses) {
    const fresh = quoteCache.get(symbol);
    if (fresh) {
      quotes.set(symbol, fresh);
      continue;
    }
    const expired = quoteCache.getStale(symbol);
    if (expired) {
      quotes.set(symbol, expired.value);
      stale.add(symbol);
      continue;
    }
    missing.push(symbol);
  }

  if (stale.size > 0) {
    warnings.push(
      `Serving cached prices for ${stale.size} symbol(s); latest quote refresh failed.`,
    );
  }
  if (missing.length > 0) {
    warnings.push(
      `No market quote available for ${missing.length} symbol(s); they are treated as unclassified.`,
    );
  }

  return { quotes, stale, missing, warnings };
}

export function quoteCacheStats() {
  return quoteCache.stats();
}

/** Test helper. */
export function clearQuoteCache(): void {
  quoteCache.clear();
}
