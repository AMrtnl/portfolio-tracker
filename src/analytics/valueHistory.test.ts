import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  HistoryStore,
  loadHistory,
  recordDailySnapshot,
  selectRange,
  upsertDay,
  utcDate,
} from './valueHistory';
import type { HistoryFile } from './valueHistory';

function file(days: Array<{ date: string; totalValue: number }>): HistoryFile {
  return {
    version: 1,
    days: days.map((day) => ({ ...day, byAccount: {}, currency: 'USD' })),
  };
}

describe('utcDate', () => {
  it('formats a UTC day key', () => {
    expect(utcDate(new Date('2026-08-06T23:30:00Z'))).toBe('2026-08-06');
  });
});

describe('upsertDay — at most one point per day', () => {
  const snapshot = {
    date: '2026-08-06',
    totalValue: 3300,
    byAccount: { a: 3300 },
    currency: 'USD',
  };

  it('adds a day that is not recorded yet', () => {
    const result = upsertDay(file([]), snapshot);
    expect(result.changed).toBe(true);
    expect(result.file.days).toHaveLength(1);
  });

  it('leaves an already-recorded day alone', () => {
    const existing = file([{ date: '2026-08-06', totalValue: 3200 }]);
    const result = upsertDay(existing, snapshot);
    expect(result.changed).toBe(false);
    expect(result.file.days[0].totalValue).toBe(3200);
  });

  it('keeps days sorted by date', () => {
    const existing = file([
      { date: '2026-08-07', totalValue: 1 },
      { date: '2026-08-05', totalValue: 2 },
    ]);
    const result = upsertDay(existing, snapshot);
    expect(result.file.days.map((d) => d.date)).toEqual([
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ]);
  });
});

describe('selectRange', () => {
  const now = new Date('2026-08-06T12:00:00Z');

  it('says so honestly when nothing has been recorded', () => {
    const series = selectRange(file([]), '1y', now);
    expect(series.points).toEqual([]);
    expect(series.firstRecordedAt).toBeNull();
    expect(series.isPartial).toBe(true);
    expect(series.note).toMatch(/No history recorded yet/);
  });

  it('marks a range partial when history starts after the range start', () => {
    const series = selectRange(
      file([
        { date: '2026-08-04', totalValue: 3200 },
        { date: '2026-08-05', totalValue: 3250 },
      ]),
      '1y',
      now,
    );
    expect(series.isPartial).toBe(true);
    expect(series.firstRecordedAt).toBe('2026-08-04');
    expect(series.note).toMatch(/History starts 2026-08-04/);
    expect(series.points).toHaveLength(2);
  });

  it('is complete when history predates the range start', () => {
    const series = selectRange(
      file([
        { date: '2025-01-01', totalValue: 1000 },
        { date: '2026-08-05', totalValue: 3250 },
      ]),
      '1m',
      now,
    );
    expect(series.isPartial).toBe(false);
    // The 2025 point is outside a one-month window.
    expect(series.points).toEqual([{ date: '2026-08-05', value: 3250 }]);
  });

  it('returns everything for range=all', () => {
    const series = selectRange(
      file([
        { date: '2025-01-01', totalValue: 1000 },
        { date: '2026-08-05', totalValue: 3250 },
      ]),
      'all',
      now,
    );
    expect(series.points).toHaveLength(2);
    expect(series.isPartial).toBe(false);
  });

  it('never fabricates points between recorded days', () => {
    const series = selectRange(
      file([
        { date: '2026-08-01', totalValue: 3000 },
        { date: '2026-08-05', totalValue: 3300 },
      ]),
      '1m',
      now,
    );
    expect(series.points.map((p) => p.date)).toEqual(['2026-08-01', '2026-08-05']);
  });
});

describe('recordDailySnapshot — disk round trip', () => {
  let tempDir: string;
  let history: HistoryStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-history-'));
    history = new HistoryStore(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes the first snapshot of a day and skips the rest', () => {
    const snapshot = {
      date: '2026-08-06',
      totalValue: 3300.12,
      byAccount: { 'acct-1': 3300.12 },
      currency: 'USD',
    };
    expect(recordDailySnapshot(history, snapshot)).toBe(true);
    expect(recordDailySnapshot(history, { ...snapshot, totalValue: 9999 })).toBe(false);

    const stored = loadHistory(history);
    expect(stored.days).toHaveLength(1);
    expect(stored.days[0].totalValue).toBe(3300.12);
    expect(fs.existsSync(path.join(tempDir, 'history.json'))).toBe(true);
  });

  it('accumulates distinct days', () => {
    recordDailySnapshot(history, {
      date: '2026-08-06',
      totalValue: 100,
      byAccount: {},
      currency: 'USD',
    });
    recordDailySnapshot(history, {
      date: '2026-08-07',
      totalValue: 110,
      byAccount: {},
      currency: 'USD',
    });
    expect(loadHistory(history).days.map((d) => d.totalValue)).toEqual([100, 110]);
  });

  it('starts fresh instead of throwing on a corrupt file', () => {
    fs.writeFileSync(path.join(tempDir, 'history.json'), '{ not json', 'utf8');
    expect(loadHistory(history).days).toEqual([]);
  });

  it('drops malformed rows on read', () => {
    fs.writeFileSync(
      path.join(tempDir, 'history.json'),
      JSON.stringify({
        version: 1,
        days: [
          { date: '2026-08-06', totalValue: 100, currency: 'USD' },
          { date: '2026-08-07', totalValue: 'nope' },
          null,
        ],
      }),
      'utf8',
    );
    const stored = loadHistory(history);
    expect(stored.days).toHaveLength(1);
    expect(stored.days[0].byAccount).toEqual({});
  });

  it('keeps two directories apart', () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-history-other-'));
    try {
      recordDailySnapshot(history, {
        date: '2026-08-06',
        totalValue: 100,
        byAccount: {},
        currency: 'USD',
      });
      expect(loadHistory(new HistoryStore(other)).days).toEqual([]);
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });
});
