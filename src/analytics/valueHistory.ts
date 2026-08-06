/**
 * Daily portfolio-value history.
 *
 * The app had no history at all, which blocks every chart. This records one
 * point per UTC day to `DATA_DIR/history.json` as the portfolio is computed.
 * History therefore starts on the day this ships and grows forward — nothing
 * here ever backfills a synthetic value, and every response says how far back
 * the real data goes.
 */
import fs from 'fs';
import path from 'path';
import type { Range } from './calc';
import { rangeStartDate } from './calc';

export interface DailySnapshot {
  /** YYYY-MM-DD, UTC. */
  date: string;
  totalValue: number;
  byAccount: Record<string, number>;
  currency: string;
}

export interface HistoryFile {
  version: 1;
  days: DailySnapshot[];
}

const EMPTY: HistoryFile = { version: 1, days: [] };

function dataDir(): string {
  return process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.resolve(__dirname, '..', '..', 'data');
}

function historyFile(): string {
  return path.join(dataDir(), 'history.json');
}

export function utcDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function loadHistory(): HistoryFile {
  try {
    const file = historyFile();
    if (!fs.existsSync(file)) return { ...EMPTY, days: [] };
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<HistoryFile>;
    const days = Array.isArray(parsed.days) ? parsed.days : [];
    return {
      version: 1,
      days: days
        .filter(
          (day): day is DailySnapshot =>
            Boolean(day) &&
            typeof day.date === 'string' &&
            typeof day.totalValue === 'number' &&
            Number.isFinite(day.totalValue),
        )
        .map((day) => ({
          date: day.date,
          totalValue: day.totalValue,
          byAccount: day.byAccount && typeof day.byAccount === 'object' ? day.byAccount : {},
          currency: typeof day.currency === 'string' ? day.currency : 'USD',
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  } catch (err) {
    console.warn(
      '⚠️  Could not read history.json, starting fresh:',
      err instanceof Error ? err.message : err,
    );
    return { ...EMPTY, days: [] };
  }
}

function writeHistory(file: HistoryFile): void {
  const dir = dataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(historyFile(), JSON.stringify(file, null, 2), 'utf8');
}

/**
 * Adds `snapshot` when its day is not recorded yet. Pure so the once-per-day
 * rule can be tested without touching disk.
 */
export function upsertDay(
  file: HistoryFile,
  snapshot: DailySnapshot,
): { file: HistoryFile; changed: boolean } {
  if (file.days.some((day) => day.date === snapshot.date)) {
    return { file, changed: false };
  }
  const days = [...file.days, snapshot].sort((a, b) => a.date.localeCompare(b.date));
  return { file: { version: 1, days }, changed: true };
}

/** Writes today's value if today has no entry yet. */
export function recordDailySnapshot(snapshot: DailySnapshot): boolean {
  try {
    const current = loadHistory();
    const { file, changed } = upsertDay(current, snapshot);
    if (!changed) return false;
    writeHistory(file);
    console.log(`📈 Recorded portfolio value snapshot for ${snapshot.date}`);
    return true;
  } catch (err) {
    console.warn(
      '⚠️  Could not persist portfolio history:',
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

export interface HistorySeries {
  points: Array<{ date: string; value: number }>;
  firstRecordedAt: string | null;
  /** True when the recorded history is shorter than the requested range. */
  isPartial: boolean;
  note: string;
}

/** Slices recorded history to a range and describes the gap honestly. */
export function selectRange(
  file: HistoryFile,
  range: Range,
  now: Date = new Date(),
): HistorySeries {
  const firstRecordedAt = file.days.length > 0 ? file.days[0].date : null;
  const start = rangeStartDate(range, now);
  const points = file.days
    .filter((day) => (start ? day.date >= start : true))
    .map((day) => ({ date: day.date, value: day.totalValue }));

  if (firstRecordedAt == null) {
    return {
      points: [],
      firstRecordedAt: null,
      isPartial: true,
      note: 'No history recorded yet. Meridian stores one portfolio value per day starting from the first time the portfolio is computed; this chart fills in from tomorrow.',
    };
  }

  const isPartial = Boolean(start && firstRecordedAt > start);
  const note = isPartial
    ? `History starts ${firstRecordedAt}. Values before that were never recorded and are not estimated, so this range is partial.`
    : `Daily closes recorded since ${firstRecordedAt}.`;

  return { points, firstRecordedAt, isPartial, note };
}

/** Test seam — resets the on-disk file. */
export function resetHistoryForTests(): void {
  writeHistory({ version: 1, days: [] });
}
