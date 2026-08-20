import { ProviderInfo, PublicAccount } from '../types/accounts';
import { Balance } from '../types/common';
import { FinanceProvider, SyncResult } from './types';

export class ManualProvider implements FinanceProvider {
  id = 'manual' as const;

  info(): ProviderInfo {
    return {
      id: 'manual',
      name: 'Manual',
      description:
        'Enter cash and holdings yourself — works for any broker, bank, or asset without an API.',
      accountTypes: ['manual', 'broker', 'bank', 'loan', 'pension', 'estate'],
      configured: true,
      coverage: 'Global · any institution',
      connectMode: 'manual',
    };
  }

  isConfigured(): boolean {
    return true;
  }

  async sync(account: PublicAccount): Promise<SyncResult> {
    const holdings = account.holdings || [];
    const balances: Balance[] = holdings
      .filter((h) => h.quantity !== 0)
      .map((h) => {
        const usd = h.quantity * h.priceUsd;
        const chain =
          account.institution && account.institution !== 'Manual'
            ? `${account.institution} (manual)`
            : 'Manual';
        return {
          asset: h.symbol,
          amount: String(h.quantity),
          usdValue: usd.toFixed(2),
          chain,
          accountId: account.id,
          accountLabel: account.label,
          provider: 'manual',
        };
      });

    const totalValueUsd = balances.reduce(
      (s, b) => s + parseFloat(b.usdValue || '0'),
      0,
    );

    return {
      balances,
      positions: [],
      totalValueUsd,
    };
  }
}
