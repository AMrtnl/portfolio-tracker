/** News for symbols the user actually holds. */
import { InFlightMap, TTL, TtlCache } from './cache';
import { getYahooClient, guarded } from './yahoo';

export interface NewsArticle {
  title: string;
  publisher: string | null;
  link: string;
  publishedAt: string | null;
  symbols: string[];
}

const newsCache = new TtlCache<NewsArticle[]>('news', TTL.NEWS, false);
const inFlight = new InFlightMap<NewsArticle[]>();

/** Symbols queried per request — news is a per-symbol search endpoint. */
const MAX_SYMBOLS = 12;
const CONCURRENCY = 4;

function publishedIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

async function fetchForSymbol(symbol: string, count: number): Promise<NewsArticle[]> {
  const cached = newsCache.get(symbol);
  if (cached) return cached;

  return inFlight.run(`news:${symbol}`, async () => {
    const client = getYahooClient();
    const result = await guarded(`news(${symbol})`, () =>
      client.search(symbol, { newsCount: count, quotesCount: 0 }),
    );
    if (!result.data) return [];
    const raw = (result.data as { news?: Array<Record<string, unknown>> }).news || [];
    const articles: NewsArticle[] = [];
    for (const item of raw) {
      const title = typeof item.title === 'string' ? item.title : null;
      const link = typeof item.link === 'string' ? item.link : null;
      if (!title || !link) continue;
      const related = Array.isArray(item.relatedTickers)
        ? item.relatedTickers.filter((t): t is string => typeof t === 'string')
        : [];
      articles.push({
        title,
        publisher: typeof item.publisher === 'string' ? item.publisher : null,
        link,
        publishedAt: publishedIso(item.providerPublishTime),
        symbols: related.length > 0 ? related : [symbol],
      });
    }
    newsCache.set(symbol, articles);
    return articles;
  });
}

/**
 * Aggregates recent news across the given holdings, newest first.
 * Only the largest positions are queried so the request stays bounded.
 */
export async function getNewsForSymbols(
  symbols: string[],
  limit: number,
): Promise<{ articles: NewsArticle[]; warnings: string[] }> {
  const warnings: string[] = [];
  const queue = Array.from(new Set(symbols.filter(Boolean))).slice(0, MAX_SYMBOLS);
  if (queue.length === 0) {
    return { articles: [], warnings };
  }
  if (symbols.length > queue.length) {
    warnings.push(
      `News covers your ${queue.length} largest holdings out of ${symbols.length}.`,
    );
  }

  const perSymbol = Math.max(3, Math.ceil((limit * 1.5) / queue.length));
  const collected: NewsArticle[][] = [];
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= queue.length) return;
      collected.push(await fetchForSymbol(queue[index], perSymbol));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

  const byLink = new Map<string, NewsArticle>();
  for (const batch of collected) {
    for (const article of batch) {
      const existing = byLink.get(article.link);
      if (existing) {
        existing.symbols = Array.from(
          new Set([...existing.symbols, ...article.symbols]),
        );
        continue;
      }
      byLink.set(article.link, { ...article });
    }
  }

  const articles = Array.from(byLink.values()).sort((a, b) => {
    const at = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return bt - at;
  });

  if (articles.length === 0) {
    warnings.push('No recent news returned for your holdings.');
  }

  return { articles: articles.slice(0, limit), warnings };
}
