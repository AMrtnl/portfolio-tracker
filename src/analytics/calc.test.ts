import {
  aggregateFlows,
  aggregateIncome,
  alignSeries,
  buildAllocation,
  classifyActivity,
  computeConcentration,
  computeOverview,
  indexToHundred,
  mergeBySymbol,
  monthKey,
  parseRange,
  percentOf,
  rangeStartDate,
  recentMonths,
  round,
  seriesReturnPercent,
} from './calc';
import type { EnrichedPosition, NormalizedActivity } from './types';

function position(overrides: Partial<EnrichedPosition> = {}): EnrichedPosition {
  return {
    symbol: 'AAPL',
    yahooSymbol: 'AAPL',
    name: 'Apple Inc.',
    units: 10,
    price: 200,
    currency: 'USD',
    marketValue: 2000,
    marketValueBase: 2000,
    averageCost: 150,
    costBasis: 1500,
    costBasisBase: 1500,
    unrealizedPnl: 500,
    unrealizedPnlPercent: 33.333333,
    accountId: 'acct-1',
    accountLabel: 'Trading212',
    institution: 'Trading212',
    provider: 'snaptrade',
    isCash: false,
    assetClass: 'equity',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    region: 'North America',
    dayChange: 20,
    dayChangePercent: 1,
    quoteStale: false,
    ...overrides,
  };
}

function activity(overrides: Partial<NormalizedActivity> = {}): NormalizedActivity {
  return {
    type: 'DIVIDEND',
    symbol: 'AAPL',
    description: 'Dividend',
    amount: 10,
    currency: 'USD',
    date: '2026-07-15',
    fee: 0,
    accountId: 'acct-1',
    institution: 'Trading212',
    ...overrides,
  };
}

describe('round / percentOf', () => {
  it('keeps null distinct from zero', () => {
    expect(round(null)).toBeNull();
    expect(round(undefined)).toBeNull();
    expect(round(NaN)).toBeNull();
    expect(round(0)).toBe(0);
  });

  it('rounds money without binary floating-point drift', () => {
    // 1.005 * 100 is 100.49999999999999 in IEEE-754; a naive round loses a cent.
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(2.675, 2)).toBe(2.68);
    expect(round(1.23456, 4)).toBe(1.2346);
    expect(round(1234.567, 2)).toBe(1234.57);
  });

  it('rounds halves away from zero so gains and losses are symmetric', () => {
    expect(round(-1.005, 2)).toBe(-1.01);
    expect(round(-2.5, 0)).toBe(-3);
    expect(round(2.5, 0)).toBe(3);
  });

  it('refuses to divide by a zero total', () => {
    expect(percentOf(5, 0)).toBeNull();
    expect(percentOf(25, 200)).toBe(12.5);
  });
});

describe('computeOverview — cost basis and P&L', () => {
  it('computes unrealized P&L from cost basis', () => {
    const totals = computeOverview([position()]);
    expect(totals.totalValue).toBe(2000);
    expect(totals.costBasis).toBe(1500);
    expect(totals.unrealizedPnl).toBe(500);
    expect(totals.unrealizedPnlPercent).toBeCloseTo(33.3333, 3);
    expect(totals.costBasisCoveragePercent).toBe(100);
  });

  it('compares like with like when only some positions report a cost basis', () => {
    const totals = computeOverview([
      position(),
      position({
        symbol: 'BTC',
        marketValueBase: 1000,
        marketValue: 1000,
        costBasis: null,
        costBasisBase: null,
        averageCost: null,
        assetClass: 'crypto',
      }),
    ]);
    expect(totals.totalValue).toBe(3000);
    // Cost basis exists only for the 2000 slice — P&L must not be 3000 - 1500.
    expect(totals.costBasis).toBe(1500);
    expect(totals.unrealizedPnl).toBe(500);
    expect(totals.costBasisCoveragePercent).toBeCloseTo(66.6667, 3);
  });

  it('reports null P&L when no position has a cost basis', () => {
    const totals = computeOverview([
      position({ costBasis: null, costBasisBase: null, averageCost: null }),
    ]);
    expect(totals.costBasis).toBeNull();
    expect(totals.unrealizedPnl).toBeNull();
    expect(totals.unrealizedPnlPercent).toBeNull();
  });

  it('excludes unconvertible positions from totals instead of guessing', () => {
    const totals = computeOverview([
      position(),
      position({
        symbol: 'NESN.SW',
        currency: 'CHF',
        marketValue: 1000,
        marketValueBase: null,
        costBasis: 900,
        costBasisBase: null,
        dayChange: null,
        dayChangePercent: null,
      }),
    ]);
    expect(totals.totalValue).toBe(2000);
    expect(totals.costBasis).toBe(1500);
  });

  it('splits cash out of invested value', () => {
    const totals = computeOverview([
      position(),
      position({
        symbol: 'USD',
        isCash: true,
        assetClass: 'cash',
        marketValueBase: 500,
        marketValue: 500,
        costBasis: null,
        costBasisBase: null,
        dayChange: null,
        dayChangePercent: null,
      }),
    ]);
    expect(totals.cashValue).toBe(500);
    expect(totals.investedValue).toBe(2000);
    expect(totals.cashPercent).toBeCloseTo(20, 6);
  });

  it('derives the day change percent from yesterday, not today', () => {
    // 2000 today with +20 means 1980 yesterday → +1.0101%.
    const totals = computeOverview([position({ dayChange: 20 })]);
    expect(totals.dayChange).toBe(20);
    expect(totals.dayChangePercent).toBeCloseTo(1.0101, 4);
  });

  it('returns a null day change when no holding has quote data', () => {
    const totals = computeOverview([
      position({ dayChange: null, dayChangePercent: null }),
    ]);
    expect(totals.dayChange).toBeNull();
    expect(totals.dayChangePercent).toBeNull();
    expect(totals.dayChangeCoveragePercent).toBe(0);
  });
});

describe('buildAllocation — weights', () => {
  const positions = [
    position({ symbol: 'AAPL', marketValueBase: 5000, sector: 'Technology' }),
    position({ symbol: 'JNJ', marketValueBase: 3000, sector: 'Healthcare' }),
    position({ symbol: 'MSFT', marketValueBase: 2000, sector: 'Technology' }),
  ];

  it('sums buckets and produces percentages that add to 100', () => {
    const allocation = buildAllocation(positions, 'sector');
    expect(allocation.segments).toEqual([
      { key: 'Technology', label: 'Technology', value: 7000, percent: 70, count: 2 },
      { key: 'Healthcare', label: 'Healthcare', value: 3000, percent: 30, count: 1 },
    ]);
    const total = allocation.segments.reduce((sum, s) => sum + s.percent, 0);
    expect(total).toBeCloseTo(100, 6);
  });

  it('buckets unknown sectors as unclassified rather than inventing one', () => {
    const allocation = buildAllocation(
      [...positions, position({ symbol: 'XYZ', marketValueBase: 1000, sector: null })],
      'sector',
    );
    expect(allocation.unclassifiedValue).toBe(1000);
    expect(allocation.unclassifiedPercent).toBeCloseTo(9.09, 2);
    expect(allocation.segments.at(-1)?.key).toBe('unclassified');
  });

  it('labels cash and crypto in the sector view instead of hiding them', () => {
    const allocation = buildAllocation(
      [
        position({ marketValueBase: 1000, sector: 'Technology' }),
        position({
          symbol: 'USD',
          marketValueBase: 500,
          isCash: true,
          assetClass: 'cash',
          sector: null,
        }),
        position({
          symbol: 'BTC',
          marketValueBase: 500,
          assetClass: 'crypto',
          sector: null,
        }),
      ],
      'sector',
    );
    expect(allocation.unclassifiedValue).toBe(0);
    expect(allocation.segments.map((s) => s.key).sort()).toEqual([
      'Technology',
      'cash',
      'crypto',
    ]);
  });

  it('skips positions with no convertible value', () => {
    const allocation = buildAllocation(
      [position({ marketValueBase: 1000 }), position({ marketValueBase: null })],
      'currency',
    );
    expect(allocation.segments).toHaveLength(1);
    expect(allocation.segments[0].value).toBe(1000);
  });

  it('groups by account and institution', () => {
    const allocation = buildAllocation(
      [
        position({ accountId: 'a', accountLabel: 'Kraken', marketValueBase: 400 }),
        position({ accountId: 'b', accountLabel: 'T212', marketValueBase: 600 }),
      ],
      'account',
    );
    expect(allocation.segments[0]).toMatchObject({ key: 'b', label: 'T212', percent: 60 });
  });
});

describe('computeConcentration — HHI', () => {
  it('computes HHI and effective holdings from percent weights', () => {
    const result = computeConcentration([
      position({ symbol: 'A', marketValueBase: 5000 }),
      position({ symbol: 'B', marketValueBase: 3000 }),
      position({ symbol: 'C', marketValueBase: 2000 }),
    ]);
    // 50² + 30² + 20² = 3800
    expect(result.hhi).toBe(3800);
    expect(result.effectiveHoldings).toBeCloseTo(2.63, 2);
    expect(result.top5Percent).toBe(100);
  });

  it('gives an equal-weight book an effective count equal to its size', () => {
    const positions = Array.from({ length: 10 }, (_, i) =>
      position({ symbol: `S${i}`, marketValueBase: 100 }),
    );
    const result = computeConcentration(positions);
    expect(result.hhi).toBe(1000);
    expect(result.effectiveHoldings).toBe(10);
    expect(result.top5Percent).toBe(50);
    expect(result.top10Percent).toBe(100);
  });

  it('merges the same ticker held in several accounts', () => {
    const merged = mergeBySymbol([
      position({ symbol: 'AAPL', accountId: 'a', marketValueBase: 600 }),
      position({ symbol: 'AAPL', accountId: 'b', marketValueBase: 400 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ symbol: 'AAPL', value: 1000, percent: 100 });
  });

  it('flags a dominant single name', () => {
    const result = computeConcentration([
      position({ symbol: 'A', marketValueBase: 9000 }),
      position({ symbol: 'B', marketValueBase: 1000 }),
    ]);
    expect(result.flags.some((f) => f.level === 'high')).toBe(true);
  });

  it('handles an empty portfolio without dividing by zero', () => {
    const result = computeConcentration([]);
    expect(result.hhi).toBe(0);
    expect(result.effectiveHoldings).toBe(0);
    expect(result.flags[0].level).toBe('info');
  });
});

describe('classifyActivity', () => {
  it('maps broker activity types to buckets', () => {
    expect(classifyActivity(activity({ type: 'DIVIDEND' }))).toBe('dividend');
    expect(classifyActivity(activity({ type: 'interest' }))).toBe('interest');
    expect(classifyActivity(activity({ type: 'CONTRIBUTION' }))).toBe('deposit');
    expect(classifyActivity(activity({ type: 'WITHDRAWAL' }))).toBe('withdrawal');
    expect(classifyActivity(activity({ type: 'BUY' }))).toBe('other');
  });

  it('splits generic transfers by the sign of the amount', () => {
    expect(classifyActivity(activity({ type: 'TRANSFER', amount: 500 }))).toBe('deposit');
    expect(classifyActivity(activity({ type: 'TRANSFER', amount: -500 }))).toBe(
      'withdrawal',
    );
    expect(classifyActivity(activity({ type: 'TRANSFER', amount: 0 }))).toBe('other');
  });
});

describe('recentMonths / monthKey', () => {
  it('returns the trailing window ending in the current month', () => {
    const months = recentMonths(3, new Date('2026-08-06T12:00:00Z'));
    expect(months).toEqual(['2026-06', '2026-07', '2026-08']);
  });

  it('crosses a year boundary', () => {
    expect(recentMonths(3, new Date('2026-02-10T00:00:00Z'))).toEqual([
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  it('extracts a month key or null', () => {
    expect(monthKey('2026-07-15')).toBe('2026-07');
    expect(monthKey(null)).toBeNull();
    expect(monthKey('nope')).toBeNull();
  });
});

describe('aggregateIncome', () => {
  const now = new Date('2026-08-06T12:00:00Z');
  const convert = (amount: number, currency: string) =>
    currency === 'USD' ? amount : currency === 'CHF' ? amount * 1.25 : null;

  it('aggregates dividends and interest by month and symbol', () => {
    const result = aggregateIncome(
      [
        activity({ symbol: 'AAPL', amount: 10, date: '2026-07-15' }),
        activity({ symbol: 'AAPL', amount: 12, date: '2026-08-01' }),
        activity({ symbol: 'MSFT', amount: 8, date: '2026-08-02' }),
        activity({ type: 'INTEREST', symbol: null, amount: 3, date: '2026-08-03' }),
      ],
      3,
      now,
      convert,
    );

    expect(result.byMonth).toEqual([
      { month: '2026-06', dividends: 0, interest: 0, total: 0 },
      { month: '2026-07', dividends: 10, interest: 0, total: 10 },
      { month: '2026-08', dividends: 20, interest: 3, total: 23 },
    ]);
    expect(result.ttmTotal).toBe(33);
    expect(result.bySymbol).toEqual([
      { symbol: 'AAPL', total: 22, count: 2 },
      { symbol: 'MSFT', total: 8, count: 1 },
      { symbol: 'INTEREST', total: 3, count: 1 },
    ]);
  });

  it('converts foreign-currency dividends', () => {
    const result = aggregateIncome(
      [activity({ amount: 100, currency: 'CHF', date: '2026-08-01' })],
      1,
      now,
      convert,
    );
    expect(result.byMonth[0].dividends).toBe(125);
  });

  it('excludes rows with no FX rate rather than counting them at 1:1', () => {
    const result = aggregateIncome(
      [activity({ amount: 100, currency: 'JPY', date: '2026-08-01' })],
      1,
      now,
      convert,
    );
    expect(result.ttmTotal).toBe(0);
    expect(result.unconvertedCount).toBe(1);
  });

  it('ignores activity outside the requested window', () => {
    const result = aggregateIncome(
      [activity({ amount: 50, date: '2024-01-05' })],
      3,
      now,
      convert,
    );
    expect(result.ttmTotal).toBe(0);
  });

  it('ignores non-income activity and negative reinvestment legs', () => {
    const result = aggregateIncome(
      [
        activity({ type: 'BUY', amount: 500, date: '2026-08-01' }),
        activity({ type: 'DIVIDEND', amount: -20, date: '2026-08-01' }),
      ],
      1,
      now,
      convert,
    );
    expect(result.ttmTotal).toBe(0);
  });
});

describe('aggregateFlows', () => {
  const now = new Date('2026-08-06T12:00:00Z');
  const convert = (amount: number, currency: string) =>
    currency === 'USD' ? amount : null;

  it('nets deposits against withdrawals per month', () => {
    const result = aggregateFlows(
      [
        activity({ type: 'CONTRIBUTION', amount: 1000, date: '2026-07-02' }),
        activity({ type: 'CONTRIBUTION', amount: 500, date: '2026-08-02' }),
        activity({ type: 'WITHDRAWAL', amount: -200, date: '2026-08-04' }),
      ],
      2,
      now,
      convert,
    );
    expect(result.byMonth).toEqual([
      { month: '2026-07', deposits: 1000, withdrawals: 0, net: 1000 },
      { month: '2026-08', deposits: 500, withdrawals: 200, net: 300 },
    ]);
    expect(result.netTotal).toBe(1300);
  });

  it('reports withdrawals as positive magnitudes regardless of broker sign', () => {
    const result = aggregateFlows(
      [activity({ type: 'WITHDRAWAL', amount: 300, date: '2026-08-04' })],
      1,
      now,
      convert,
    );
    expect(result.byMonth[0].withdrawals).toBe(300);
    expect(result.byMonth[0].net).toBe(-300);
  });
});

describe('indexToHundred', () => {
  it('rebases a series to 100 at the range start', () => {
    expect(
      indexToHundred([
        { date: '2026-01-01', value: 1000 },
        { date: '2026-01-02', value: 1100 },
        { date: '2026-01-03', value: 900 },
      ]),
    ).toEqual([
      { date: '2026-01-01', indexed: 100 },
      { date: '2026-01-02', indexed: 110 },
      { date: '2026-01-03', indexed: 90 },
    ]);
  });

  it('returns nothing when the base is zero or the series is empty', () => {
    expect(indexToHundred([])).toEqual([]);
    expect(indexToHundred([{ date: '2026-01-01', value: 0 }])).toEqual([]);
  });

  it('derives total return from the last indexed point', () => {
    const indexed = indexToHundred([
      { date: '2026-01-01', value: 200 },
      { date: '2026-01-02', value: 250 },
    ]);
    expect(seriesReturnPercent(indexed)).toBe(25);
    expect(seriesReturnPercent(indexed.slice(0, 1))).toBeNull();
  });
});

describe('alignSeries', () => {
  it('carries the last close forward across market holidays', () => {
    const aligned = alignSeries(
      ['2026-01-01', '2026-01-02', '2026-01-03'],
      [
        { date: '2025-12-31', close: 100 },
        { date: '2026-01-02', close: 110 },
      ],
    );
    expect(aligned).toEqual([
      { date: '2026-01-01', value: 100 },
      { date: '2026-01-02', value: 110 },
      { date: '2026-01-03', value: 110 },
    ]);
  });

  it('drops dates that precede the first available close', () => {
    expect(
      alignSeries(['2026-01-01'], [{ date: '2026-02-01', close: 100 }]),
    ).toEqual([]);
  });
});

describe('range parsing', () => {
  it('falls back for unknown ranges', () => {
    expect(parseRange('3m')).toBe('3m');
    expect(parseRange('bogus')).toBe('1y');
    expect(parseRange(undefined, '6m')).toBe('6m');
  });

  it('computes an inclusive start date, with null meaning all history', () => {
    const now = new Date('2026-08-06T00:00:00Z');
    expect(rangeStartDate('1m', now)).toBe('2026-07-06');
    expect(rangeStartDate('1y', now)).toBe('2025-08-06');
    expect(rangeStartDate('all', now)).toBeNull();
  });
});
