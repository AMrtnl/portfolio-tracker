/** Daily close series from Yahoo, cached for a day. */
import { InFlightMap, TTL, TtlCache } from './cache';
import { getYahooClient, guarded } from './yahoo';

export interface DailyClose {
  /** YYYY-MM-DD in UTC. */
  date: string;
  close: number;
}

export interface CloseSeries {
  symbol: string;
  currency: string | null;
  points: DailyClose[];
}

const seriesCache = new TtlCache<CloseSeries>('history', TTL.HISTORY, true);
const inFlight = new InFlightMap<CloseSeries | null>();

export function toIsoDate(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

/**
 * Daily closes from `from` (YYYY-MM-DD) to today.
 * Cached per symbol+start date; returns null when Yahoo has nothing.
 */
export async function getDailyCloses(
  symbol: string,
  from: string,
): Promise<{ series: CloseSeries | null; warning?: string }> {
  const key = `${symbol.toUpperCase()}:${from}`;
  const hit = seriesCache.get(key);
  if (hit) return { series: hit };

  const series = await inFlight.run(key, async () => {
    const client = getYahooClient();
    const result = await guarded(
      `chart(${symbol})`,
      () => client.chart(symbol, { period1: from, interval: '1d' }),
      12_000,
    );
    if (!result.data) return null;
    const raw = result.data as {
      meta?: { currency?: string };
      quotes?: Array<{ date?: Date | string; close?: number | null }>;
    };
    const points: DailyClose[] = [];
    for (const quote of raw.quotes || []) {
      if (!quote?.date || typeof quote.close !== 'number') continue;
      if (!Number.isFinite(quote.close)) continue;
      points.push({ date: toIsoDate(quote.date), close: quote.close });
    }
    if (points.length === 0) return null;
    const built: CloseSeries = {
      symbol: symbol.toUpperCase(),
      currency: raw.meta?.currency ? raw.meta.currency.toUpperCase() : null,
      points,
    };
    seriesCache.set(key, built);
    return built;
  });

  if (!series) {
    const expired = seriesCache.getStale(key);
    if (expired) {
      return {
        series: expired.value,
        warning: `Using cached price history for ${symbol}; refresh failed.`,
      };
    }
    return {
      series: null,
      warning: `No price history available for ${symbol}.`,
    };
  }
  return { series };
}

/** Test helper. */
export function clearHistoryCache(): void {
  seriesCache.clear();
}
