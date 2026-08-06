/**
 * Keeps the daily value history growing even when nobody opens the dashboard.
 *
 * Without this, a day the user never visits would simply have no data point
 * and the chart would show a gap we refuse to interpolate.
 */
import type { Store } from '../store';
import { round0 } from './calc';
import { getPortfolioSnapshot } from './portfolio';
import type { PortfolioSnapshotData } from './types';
import { recordDailySnapshot, utcDate } from './valueHistory';

/** Writes today's point if it is not already recorded. */
export function recordSnapshotHistory(snapshot: PortfolioSnapshotData): boolean {
  const byAccount: Record<string, number> = {};
  let totalValue = 0;
  for (const position of snapshot.positions) {
    if (position.marketValueBase == null) continue;
    totalValue += position.marketValueBase;
    byAccount[position.accountId] =
      (byAccount[position.accountId] || 0) + position.marketValueBase;
  }
  // A zero total means every source failed; recording it would put a fake
  // crash to $0 in the chart.
  if (!(totalValue > 0)) return false;

  return recordDailySnapshot({
    date: utcDate(),
    totalValue: round0(totalValue),
    byAccount: Object.fromEntries(
      Object.entries(byAccount).map(([id, value]) => [id, round0(value)]),
    ),
    currency: snapshot.currency,
  });
}

const INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Let account rehydration and the first syncs settle before the first run. */
const BOOT_DELAY_MS = 60_000;

let timers: NodeJS.Timeout[] = [];

export function startHistoryScheduler(store: Store): void {
  const run = async () => {
    try {
      const snapshot = await getPortfolioSnapshot(store, { force: true });
      recordSnapshotHistory(snapshot);
    } catch (err) {
      console.warn(
        '⚠️  Scheduled portfolio snapshot failed:',
        err instanceof Error ? err.message : err,
      );
    }
  };

  const boot = setTimeout(run, BOOT_DELAY_MS);
  boot.unref?.();
  const interval = setInterval(run, INTERVAL_MS);
  interval.unref?.();
  timers = [boot, interval];
}

export function stopHistoryScheduler(): void {
  for (const timer of timers) clearTimeout(timer as NodeJS.Timeout);
  timers = [];
}
