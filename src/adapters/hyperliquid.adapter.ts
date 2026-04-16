import * as hl from '@nktkas/hyperliquid';
import { IAdapter } from './base.adapter.js';
import { Balance, Position, TxRecord } from '../types/common.js';

export class HyperliquidAdapter implements IAdapter {
  private client: hl.InfoClient;
  private address: string;

  constructor(credentials: { address: string }) {
    const transport = new hl.HttpTransport();
    this.client = new hl.InfoClient({ transport });
    this.address = credentials.address;
  }

  isConfigured(): boolean {
    return !!this.address;
  }

  async getBalances(): Promise<Balance[]> {
    const balances: Balance[] = [];

    try {
      const state = await this.client.clearinghouseState({ user: this.address as `0x${string}` });
      const accountValue = parseFloat(state.marginSummary.accountValue ?? '0');
      if (accountValue > 0) {
        balances.push({
          asset: 'USDC',
          free: String(accountValue),
          locked: state.marginSummary.totalMarginUsed ?? '0',
          usdValue: String(accountValue),
          platform: 'hyperliquid',
        });
      }
    } catch {}

    try {
      const spot = await this.client.spotClearinghouseState({ user: this.address as `0x${string}` });
      for (const b of (spot as any).balances ?? []) {
        const total = parseFloat(b.total ?? '0');
        if (total > 0) {
          balances.push({
            asset: b.coin,
            free: b.total,
            locked: '0',
            usdValue: String(total),
            platform: 'hyperliquid',
          });
        }
      }
    } catch {}

    return balances;
  }

  async getPositions(): Promise<Position[]> {
    const state = await this.client.clearinghouseState({ user: this.address as `0x${string}` });

    return (state.assetPositions ?? [])
      .filter(({ position }) => parseFloat(position.szi) !== 0)
      .map(({ position }) => {
        const size = parseFloat(position.szi);
        const entryPrice = parseFloat(position.entryPx ?? '0');
        const notional = Math.abs(size) * entryPrice;
        const pnl = parseFloat(position.unrealizedPnl ?? '0');
        return {
          asset: position.coin,
          side: size > 0 ? 'LONG' : 'SHORT',
          size: String(Math.abs(size)),
          entryPrice: position.entryPx ?? '0',
          markPrice: position.entryPx ?? '0',
          pnl: position.unrealizedPnl ?? '0',
          pnlPercent: String(notional > 0 ? (pnl / notional) * 100 : 0),
          leverage: (position.leverage as any)?.value ?? 1,
          liquidationPrice: (position.liquidationPx as any) ?? null,
          margin: position.marginUsed ?? '0',
          platform: 'hyperliquid',
          type: (position.leverage as any)?.type === 'cross' ? 'cross' : 'isolated',
        } as Position;
      });
  }

  async getTransactions(): Promise<TxRecord[]> {
    const fills = await this.client.userFills({ user: this.address as `0x${string}` });
    return (fills ?? []).slice(0, 100).map(fill => ({
      asset: fill.coin,
      type: (fill.side as string) === 'B' ? 'buy' : 'sell',
      amount: String(fill.sz),
      price: String(fill.px),
      fee: String((fill as any).fee ?? 0),
      currency: (fill as any).feeToken ?? 'USDC',
      timestamp: new Date(fill.time),
      platform: 'hyperliquid',
      txHash: (fill as any).hash,
    } as TxRecord));
  }
}
