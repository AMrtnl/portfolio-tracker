/**
 * Builds one normalized, market-enriched view of the whole portfolio that all
 * analytics endpoints share.
 *
 * Position values come from the source of record (the broker or the chain),
 * never from Yahoo — Yahoo only supplies classification (sector/region/asset
 * class), the day's move, and FX. A market-data outage therefore degrades
 * classification, not the totals.
 */
import type { PublicAccount } from '../types/accounts';
import type { Store } from '../store';
import {
  FxConverter,
  assetClassFromQuoteType,
  baseCurrency,
  getProfiles,
  getQuotes,
  isStablecoin,
  mapSymbol,
  normalizeTicker,
  regionFromSymbol,
} from '../market';
import type { MarketAssetClass, MarketQuote } from '../market';
import { getProvider, hasLiveAdapter } from '../providers';
import { errorMessage, fetchBalancesAndPositions, isSnaptradeConfigured } from '../snaptrade';
import type { AccountRef, EnrichedPosition, PortfolioSnapshotData } from './types';

/** Raw holding before market enrichment. */
interface RawPosition {
  symbol: string;
  name: string | null;
  units: number;
  price: number | null;
  currency: string;
  marketValue: number | null;
  averageCost: number | null;
  isCash: boolean;
  account: AccountRef;
}

const SNAPSHOT_TTL_MS = 60_000;

let cached: { data: PortfolioSnapshotData; expiresAt: number } | null = null;

function accountRef(account: PublicAccount): AccountRef {
  return {
    accountId: account.id,
    label: account.label,
    institution: account.institution || account.provider,
    provider: account.provider,
    currency: normalizeTicker(account.currency) || 'USD',
    externalId: account.externalId,
  };
}

async function collectSnaptrade(
  account: PublicAccount,
  warnings: string[],
): Promise<RawPosition[]> {
  if (!account.externalId) return [];
  const ref = accountRef(account);
  const out: RawPosition[] = [];
  try {
    const { balances, positions, error } = await fetchBalancesAndPositions(
      account.externalId,
    );
    if (error) warnings.push(`${account.label}: ${error}`);

    for (const balance of balances) {
      if (balance.cash == null || balance.cash === 0) continue;
      out.push({
        symbol: normalizeTicker(balance.currency) || 'CASH',
        name: `${balance.currency} cash`,
        units: balance.cash,
        price: 1,
        currency: normalizeTicker(balance.currency) || ref.currency,
        marketValue: balance.cash,
        averageCost: 1,
        isCash: true,
        account: ref,
      });
    }

    for (const position of positions) {
      // Money-market sweeps are already inside the reported cash balance;
      // counting them again would inflate the total. Matches /api/portfolio.
      if (position.cashEquivalent) continue;
      const price = position.price;
      const marketValue =
        position.marketValue ?? (price != null ? Math.abs(position.units) * price : null);
      out.push({
        symbol: normalizeTicker(position.symbol),
        name: position.name ?? null,
        units: position.units,
        price,
        currency: normalizeTicker(position.currency) || ref.currency,
        marketValue,
        averageCost: position.averageCost,
        isCash: false,
        account: ref,
      });
    }
  } catch (err) {
    warnings.push(`${account.label}: ${errorMessage(err)}`);
  }
  return out;
}

async function collectViaProvider(
  account: PublicAccount,
  warnings: string[],
): Promise<RawPosition[]> {
  const ref = accountRef(account);
  try {
    const provider = getProvider(account.provider);
    const result = await provider.sync(account);
    if (result.error) warnings.push(`${account.label}: ${result.error}`);
    return result.balances
      .filter((balance) => parseFloat(balance.usdValue || '0') !== 0)
      .map((balance) => {
        const amount = parseFloat(balance.amount || '0');
        const usd = parseFloat(balance.usdValue || '0');
        return {
          symbol: normalizeTicker(balance.asset),
          name: balance.asset,
          units: amount,
          price: amount !== 0 ? usd / amount : null,
          // Hyperliquid and manual holdings are valued in USD by their adapters.
          currency: 'USD',
          marketValue: usd,
          averageCost: null,
          isCash: isStablecoin(balance.asset),
          account: ref,
        };
      });
  } catch (err) {
    warnings.push(
      `${account.label}: ${err instanceof Error ? err.message : 'sync failed'}`,
    );
    return [];
  }
}

function classify(
  raw: RawPosition,
  quote: MarketQuote | undefined,
  yahooSymbol: string | null,
  kind: string,
): MarketAssetClass {
  if (raw.isCash) return 'cash';
  if (kind === 'cash') return 'cash';
  if (quote?.quoteType) {
    const fromQuote = assetClassFromQuoteType(quote.quoteType);
    if (fromQuote !== 'unclassified') return fromQuote;
  }
  if (kind === 'crypto') return 'crypto';
  if (yahooSymbol) return 'unclassified';
  return 'unclassified';
}

/**
 * Reads every account, enriches it with market data and FX, and returns the
 * shared snapshot. Cached for a minute so a dashboard fanning out to eight
 * analytics endpoints syncs the brokers once.
 */
export async function getPortfolioSnapshot(
  store: Store,
  options: { force?: boolean } = {},
): Promise<PortfolioSnapshotData> {
  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const warnings: string[] = [];
  const liveIds = new Set(
    store
      .getAllRaw()
      .filter((a) => a.provider === 'hyperliquid' && hasLiveAdapter(a.id))
      .map((a) => a.id),
  );
  const accounts = store.getAccounts(liveIds);

  const collected = await Promise.all(
    accounts.map(async (account) => {
      if (account.provider === 'snaptrade') {
        if (!isSnaptradeConfigured()) {
          warnings.push(
            `${account.label}: SnapTrade is not configured on the server; this account is omitted.`,
          );
          return [];
        }
        return collectSnaptrade(account, warnings);
      }
      return collectViaProvider(account, warnings);
    }),
  );
  const rawPositions = collected.flat();

  // --- market data ---

  const mapped = rawPositions.map((raw) =>
    mapSymbol(raw.symbol, {
      provider: raw.account.provider,
      institution: raw.account.institution,
      currency: raw.currency,
      cashEquivalent: raw.isCash,
    }),
  );

  const quoteSymbols = Array.from(
    new Set(
      mapped
        .map((m) => m.yahooSymbol)
        .filter((s): s is string => Boolean(s)),
    ),
  );

  const quoteLookup = await getQuotes(quoteSymbols);
  warnings.push(...quoteLookup.warnings);

  // Profiles only make sense for securities; crypto and cash have no sector.
  const profileSymbols = quoteSymbols.filter((symbol) => {
    const quote = quoteLookup.quotes.get(symbol);
    const assetClass = assetClassFromQuoteType(quote?.quoteType);
    return assetClass === 'equity' || assetClass === 'etf' || assetClass === 'fund';
  });
  const profileLookup = await getProfiles(profileSymbols);
  warnings.push(...profileLookup.warnings);

  // --- currency ---

  const base = baseCurrency();
  const currencies = new Set<string>([base]);
  for (const raw of rawPositions) currencies.add(raw.currency);
  const fx = await FxConverter.load(base, Array.from(currencies));
  warnings.push(...fx.warnings);

  // --- enrich ---

  const positions: EnrichedPosition[] = [];
  const unconvertedByCurrency: Record<string, number> = {};

  for (let i = 0; i < rawPositions.length; i++) {
    const raw = rawPositions[i];
    const symbol = mapped[i];
    const quote = symbol.yahooSymbol
      ? quoteLookup.quotes.get(symbol.yahooSymbol)
      : undefined;
    const profile = symbol.yahooSymbol
      ? profileLookup.profiles.get(symbol.yahooSymbol)
      : undefined;

    // Broker/chain value wins. Yahoo only fills a genuine gap, and then only
    // when its quote is in the same currency the position is reported in.
    let currency = raw.currency;
    let price = raw.price;
    let marketValue = raw.marketValue;
    if (marketValue == null && quote?.price != null) {
      price = quote.price;
      currency = quote.currency || raw.currency;
      marketValue = Math.abs(raw.units) * quote.price;
    }

    const marketValueBase = fx.convert(marketValue, currency);
    if (marketValue != null && marketValueBase == null) {
      unconvertedByCurrency[currency] =
        (unconvertedByCurrency[currency] || 0) + marketValue;
    }

    const costBasis =
      raw.averageCost != null ? raw.averageCost * Math.abs(raw.units) : null;
    const costBasisBase = fx.convert(costBasis, currency);
    const unrealizedPnl =
      marketValueBase != null && costBasisBase != null
        ? marketValueBase - costBasisBase
        : null;
    const unrealizedPnlPercent =
      unrealizedPnl != null && costBasisBase != null && costBasisBase !== 0
        ? (unrealizedPnl / Math.abs(costBasisBase)) * 100
        : null;

    const dayChangePercent = quote?.dayChangePercent ?? null;
    // Derive the move from our own value so a broker/Yahoo price gap does not
    // leak into the amount.
    const dayChange =
      dayChangePercent != null && marketValueBase != null
        ? marketValueBase - marketValueBase / (1 + dayChangePercent / 100)
        : null;

    const assetClass = classify(raw, quote, symbol.yahooSymbol, symbol.kind);

    positions.push({
      symbol: raw.symbol,
      yahooSymbol: symbol.yahooSymbol,
      name: raw.name || quote?.name || null,
      units: raw.units,
      price,
      currency,
      marketValue,
      marketValueBase,
      averageCost: raw.averageCost,
      costBasis,
      costBasisBase,
      unrealizedPnl,
      unrealizedPnlPercent,
      accountId: raw.account.accountId,
      accountLabel: raw.account.label,
      institution: raw.account.institution,
      provider: raw.account.provider,
      isCash: raw.isCash || assetClass === 'cash',
      assetClass,
      sector: profile?.sector ?? null,
      industry: profile?.industry ?? null,
      region:
        assetClass === 'crypto'
          ? 'Crypto'
          : assetClass === 'cash'
            ? 'Cash'
            : (profile?.region ?? regionFromSymbol(symbol.yahooSymbol)),
      dayChange,
      dayChangePercent,
      quoteStale: symbol.yahooSymbol
        ? quoteLookup.stale.has(symbol.yahooSymbol)
        : false,
    });
  }

  const nativeCurrencies = new Set(positions.map((p) => p.currency));
  const data: PortfolioSnapshotData = {
    positions,
    accounts: accounts.map(accountRef),
    currency: base,
    isMixedCurrency: nativeCurrencies.size > 1,
    unconvertedCurrencies: Object.keys(unconvertedByCurrency),
    unconvertedByCurrency,
    fxRates: fx.ratesUsed(),
    warnings: Array.from(new Set(warnings)),
    retrievedAt: new Date().toISOString(),
  };

  cached = { data, expiresAt: Date.now() + SNAPSHOT_TTL_MS };
  return data;
}

export function invalidatePortfolioSnapshot(): void {
  cached = null;
}
