import axios from 'axios';
import prisma from '../db/client.js';
import { CryptoPrice, EconomicEvent, EarningsEvent, NewsItem, MacroData } from '../types/common.js';

const COINGECKO_URL = 'https://api.coingecko.com/api/v3';
const FINNHUB_URL = 'https://finnhub.io/api/v1';
const FRED_URL = 'https://api.stlouisfed.org/fred/series/observations';

async function getCached<T>(key: string): Promise<T | null> {
  const row = await prisma.marketCache.findUnique({ where: { cacheKey: key } });
  if (row && new Date(row.expiresAt) > new Date()) {
    return JSON.parse(row.dataJson) as T;
  }
  return null;
}

async function setCache(key: string, data: unknown, ttlMs: number): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs);
  await prisma.marketCache.upsert({
    where: { cacheKey: key },
    update: { dataJson: JSON.stringify(data), expiresAt },
    create: { cacheKey: key, dataJson: JSON.stringify(data), expiresAt },
  });
}

// ── Crypto Prices ─────────────────────────────────────────────────────────────

const COIN_IDS = [
  'bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple',
  'avalanche-2', 'polkadot', 'chainlink', 'uniswap', 'aave',
  'hyperliquid', 'sui', 'arbitrum', 'optimism', 'base',
];

export async function getCryptoPrices(): Promise<CryptoPrice[]> {
  const cacheKey = 'crypto_prices';
  const cached = await getCached<CryptoPrice[]>(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await axios.get(
      `${COINGECKO_URL}/coins/markets?vs_currency=usd&ids=${COIN_IDS.join(',')}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`
    );
    const prices: CryptoPrice[] = data.map((c: any) => ({
      symbol: c.symbol.toUpperCase(),
      price: c.current_price,
      change24h: c.price_change_24h,
      change24hPercent: c.price_change_percentage_24h,
      marketCap: c.market_cap,
      volume24h: c.total_volume,
    }));
    await setCache(cacheKey, prices, 60_000); // 60s TTL
    return prices;
  } catch {
    return [];
  }
}

export async function getCryptoPrice(symbol: string): Promise<number> {
  const prices = await getCryptoPrices();
  return prices.find(p => p.symbol === symbol.toUpperCase())?.price ?? 0;
}

// ── Fear & Greed Index ────────────────────────────────────────────────────────

export async function getFearGreed(): Promise<{ value: number; label: string }> {
  const cacheKey = 'fear_greed';
  const cached = await getCached<{ value: number; label: string }>(cacheKey);
  if (cached) return cached;
  try {
    const { data } = await axios.get('https://api.alternative.me/fng/?limit=1');
    const result = { value: parseInt(data.data[0].value), label: data.data[0].value_classification };
    await setCache(cacheKey, result, 15 * 60_000);
    return result;
  } catch {
    return { value: 50, label: 'Neutral' };
  }
}

// ── Earnings Calendar ─────────────────────────────────────────────────────────

export async function getEarningsCalendar(): Promise<EarningsEvent[]> {
  const cacheKey = 'earnings_calendar';
  const cached = await getCached<EarningsEvent[]>(cacheKey);
  if (cached) return cached;

  const key = process.env.FINNHUB_API_KEY;
  if (!key) return getMockEarnings();

  try {
    const from = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const { data } = await axios.get(
      `${FINNHUB_URL}/calendar/earnings?from=${from}&to=${to}&token=${key}`
    );
    const events: EarningsEvent[] = (data.earningsCalendar ?? []).slice(0, 30).map((e: any) => ({
      date: e.date,
      ticker: e.symbol,
      company: e.company ?? e.symbol,
      epsEstimate: e.epsEstimate,
      epsActual: e.epsActual,
      revenueEstimate: e.revenueEstimate,
      revenueActual: e.revenueActual,
      period: e.period ?? 'Q',
    }));
    await setCache(cacheKey, events, 15 * 60_000);
    return events;
  } catch {
    return getMockEarnings();
  }
}

// ── Market News ───────────────────────────────────────────────────────────────

export async function getMarketNews(): Promise<NewsItem[]> {
  const cacheKey = 'market_news';
  const cached = await getCached<NewsItem[]>(cacheKey);
  if (cached) return cached;

  const key = process.env.FINNHUB_API_KEY;
  if (!key) return getMockNews();

  try {
    const { data } = await axios.get(`${FINNHUB_URL}/news?category=general&token=${key}`);
    const items: NewsItem[] = data.slice(0, 20).map((n: any) => ({
      id: n.id?.toString() ?? Math.random().toString(),
      headline: n.headline,
      summary: n.summary,
      source: n.source,
      url: n.url,
      timestamp: new Date(n.datetime * 1000).toISOString(),
      sentiment: 'NEUTRAL',
      relatedAssets: n.related ? n.related.split(',') : [],
    }));
    await setCache(cacheKey, items, 15 * 60_000);
    return items;
  } catch {
    return getMockNews();
  }
}

// ── Macro Data ────────────────────────────────────────────────────────────────

export async function getMacroData(): Promise<MacroData> {
  const cacheKey = 'macro_data';
  const cached = await getCached<MacroData>(cacheKey);
  if (cached) return cached;

  const fg = await getFearGreed();

  const macro: MacroData = {
    fedFundsRate: 4.33,
    cpi: 2.9,
    tenYearYield: 4.28,
    dxy: 104.5,
    fearGreedIndex: fg.value,
    fearGreedLabel: fg.label,
  };

  const fredKey = process.env.FRED_API_KEY;
  if (fredKey) {
    try {
      const [fedData, cpiData] = await Promise.all([
        axios.get(`${FRED_URL}?series_id=FEDFUNDS&api_key=${fredKey}&file_type=json&limit=1&sort_order=desc`),
        axios.get(`${FRED_URL}?series_id=CPIAUCSL&api_key=${fredKey}&file_type=json&limit=1&sort_order=desc`),
      ]);
      macro.fedFundsRate = parseFloat(fedData.data?.observations?.[0]?.value ?? '4.33');
      macro.cpi = parseFloat(cpiData.data?.observations?.[0]?.value ?? '2.9');
    } catch { /* use defaults */ }
  }

  await setCache(cacheKey, macro, 60 * 60_000); // 1h TTL
  return macro;
}

// ── Economic Calendar ─────────────────────────────────────────────────────────

export async function getEconomicCalendar(): Promise<EconomicEvent[]> {
  const cacheKey = 'economic_calendar';
  const cached = await getCached<EconomicEvent[]>(cacheKey);
  if (cached) return cached;

  // Use Finnhub economic calendar
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return getMockEconomicEvents();

  try {
    const from = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const { data } = await axios.get(
      `${FINNHUB_URL}/calendar/economic?from=${from}&to=${to}&token=${key}`
    );
    const events: EconomicEvent[] = (data.economicCalendar ?? []).slice(0, 30).map((e: any) => ({
      date: e.time?.slice(0, 10) ?? from,
      time: e.time?.slice(11, 16),
      event: e.event,
      country: e.country ?? 'US',
      impact: e.impact === 3 ? 'HIGH' : e.impact === 2 ? 'MEDIUM' : 'LOW',
      forecast: e.estimate?.toString(),
      previous: e.prev?.toString(),
      actual: e.actual?.toString(),
    }));
    await setCache(cacheKey, events, 15 * 60_000);
    return events;
  } catch {
    return getMockEconomicEvents();
  }
}

// ── Stock Quote ───────────────────────────────────────────────────────────────

export async function getStockQuote(symbol: string): Promise<{ price: number; change: number; changePercent: number }> {
  const cacheKey = `stock_${symbol}`;
  const cached = await getCached<{ price: number; change: number; changePercent: number }>(cacheKey);
  if (cached) return cached;

  const key = process.env.FINNHUB_API_KEY;
  if (!key) return { price: 0, change: 0, changePercent: 0 };

  try {
    const { data } = await axios.get(`${FINNHUB_URL}/quote?symbol=${symbol}&token=${key}`);
    const result = { price: data.c, change: data.d, changePercent: data.dp };
    await setCache(cacheKey, result, 5 * 60_000);
    return result;
  } catch {
    return { price: 0, change: 0, changePercent: 0 };
  }
}

// ── Mocks (when no API keys configured) ──────────────────────────────────────

function getMockEarnings(): EarningsEvent[] {
  const today = new Date();
  return [
    { date: new Date(today.getTime() + 86400000).toISOString().slice(0, 10), ticker: 'NVDA', company: 'NVIDIA Corp', epsEstimate: 4.64, period: 'Q4 2025' },
    { date: new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10), ticker: 'MSFT', company: 'Microsoft Corp', epsEstimate: 3.14, period: 'Q2 2026' },
    { date: new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10), ticker: 'AAPL', company: 'Apple Inc', epsEstimate: 2.41, period: 'Q1 2026' },
    { date: new Date(today.getTime() + 5 * 86400000).toISOString().slice(0, 10), ticker: 'GOOGL', company: 'Alphabet Inc', epsEstimate: 2.26, period: 'Q4 2025' },
    { date: new Date(today.getTime() + 6 * 86400000).toISOString().slice(0, 10), ticker: 'TSLA', company: 'Tesla Inc', epsEstimate: 0.58, period: 'Q4 2025' },
  ];
}

function getMockNews(): NewsItem[] {
  return [
    { id: '1', headline: 'Fed holds rates steady, signals patience on cuts', summary: 'Federal Reserve keeps interest rates in 4.25-4.50% range...', source: 'Reuters', url: '#', timestamp: new Date().toISOString(), sentiment: 'NEUTRAL' },
    { id: '2', headline: 'Bitcoin ETF inflows hit record $2.1B in single day', summary: 'Spot Bitcoin ETFs recorded record daily inflows...', source: 'CoinDesk', url: '#', timestamp: new Date(Date.now() - 3600000).toISOString(), sentiment: 'POSITIVE' },
    { id: '3', headline: 'NVIDIA Q4 earnings beat expectations by 18%', summary: 'NVIDIA reported Q4 revenues of $39.3B, beating consensus...', source: 'Bloomberg', url: '#', timestamp: new Date(Date.now() - 7200000).toISOString(), sentiment: 'POSITIVE' },
    { id: '4', headline: 'Swiss National Bank intervenes in FX markets', summary: 'SNB sold CHF to weaken the franc against EUR...', source: 'Financial Times', url: '#', timestamp: new Date(Date.now() - 10800000).toISOString(), sentiment: 'NEUTRAL' },
  ];
}

function getMockEconomicEvents(): EconomicEvent[] {
  const today = new Date();
  return [
    { date: today.toISOString().slice(0, 10), time: '14:30', event: 'US CPI (YoY)', country: 'US', impact: 'HIGH', forecast: '2.9%', previous: '3.0%' },
    { date: new Date(today.getTime() + 86400000).toISOString().slice(0, 10), time: '13:15', event: 'ECB Interest Rate Decision', country: 'EU', impact: 'HIGH', forecast: '2.75%', previous: '3.00%' },
    { date: new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10), time: '15:00', event: 'US Retail Sales (MoM)', country: 'US', impact: 'MEDIUM', forecast: '0.3%', previous: '-0.1%' },
    { date: new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10), time: '09:00', event: 'Germany GDP (QoQ)', country: 'DE', impact: 'MEDIUM', forecast: '0.1%', previous: '-0.2%' },
    { date: new Date(today.getTime() + 4 * 86400000).toISOString().slice(0, 10), time: '14:30', event: 'US Initial Jobless Claims', country: 'US', impact: 'MEDIUM', forecast: '215K', previous: '220K' },
    { date: new Date(today.getTime() + 5 * 86400000).toISOString().slice(0, 10), time: '09:30', event: 'SNB Monetary Policy Assessment', country: 'CH', impact: 'HIGH', previous: '0.25%' },
    { date: new Date(today.getTime() + 6 * 86400000).toISOString().slice(0, 10), time: '14:30', event: 'US Nonfarm Payrolls', country: 'US', impact: 'HIGH', forecast: '170K', previous: '256K' },
  ];
}
