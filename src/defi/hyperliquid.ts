import { Hyperliquid } from 'hyperliquid';
import { WalletCore } from '../wallet-core';
import { Position, Balance } from '../types/common';

export interface AccountPnl {
  /** Percent change for the period */
  pnl24h: number;
  pnl7d: number;
  pnl30d: number;
  /** Absolute USD PnL for the period */
  pnl24hUsd: number;
  pnl7dUsd: number;
  pnl30dUsd: number;
}

function lastValue(history: [number, string][] | undefined): number {
  if (!history || history.length === 0) return 0;
  return parseFloat(history[history.length - 1]?.[1] || '0') || 0;
}

function firstValue(history: [number, string][] | undefined): number {
  if (!history || history.length === 0) return 0;
  return parseFloat(history[0]?.[1] || '0') || 0;
}

/** Percent change from first → last account value in a period. */
function periodPct(
  periods: Array<[string, { accountValueHistory: [number, string][]; pnlHistory: [number, string][] }]>,
  key: string,
): { pct: number; usd: number } {
  const entry = periods.find(([name]) => name === key)?.[1];
  if (!entry) return { pct: 0, usd: 0 };
  const start = firstValue(entry.accountValueHistory);
  const end = lastValue(entry.accountValueHistory);
  const usd = lastValue(entry.pnlHistory);
  const pct = start > 0 ? ((end - start) / start) * 100 : 0;
  return { pct, usd };
}

export class HyperliquidAdapter {
  private sdk: Hyperliquid;
  private walletCore: WalletCore;
  private accountIndex: number;
  private walletAddress: string;
  private ready: Promise<void>;

  constructor(walletCore: WalletCore, accountIndex: number = 0) {
    this.walletCore = walletCore;
    this.accountIndex = accountIndex;
    this.walletAddress = walletCore.getAddress(accountIndex, 1337);

    const privateKey = walletCore.getPrivateKey(accountIndex, 1337);
    this.sdk = new Hyperliquid({
      privateKey,
      testnet: false,
      enableWs: false,
      walletAddress: this.walletAddress,
    });
    this.ready = this.sdk.connect();
  }

  public getAddress(): string {
    return this.walletAddress;
  }

  private async ensureReady(): Promise<void> {
    await this.ready;
  }

  /**
   * Get open perpetual positions from clearinghouse state.
   */
  public async getPositions(): Promise<Position[]> {
    try {
      await this.ensureReady();
      const state = await this.sdk.info.perpetuals.getClearinghouseState(this.walletAddress);
      const mids = await this.sdk.info.getAllMids().catch(() => ({} as Record<string, string>));

      const positions: Position[] = [];

      for (const item of state.assetPositions || []) {
        const p = item.position;
        const size = parseFloat(p.szi || '0');
        if (!size) continue;

        const entry = parseFloat(p.entryPx || '0');
        const pnl = parseFloat(p.unrealizedPnl || '0');
        const positionValue = parseFloat(p.positionValue || '0');
        const midKey = Object.keys(mids).find(
          (k) => k === p.coin || k.replace('-PERP', '') === p.coin || k.startsWith(p.coin),
        );
        const markFromMid = midKey ? parseFloat(mids[midKey]) : NaN;
        const mark =
          Number.isFinite(markFromMid) && markFromMid > 0
            ? markFromMid
            : Math.abs(size) > 0
              ? Math.abs(positionValue / size)
              : entry;

        const roe = parseFloat(p.returnOnEquity || '0');
        // SDK returns ROE as a decimal fraction (e.g. 0.12 = 12%)
        const pnlPercent = Math.abs(roe) <= 10 ? roe * 100 : roe;

        positions.push({
          asset: p.coin,
          size: Math.abs(size).toString(),
          entryPrice: entry.toString(),
          markPrice: mark.toString(),
          pnl: pnl.toString(),
          pnlPercent: pnlPercent.toString(),
          leverage: String(p.leverage?.value ?? 1),
          side: size >= 0 ? 'LONG' : 'SHORT',
          type: 'PERPETUAL',
          protocol: 'HYPERLIQUID',
        });
      }

      return positions;
    } catch (error) {
      console.error('Error fetching Hyperliquid positions:', error);
      return [];
    }
  }

  /**
   * Get account balances: perps equity + spot balances.
   */
  public async getBalances(): Promise<Balance[]> {
    try {
      await this.ensureReady();
      const [perpState, spotState, mids] = await Promise.all([
        this.sdk.info.perpetuals.getClearinghouseState(this.walletAddress),
        this.sdk.info.spot.getSpotClearinghouseState(this.walletAddress),
        this.sdk.info.getAllMids().catch(() => ({} as Record<string, string>)),
      ]);

      const balances: Balance[] = [];

      const accountValue = parseFloat(perpState.marginSummary?.accountValue || '0');
      const withdrawable = parseFloat(perpState.withdrawable || '0');
      if (accountValue > 0 || withdrawable > 0) {
        balances.push({
          asset: 'USDC',
          amount: (withdrawable || accountValue).toString(),
          usdValue: accountValue.toString(),
          chain: 'Hyperliquid Perps',
        });
      }

      for (const bal of spotState.balances || []) {
        const amount = parseFloat(bal.total || '0');
        if (!amount) continue;

        const coin = bal.coin;
        let usdValue = 0;
        if (coin === 'USDC' || coin === 'USDT') {
          usdValue = amount;
        } else {
          const midKey = Object.keys(mids).find(
            (k) => k === coin || k.startsWith(`${coin}/`) || k.startsWith(`${coin}-`),
          );
          const px = midKey ? parseFloat(mids[midKey]) : NaN;
          usdValue = Number.isFinite(px) ? amount * px : 0;
        }

        balances.push({
          asset: coin,
          amount: amount.toString(),
          usdValue: usdValue.toString(),
          chain: 'Hyperliquid Spot',
        });
      }

      return balances;
    } catch (error) {
      console.error('Error fetching Hyperliquid balances:', error);
      return [];
    }
  }

  /**
   * Period PnL from Hyperliquid portfolio history (USD).
   */
  public async getPnl(): Promise<AccountPnl> {
    try {
      await this.ensureReady();
      const periods = (await this.sdk.info.portfolio(this.walletAddress)) as any;
      const day = periodPct(periods, 'day');
      const week = periodPct(periods, 'week');
      const month = periodPct(periods, 'month');
      return {
        pnl24h: day.pct,
        pnl7d: week.pct,
        pnl30d: month.pct,
        pnl24hUsd: day.usd,
        pnl7dUsd: week.usd,
        pnl30dUsd: month.usd,
      };
    } catch (error) {
      console.error('Error fetching Hyperliquid portfolio PnL:', error);
      return {
        pnl24h: 0,
        pnl7d: 0,
        pnl30d: 0,
        pnl24hUsd: 0,
        pnl7dUsd: 0,
        pnl30dUsd: 0,
      };
    }
  }

  /**
   * Place a new order
   */
  public async placeOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    size: number,
    price: number,
    orderType: 'LIMIT' | 'MARKET' = 'LIMIT'
  ): Promise<any> {
    await this.ensureReady();
    const order = {
      coin: symbol,
      is_buy: side === 'BUY',
      sz: size,
      limit_px: price,
      order_type: orderType === 'MARKET'
        ? { limit: { tif: 'Ioc' as const } }
        : { limit: { tif: 'Gtc' as const } },
      reduce_only: false,
    };

    try {
      return await this.sdk.exchange.placeOrder(order);
    } catch (error) {
      console.error('Error placing order on Hyperliquid:', error);
      throw error;
    }
  }

  /**
   * Cancel an existing order
   */
  public async cancelOrder(coin: string, orderId: number): Promise<boolean> {
    try {
      await this.ensureReady();
      await this.sdk.exchange.cancelOrder({ coin, o: orderId });
      return true;
    } catch (error) {
      console.error('Error canceling order on Hyperliquid:', error);
      return false;
    }
  }
}
