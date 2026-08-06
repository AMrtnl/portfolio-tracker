/**
 * FX conversion into a single display currency.
 *
 * Meridian holds positions in USD/CHF/EUR/GBP. Summing those numbers as-is
 * would produce a meaningless total, so every money figure in the analytics
 * API is converted into one base currency with a real quoted rate. When a rate
 * cannot be fetched we do NOT fall back to 1:1 — the position is excluded from
 * the base-currency total and reported in `unconverted`, so the UI can say so.
 */
import { TTL, TtlCache } from './cache';
import { fxSymbol, isFiat, normalizeTicker } from './symbols';
import { getYahooClient, guarded } from './yahoo';

const rateCache = new TtlCache<number>('fx', TTL.FX, true);

export function baseCurrency(): string {
  const configured = normalizeTicker(process.env.BASE_CURRENCY || 'USD');
  return isFiat(configured) ? configured : 'USD';
}

export interface UnconvertedBucket {
  currency: string;
  value: number;
}

export class FxConverter {
  private constructor(
    readonly base: string,
    private readonly rates: Map<string, number>,
    readonly missing: string[],
    readonly warnings: string[],
  ) {}

  static async load(base: string, currencies: string[]): Promise<FxConverter> {
    const target = normalizeTicker(base);
    const wanted = Array.from(
      new Set(
        currencies
          .map(normalizeTicker)
          .filter((c) => c && c !== target && /^[A-Z]{3}$/.test(c)),
      ),
    );
    const rates = new Map<string, number>([[target, 1]]);
    const missing: string[] = [];
    const warnings: string[] = [];

    const needed: string[] = [];
    for (const currency of wanted) {
      const cached = rateCache.get(`${currency}->${target}`);
      if (cached != null) rates.set(currency, cached);
      else needed.push(currency);
    }

    if (needed.length > 0) {
      const pairs = needed
        .map((currency) => ({ currency, symbol: fxSymbol(currency, target) }))
        .filter((p): p is { currency: string; symbol: string } => Boolean(p.symbol));

      if (pairs.length > 0) {
        const client = getYahooClient();
        const result = await guarded('fx quotes', () =>
          client.quote(pairs.map((p) => p.symbol)),
        );
        const rows = Array.isArray(result.data)
          ? result.data
          : result.data
            ? [result.data]
            : [];
        const bySymbol = new Map<string, number>();
        for (const row of rows) {
          const record = row as unknown as Record<string, unknown>;
          const symbol =
            typeof record.symbol === 'string' ? record.symbol.toUpperCase() : null;
          const price = record.regularMarketPrice;
          if (symbol && typeof price === 'number' && Number.isFinite(price) && price > 0) {
            bySymbol.set(symbol, price);
          }
        }
        for (const pair of pairs) {
          const rate = bySymbol.get(pair.symbol.toUpperCase());
          if (rate != null) {
            rates.set(pair.currency, rate);
            rateCache.set(`${pair.currency}->${target}`, rate);
          }
        }
        if (result.error) warnings.push(result.error);
      }
    }

    for (const currency of wanted) {
      if (rates.has(currency)) continue;
      const expired = rateCache.getStale(`${currency}->${target}`);
      if (expired) {
        rates.set(currency, expired.value);
        warnings.push(
          `Using a cached ${currency}/${target} rate from ${new Date(expired.storedAt).toISOString()}.`,
        );
        continue;
      }
      missing.push(currency);
    }

    if (missing.length > 0) {
      warnings.push(
        `No FX rate for ${missing.join(', ')} → ${target}. Values in those currencies are excluded from ${target} totals.`,
      );
    }

    return new FxConverter(target, rates, missing, warnings);
  }

  /** Test seam / offline construction. */
  static fixed(base: string, rates: Record<string, number>): FxConverter {
    const map = new Map<string, number>([[normalizeTicker(base), 1]]);
    for (const [currency, rate] of Object.entries(rates)) {
      map.set(normalizeTicker(currency), rate);
    }
    return new FxConverter(normalizeTicker(base), map, [], []);
  }

  rate(from: string): number | null {
    const currency = normalizeTicker(from) || this.base;
    return this.rates.get(currency) ?? null;
  }

  /** Returns null when the rate is unknown, never a silent 1:1. */
  convert(amount: number | null | undefined, from: string): number | null {
    if (amount == null || !Number.isFinite(amount)) return null;
    const rate = this.rate(from);
    if (rate == null) return null;
    return amount * rate;
  }

  ratesUsed(): Record<string, number> {
    return Object.fromEntries(this.rates);
  }
}

/** Test helper. */
export function clearFxCache(): void {
  rateCache.clear();
}
