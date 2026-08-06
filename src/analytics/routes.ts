/**
 * Read-only analytics + market-data endpoints.
 *
 * House rules for every handler here:
 *   - Always answer with `retrievedAt` and a `warnings` array.
 *   - A market-data failure degrades a field to null and adds a warning; it
 *     never turns into a 5xx and never becomes an invented number.
 *   - Nothing writes to a broker. There are no trading routes.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Store } from '../store';
import {
  FxConverter,
  baseCurrency,
  getDailyCloses,
  getNewsForSymbols,
  getProfiles,
  getQuotes,
  mapSymbol,
  normalizeTicker,
} from '../market';
import {
  ALLOCATION_DIMENSIONS,
  aggregateFlows,
  aggregateIncome,
  buildAllocation,
  computeConcentration,
  computeOverview,
  indexToHundred,
  parseRange,
  percentOf,
  rangeStartDate,
  round,
  round0,
  seriesReturnPercent,
  alignSeries,
} from './calc';
import type { AllocationDimension } from './calc';
import { getActivities } from './activities';
import { getPortfolioSnapshot } from './portfolio';
import { recordSnapshotHistory } from './scheduler';
import type { EnrichedPosition, PortfolioSnapshotData } from './types';
import { loadHistory, selectRange } from './valueHistory';

function nowIso(): string {
  return new Date().toISOString();
}

function dedupe(warnings: string[]): string[] {
  return Array.from(new Set(warnings.filter(Boolean)));
}

function parseMonths(value: unknown, fallback = 12): number {
  const parsed = typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 60);
}

function parseLimit(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

/**
 * Currency warnings shared by every money-bearing response, so the UI can
 * always tell the user whether a total is complete.
 */
function currencyWarnings(snapshot: PortfolioSnapshotData): string[] {
  const warnings: string[] = [];
  if (snapshot.isMixedCurrency) {
    const rates = Object.entries(snapshot.fxRates)
      .filter(([currency]) => currency !== snapshot.currency)
      .map(([currency, rate]) => `${currency}→${snapshot.currency} ${rate.toFixed(4)}`);
    if (rates.length > 0) {
      warnings.push(
        `Holdings span multiple currencies; totals are converted to ${snapshot.currency} at ${rates.join(', ')}.`,
      );
    }
  }
  for (const [currency, value] of Object.entries(snapshot.unconvertedByCurrency)) {
    warnings.push(
      `${value.toFixed(2)} ${currency} could not be converted to ${snapshot.currency} and is excluded from totals.`,
    );
  }
  return warnings;
}

function holdingWeight(position: EnrichedPosition, total: number): number | null {
  if (position.marketValueBase == null) return null;
  return round(percentOf(position.marketValueBase, total) ?? 0, 4);
}

export function createAnalyticsRouter(store: Store): Router {
  const router = Router();

  // ---- overview ----

  router.get('/overview', async (_req: Request, res: Response) => {
    try {
      const snapshot = await getPortfolioSnapshot(store);
      recordSnapshotHistory(snapshot);
      const totals = computeOverview(snapshot.positions);
      const warnings = dedupe([...snapshot.warnings, ...currencyWarnings(snapshot)]);

      if (totals.costBasisCoveragePercent < 99.5) {
        warnings.push(
          `Cost basis is available for ${totals.costBasisCoveragePercent.toFixed(1)}% of portfolio value; P&L covers only that slice.`,
        );
      }
      if (totals.dayChangeCoveragePercent < 99.5) {
        warnings.push(
          `Today's change covers ${totals.dayChangeCoveragePercent.toFixed(1)}% of portfolio value.`,
        );
      }

      res.json({
        totalValue: round0(totals.totalValue),
        costBasis: round(totals.costBasis),
        unrealizedPnl: round(totals.unrealizedPnl),
        unrealizedPnlPercent: round(totals.unrealizedPnlPercent),
        cashValue: round0(totals.cashValue),
        cashPercent: round(totals.cashPercent),
        investedValue: round0(totals.investedValue),
        holdingsCount: totals.holdingsCount,
        accountsCount: snapshot.accounts.length,
        dayChange: round(totals.dayChange),
        dayChangePercent: round(totals.dayChangePercent),
        currency: snapshot.currency,
        // Additive transparency fields (not in the base contract).
        isMixedCurrency: snapshot.isMixedCurrency,
        costBasisCoveragePercent: round0(totals.costBasisCoveragePercent),
        dayChangeCoveragePercent: round0(totals.dayChangeCoveragePercent),
        unconvertedByCurrency: snapshot.unconvertedByCurrency,
        fxRates: snapshot.fxRates,
        warnings: dedupe(warnings),
        retrievedAt: snapshot.retrievedAt,
      });
    } catch (err) {
      res.status(500).json({
        error: 'Failed to compute portfolio overview',
        message: err instanceof Error ? err.message : 'Unknown error',
        warnings: [],
        retrievedAt: nowIso(),
      });
    }
  });

  // ---- allocation ----

  router.get('/allocation', async (req: Request, res: Response) => {
    const requested = typeof req.query.by === 'string' ? req.query.by : 'assetClass';
    if (!ALLOCATION_DIMENSIONS.includes(requested as AllocationDimension)) {
      return res.status(400).json({
        error: 'Unsupported allocation dimension',
        by: requested,
        allowed: ALLOCATION_DIMENSIONS,
        warnings: [],
        retrievedAt: nowIso(),
      });
    }
    const by = requested as AllocationDimension;

    try {
      const snapshot = await getPortfolioSnapshot(store);
      const allocation = buildAllocation(snapshot.positions, by);
      const warnings = dedupe([...snapshot.warnings, ...currencyWarnings(snapshot)]);
      if (allocation.unclassifiedPercent > 0) {
        warnings.push(
          `${allocation.unclassifiedPercent.toFixed(1)}% of value could not be classified by ${by}.`,
        );
      }
      res.json({
        by,
        segments: allocation.segments,
        unclassifiedValue: allocation.unclassifiedValue,
        unclassifiedPercent: allocation.unclassifiedPercent,
        currency: snapshot.currency,
        warnings: dedupe(warnings),
        retrievedAt: snapshot.retrievedAt,
      });
    } catch (err) {
      res.status(500).json({
        error: 'Failed to compute allocation',
        message: err instanceof Error ? err.message : 'Unknown error',
        by,
        segments: [],
        warnings: [],
        retrievedAt: nowIso(),
      });
    }
  });

  // ---- concentration ----

  router.get('/concentration', async (_req: Request, res: Response) => {
    try {
      const snapshot = await getPortfolioSnapshot(store);
      const concentration = computeConcentration(snapshot.positions);
      res.json({
        top: concentration.top,
        top5Percent: concentration.top5Percent,
        top10Percent: concentration.top10Percent,
        hhi: concentration.hhi,
        effectiveHoldings: concentration.effectiveHoldings,
        flags: concentration.flags,
        currency: snapshot.currency,
        warnings: dedupe([...snapshot.warnings, ...currencyWarnings(snapshot)]),
        retrievedAt: snapshot.retrievedAt,
      });
    } catch (err) {
      res.status(500).json({
        error: 'Failed to compute concentration',
        message: err instanceof Error ? err.message : 'Unknown error',
        top: [],
        flags: [],
        warnings: [],
        retrievedAt: nowIso(),
      });
    }
  });

  // ---- holdings ----

  router.get('/holdings', async (_req: Request, res: Response) => {
    try {
      const snapshot = await getPortfolioSnapshot(store);
      const total = snapshot.positions.reduce(
        (sum, position) => sum + (position.marketValueBase ?? 0),
        0,
      );
      const holdings = snapshot.positions
        .map((position) => ({
          symbol: position.symbol,
          name: position.name,
          units: position.units,
          price: round(position.price, 6),
          marketValue: round(position.marketValueBase),
          currency: snapshot.currency,
          nativeCurrency: position.currency,
          nativeMarketValue: round(position.marketValue),
          averageCost: round(position.averageCost, 6),
          costBasis: round(position.costBasisBase),
          unrealizedPnl: round(position.unrealizedPnl),
          unrealizedPnlPercent: round(position.unrealizedPnlPercent),
          weight: holdingWeight(position, total),
          accountId: position.accountId,
          accountLabel: position.accountLabel,
          institution: position.institution,
          assetClass: position.assetClass,
          sector: position.sector,
          industry: position.industry,
          region: position.region,
          dayChange: round(position.dayChange),
          dayChangePercent: round(position.dayChangePercent),
          quoteStale: position.quoteStale,
        }))
        .sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));

      res.json({
        holdings,
        currency: snapshot.currency,
        warnings: dedupe([...snapshot.warnings, ...currencyWarnings(snapshot)]),
        retrievedAt: snapshot.retrievedAt,
      });
    } catch (err) {
      res.status(500).json({
        error: 'Failed to load holdings',
        message: err instanceof Error ? err.message : 'Unknown error',
        holdings: [],
        warnings: [],
        retrievedAt: nowIso(),
      });
    }
  });

  // ---- income ----

  router.get('/income', async (req: Request, res: Response) => {
    const months = parseMonths(req.query.months);
    try {
      const now = new Date();
      const lookup = await getActivities(store, months, now);
      const currencies = Array.from(
        new Set(lookup.activities.map((activity) => activity.currency)),
      );
      const base = baseCurrency();
      const fx = await FxConverter.load(base, currencies);
      const income = aggregateIncome(lookup.activities, months, now, (amount, currency) =>
        fx.convert(amount, currency),
      );

      const warnings = dedupe([...lookup.warnings, ...fx.warnings]);
      if (income.unconvertedCount > 0) {
        warnings.push(
          `${income.unconvertedCount} income row(s) had no FX rate and are excluded.`,
        );
      }
      if (lookup.coveredAccounts === 0) {
        warnings.push(
          'No account reported transaction history, so income is empty rather than zero.',
        );
      }

      res.json({
        ttmTotal: income.ttmTotal,
        byMonth: income.byMonth,
        bySymbol: income.bySymbol,
        currency: base,
        months,
        warnings,
        retrievedAt: lookup.retrievedAt,
      });
    } catch (err) {
      res.status(500).json({
        error: 'Failed to compute income',
        message: err instanceof Error ? err.message : 'Unknown error',
        byMonth: [],
        bySymbol: [],
        warnings: [],
        retrievedAt: nowIso(),
      });
    }
  });

  // ---- flows ----

  router.get('/flows', async (req: Request, res: Response) => {
    const months = parseMonths(req.query.months);
    try {
      const now = new Date();
      const lookup = await getActivities(store, months, now);
      const currencies = Array.from(
        new Set(lookup.activities.map((activity) => activity.currency)),
      );
      const base = baseCurrency();
      const fx = await FxConverter.load(base, currencies);
      const flows = aggregateFlows(lookup.activities, months, now, (amount, currency) =>
        fx.convert(amount, currency),
      );

      const warnings = dedupe([...lookup.warnings, ...fx.warnings]);
      if (flows.unconvertedCount > 0) {
        warnings.push(
          `${flows.unconvertedCount} cash-flow row(s) had no FX rate and are excluded.`,
        );
      }
      if (lookup.coveredAccounts === 0) {
        warnings.push(
          'No account reported transaction history, so flows are empty rather than zero.',
        );
      }

      res.json({
        byMonth: flows.byMonth,
        netTotal: flows.netTotal,
        currency: base,
        months,
        warnings,
        retrievedAt: lookup.retrievedAt,
      });
    } catch (err) {
      res.status(500).json({
        error: 'Failed to compute cash flows',
        message: err instanceof Error ? err.message : 'Unknown error',
        byMonth: [],
        netTotal: 0,
        warnings: [],
        retrievedAt: nowIso(),
      });
    }
  });

  // ---- value history ----

  router.get('/history', async (req: Request, res: Response) => {
    const range = parseRange(req.query.range, '1y');
    try {
      // Computing the portfolio is what records today's point, so do it first.
      const snapshot = await getPortfolioSnapshot(store).catch(() => null);
      if (snapshot) recordSnapshotHistory(snapshot);

      const series = selectRange(loadHistory(), range, new Date());
      const warnings: string[] = [];
      if (series.points.length < 2) {
        warnings.push(
          'Fewer than two recorded days: a value chart needs at least two points. History is never backfilled with estimated values.',
        );
      }
      res.json({
        points: series.points,
        range,
        firstRecordedAt: series.firstRecordedAt,
        isPartial: series.isPartial,
        note: series.note,
        currency: snapshot?.currency ?? baseCurrency(),
        warnings: dedupe(warnings),
        retrievedAt: nowIso(),
      });
    } catch (err) {
      res.status(500).json({
        error: 'Failed to load value history',
        message: err instanceof Error ? err.message : 'Unknown error',
        points: [],
        range,
        warnings: [],
        retrievedAt: nowIso(),
      });
    }
  });

  // ---- benchmark ----

  router.get('/benchmark', async (req: Request, res: Response) => {
    const range = parseRange(req.query.range, '1y');
    const symbol =
      typeof req.query.symbol === 'string' && req.query.symbol.trim()
        ? normalizeTicker(req.query.symbol)
        : 'SPY';
    try {
      const snapshot = await getPortfolioSnapshot(store).catch(() => null);
      if (snapshot) recordSnapshotHistory(snapshot);

      const series = selectRange(loadHistory(), range, new Date());
      const warnings: string[] = [];
      const portfolioIndexed = indexToHundred(series.points);

      if (portfolioIndexed.length < 2) {
        warnings.push(
          'Not enough recorded portfolio history to compare against a benchmark yet. At least two daily snapshots are needed.',
        );
      }

      const from =
        series.points.length > 0
          ? series.points[0].date
          : (rangeStartDate(range, new Date()) ?? '2020-01-01');
      const { series: closes, warning } = await getDailyCloses(symbol, from);
      if (warning) warnings.push(warning);

      const dates = series.points.map((point) => point.date);
      const alignedBenchmark =
        closes && dates.length > 0
          ? alignSeries(
              dates,
              closes.points.map((point) => ({ date: point.date, close: point.close })),
            )
          : [];
      const benchmarkIndexed = indexToHundred(alignedBenchmark);

      if (closes && benchmarkIndexed.length < portfolioIndexed.length) {
        warnings.push(
          'Benchmark closes are missing for some snapshot dates (market holidays); the last available close is carried forward.',
        );
      }

      res.json({
        portfolio: portfolioIndexed,
        benchmark: benchmarkIndexed,
        symbol,
        portfolioReturnPercent: seriesReturnPercent(portfolioIndexed),
        benchmarkReturnPercent: seriesReturnPercent(benchmarkIndexed),
        isPartial: series.isPartial || portfolioIndexed.length < 2,
        range,
        firstRecordedAt: series.firstRecordedAt,
        warnings: dedupe(warnings),
        retrievedAt: nowIso(),
      });
    } catch (err) {
      res.status(500).json({
        error: 'Failed to build benchmark comparison',
        message: err instanceof Error ? err.message : 'Unknown error',
        portfolio: [],
        benchmark: [],
        symbol,
        warnings: [],
        retrievedAt: nowIso(),
      });
    }
  });

  return router;
}

export function createMarketRouter(store: Store): Router {
  const router = Router();

  // ---- movers (the user's own holdings) ----

  router.get('/movers', async (req: Request, res: Response) => {
    const limit = parseLimit(req.query.limit, 5, 25);
    try {
      const snapshot = await getPortfolioSnapshot(store);
      const merged = new Map<
        string,
        { symbol: string; name: string | null; dayChangePercent: number; marketValue: number }
      >();
      for (const position of snapshot.positions) {
        if (position.dayChangePercent == null || position.marketValueBase == null) continue;
        if (position.isCash) continue;
        const existing = merged.get(position.symbol);
        if (existing) {
          existing.marketValue += position.marketValueBase;
          continue;
        }
        merged.set(position.symbol, {
          symbol: position.symbol,
          name: position.name,
          dayChangePercent: position.dayChangePercent,
          marketValue: position.marketValueBase,
        });
      }

      const rows = Array.from(merged.values()).map((row) => ({
        symbol: row.symbol,
        name: row.name,
        dayChangePercent: round0(row.dayChangePercent, 4),
        marketValue: round0(row.marketValue),
      }));
      const gainers = rows
        .filter((row) => row.dayChangePercent > 0)
        .sort((a, b) => b.dayChangePercent - a.dayChangePercent)
        .slice(0, limit);
      const losers = rows
        .filter((row) => row.dayChangePercent < 0)
        .sort((a, b) => a.dayChangePercent - b.dayChangePercent)
        .slice(0, limit);

      const warnings = dedupe([...snapshot.warnings]);
      const uncovered = snapshot.positions.filter(
        (position) => !position.isCash && position.dayChangePercent == null,
      ).length;
      if (uncovered > 0) {
        warnings.push(`${uncovered} holding(s) have no day-change data and are omitted.`);
      }

      res.json({
        gainers,
        losers,
        currency: snapshot.currency,
        warnings,
        retrievedAt: snapshot.retrievedAt,
      });
    } catch (err) {
      res.status(500).json({
        error: 'Failed to load movers',
        message: err instanceof Error ? err.message : 'Unknown error',
        gainers: [],
        losers: [],
        warnings: [],
        retrievedAt: nowIso(),
      });
    }
  });

  // ---- news for held symbols (or one symbol) ----

  router.get('/news', async (req: Request, res: Response) => {
    const limit = parseLimit(req.query.limit, 20, 50);
    const requested = typeof req.query.symbol === 'string'
      ? normalizeTicker(req.query.symbol)
      : '';
    try {
      let ranked: string[];
      if (requested) {
        const mapped = mapSymbol(requested);
        ranked = [mapped.yahooSymbol || requested];
      } else {
        const snapshot = await getPortfolioSnapshot(store);
        const byValue = new Map<string, number>();
        for (const position of snapshot.positions) {
          if (!position.yahooSymbol || position.isCash) continue;
          byValue.set(
            position.yahooSymbol,
            (byValue.get(position.yahooSymbol) || 0) + (position.marketValueBase ?? 0),
          );
        }
        ranked = Array.from(byValue.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([symbol]) => symbol);
      }

      const { articles, warnings } = await getNewsForSymbols(ranked, limit);
      res.json({
        articles,
        warnings: dedupe([...warnings]),
        retrievedAt: nowIso(),
      });
    } catch (err) {
      res.status(500).json({
        error: 'Failed to load news',
        message: err instanceof Error ? err.message : 'Unknown error',
        articles: [],
        warnings: [],
        retrievedAt: nowIso(),
      });
    }
  });

  // ---- daily price history for a symbol ----

  router.get('/history/:symbol', async (req: Request, res: Response) => {
    const requested = normalizeTicker(req.params.symbol || '');
    if (!requested) {
      return res.status(400).json({
        error: 'symbol is required',
        points: [],
        warnings: [],
        retrievedAt: nowIso(),
      });
    }

    const rangeRaw = typeof req.query.range === 'string' ? req.query.range : '1y';
    const rangeDays: Record<string, number> = {
      '1m': 31,
      '3m': 93,
      '6m': 186,
      '1y': 366,
      '5y': 366 * 5,
    };
    const days = rangeDays[rangeRaw] ?? rangeDays['1y'];
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    try {
      const mapped = mapSymbol(requested);
      if (mapped.kind === 'cash' || !mapped.yahooSymbol) {
        return res.json({
          symbol: requested,
          range: rangeRaw,
          points: [],
          currency: null,
          note: 'Cash and stablecoins do not have a meaningful price chart.',
          warnings: [],
          retrievedAt: nowIso(),
        });
      }

      const target = mapped.yahooSymbol || requested;
      const { series, warning } = await getDailyCloses(target, from);
      const warnings = warning ? [warning] : [];

      res.json({
        symbol: requested,
        yahooSymbol: target,
        range: rangeRaw,
        currency: series?.currency ?? null,
        points: (series?.points ?? []).map((p) => ({
          date: p.date,
          close: round(p.close, 6),
        })),
        warnings,
        retrievedAt: nowIso(),
      });
    } catch (err) {
      res.status(500).json({
        error: 'Failed to load price history',
        message: err instanceof Error ? err.message : 'Unknown error',
        symbol: requested,
        points: [],
        warnings: [],
        retrievedAt: nowIso(),
      });
    }
  });

  // ---- single quote ----

  router.get('/quote/:symbol', async (req: Request, res: Response) => {
    const requested = normalizeTicker(req.params.symbol || '');
    if (!requested) {
      return res.status(400).json({
        error: 'symbol is required',
        warnings: [],
        retrievedAt: nowIso(),
      });
    }
    try {
      const mapped = mapSymbol(requested);
      const target = mapped.yahooSymbol || requested;
      const lookup = await getQuotes([target]);
      const quote = lookup.quotes.get(target);
      const warnings = dedupe([...lookup.warnings]);

      if (!quote) {
        return res.status(404).json({
          symbol: requested,
          error: 'No market data for this symbol',
          warnings,
          retrievedAt: nowIso(),
        });
      }

      const profiles = await getProfiles([target]);
      const profile = profiles.profiles.get(target);
      warnings.push(...profiles.warnings);

      res.json({
        symbol: quote.symbol,
        name: quote.name,
        price: quote.price,
        currency: quote.currency,
        dayChange: round(quote.dayChange, 6),
        dayChangePercent: round(quote.dayChangePercent, 4),
        marketCap: quote.marketCap,
        peRatio: round(quote.peRatio, 4),
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        sector: profile?.sector ?? null,
        industry: profile?.industry ?? null,
        quoteStale: lookup.stale.has(target),
        warnings: dedupe(warnings),
        retrievedAt: nowIso(),
      });
    } catch (err) {
      res.status(500).json({
        error: 'Failed to load quote',
        message: err instanceof Error ? err.message : 'Unknown error',
        symbol: requested,
        warnings: [],
        retrievedAt: nowIso(),
      });
    }
  });

  return router;
}
