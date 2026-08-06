/**
 * Broker activity history (dividends, interest, deposits, withdrawals).
 *
 * Only SnapTrade reports activities today; Hyperliquid and manual accounts
 * contribute nothing, which the endpoints surface as a coverage warning rather
 * than as a zero.
 */
import type { Store } from '../store';
import { errorMessage, fetchSnapActivities, isSnaptradeConfigured } from '../snaptrade';
import { normalizeTicker } from '../market';
import type { NormalizedActivity } from './types';

export interface ActivityLookup {
  activities: NormalizedActivity[];
  /** Accounts whose activity history we could read. */
  coveredAccounts: number;
  /** Accounts that cannot report activities at all. */
  uncoveredAccounts: string[];
  warnings: string[];
  retrievedAt: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
/** SnapTrade caps a single activities page; this is its documented maximum. */
const PAGE_LIMIT = 1000;

let cached: { key: string; data: ActivityLookup; expiresAt: number } | null = null;

function startDateForMonths(months: number, now: Date): string {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
  );
  return start.toISOString().slice(0, 10);
}

export async function getActivities(
  store: Store,
  months: number,
  now: Date = new Date(),
): Promise<ActivityLookup> {
  const startDate = startDateForMonths(months, now);
  const endDate = now.toISOString().slice(0, 10);
  const key = `${startDate}:${endDate}`;
  if (cached && cached.key === key && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const warnings: string[] = [];
  const uncoveredAccounts: string[] = [];
  const activities: NormalizedActivity[] = [];
  let coveredAccounts = 0;

  const accounts = store.getAccounts();
  const snaptradeAccounts = accounts.filter(
    (account) => account.provider === 'snaptrade' && account.externalId,
  );
  for (const account of accounts) {
    if (account.provider !== 'snaptrade') uncoveredAccounts.push(account.label);
  }

  if (snaptradeAccounts.length > 0 && !isSnaptradeConfigured()) {
    warnings.push(
      'SnapTrade is not configured on the server, so no dividend or cash-flow history is available.',
    );
  } else {
    const results = await Promise.all(
      snaptradeAccounts.map(async (account) => {
        try {
          const { activities: rows } = await fetchSnapActivities(account.externalId!, {
            startDate,
            endDate,
            limit: PAGE_LIMIT,
          });
          return { account, rows, error: undefined as string | undefined };
        } catch (err) {
          return { account, rows: [], error: errorMessage(err) };
        }
      }),
    );

    for (const result of results) {
      if (result.error) {
        warnings.push(`${result.account.label}: ${result.error}`);
        continue;
      }
      coveredAccounts++;
      if (result.rows.length >= PAGE_LIMIT) {
        warnings.push(
          `${result.account.label}: activity history was truncated at ${PAGE_LIMIT} rows for this window.`,
        );
      }
      for (const row of result.rows) {
        activities.push({
          type: row.type || '',
          symbol: row.symbol ? normalizeTicker(row.symbol) : null,
          description: row.description ?? null,
          amount: row.amount,
          currency:
            normalizeTicker(row.currency || '') ||
            normalizeTicker(result.account.currency) ||
            'USD',
          date: row.tradeDate?.slice(0, 10) || row.settlementDate?.slice(0, 10) || null,
          fee: row.fee,
          accountId: result.account.id,
          institution: result.account.institution || 'Brokerage',
        });
      }
    }
  }

  if (uncoveredAccounts.length > 0) {
    warnings.push(
      `No transaction history available for ${uncoveredAccounts.length} non-brokerage account(s): ${uncoveredAccounts.join(', ')}.`,
    );
  }

  const data: ActivityLookup = {
    activities,
    coveredAccounts,
    uncoveredAccounts,
    warnings,
    retrievedAt: new Date().toISOString(),
  };
  cached = { key, data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

export function invalidateActivityCache(): void {
  cached = null;
}
