import { ProviderInfo, PublicAccount } from '../types/accounts';
import { Balance, Position } from '../types/common';
import {
  fetchBalancesAndPositions,
  fetchSnapAccounts,
  isSnaptradeConfigured,
  startSnapConnectPortal,
} from '../snaptrade';
import { ConnectResult, FinanceProvider, SyncResult } from './types';

export class SnaptradeProvider implements FinanceProvider {
  id = 'snaptrade' as const;

  info(): ProviderInfo {
    const configured = this.isConfigured();
    return {
      id: 'snaptrade',
      name: 'SnapTrade',
      description:
        'Import brokerages already linked to your SnapTrade Personal account (read-only).',
      accountTypes: ['broker', 'bank'],
      configured,
      coverage:
        'US, Canada, UK, EU & more · Swiss banks often unsupported — use Manual',
      connectMode: 'import',
    };
  }

  isConfigured(): boolean {
    return isSnaptradeConfigured();
  }

  async startConnect(opts?: Record<string, unknown>): Promise<ConnectResult> {
    return startSnapConnectPortal({
      broker: typeof opts?.broker === 'string' ? opts.broker : undefined,
      customRedirect:
        typeof opts?.customRedirect === 'string' ? opts.customRedirect : undefined,
    });
  }

  /** List accounts already connected under the Personal API key. */
  async listRemoteAccounts(): Promise<
    Array<{
      externalId: string;
      label: string;
      institution?: string;
      maskedIdentifier?: string;
      currency?: string;
      type: 'broker' | 'bank';
    }>
  > {
    const accounts = await fetchSnapAccounts();
    return accounts.map((a) => {
      const category = (a.accountCategory || '').toUpperCase();
      const rawType = (a.accountType || '').toLowerCase();
      const type: 'broker' | 'bank' =
        category === 'DEPOSIT' ||
        rawType.includes('cash') ||
        rawType.includes('bank')
          ? 'bank'
          : 'broker';
      return {
        externalId: a.externalId,
        label: a.label,
        institution: a.institution,
        maskedIdentifier: a.numberSuffix,
        currency: a.currency,
        type,
      };
    });
  }

  async sync(account: PublicAccount): Promise<SyncResult> {
    if (!this.isConfigured()) {
      return {
        balances: [],
        positions: [],
        totalValueUsd: 0,
        error:
          'SnapTrade not configured. Set SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY.',
      };
    }
    if (!account.externalId) {
      return {
        balances: [],
        positions: [],
        totalValueUsd: 0,
        error: 'Missing SnapTrade account id.',
      };
    }

    try {
      const { balances, positions, error } = await fetchBalancesAndPositions(
        account.externalId,
      );

      const cashBalances: Balance[] = [];
      for (const b of balances) {
        if (b.cash != null && b.cash !== 0) {
          cashBalances.push({
            asset: b.currency,
            amount: String(b.cash),
            // Amount is in reported currency — not FX-converted.
            usdValue: String(b.cash),
            chain: account.institution || 'Brokerage',
            accountId: account.id,
            accountLabel: account.label,
            provider: 'snaptrade',
          });
        }
      }

      const equityPositions: Position[] = [];
      const positionBalances: Balance[] = [];
      for (const p of positions) {
        if (p.cashEquivalent) continue; // already in cash balances
        const avg = p.averageCost ?? p.price ?? 0;
        const mark = p.price ?? avg;
        const pnl =
          p.openPnl != null
            ? p.openPnl
            : mark && avg
              ? (mark - avg) * p.units
              : 0;
        const pnlPct = avg ? ((mark - avg) / avg) * 100 : 0;

        equityPositions.push({
          asset: p.symbol,
          size: String(Math.abs(p.units)),
          entryPrice: String(avg || 0),
          markPrice: String(mark || 0),
          pnl: pnl.toFixed(2),
          pnlPercent: pnlPct.toFixed(2),
          leverage: '1',
          side: p.units >= 0 ? 'LONG' : 'SHORT',
          type: 'EQUITY',
          protocol: account.institution || 'SNAPTRADE',
          accountId: account.id,
          accountLabel: account.label,
          provider: 'snaptrade',
        });

        const mv = p.marketValue ?? Math.abs(p.units) * (mark || 0);
        if (mv) {
          positionBalances.push({
            asset: p.symbol,
            amount: String(Math.abs(p.units)),
            usdValue: mv.toFixed(2),
            chain: `${account.institution || 'Brokerage'} · ${p.currency}`,
            accountId: account.id,
            accountLabel: account.label,
            provider: 'snaptrade',
          });
        }
      }

      const merged =
        positionBalances.length > 0
          ? [...cashBalances, ...positionBalances]
          : cashBalances.length > 0
            ? cashBalances
            : positionBalances;

      const totalValueUsd = merged.reduce(
        (s, b) => s + parseFloat(b.usdValue || '0'),
        0,
      );

      // If both sections failed, surface error; if partial, still return data + error note
      if (error && merged.length === 0) {
        return {
          balances: [],
          positions: [],
          totalValueUsd: 0,
          error,
        };
      }

      return {
        balances: merged,
        positions: equityPositions,
        totalValueUsd,
        error: error || undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SnapTrade sync failed';
      return {
        balances: [],
        positions: [],
        totalValueUsd: 0,
        error: msg,
      };
    }
  }
}
