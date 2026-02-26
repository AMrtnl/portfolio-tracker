import axios from 'axios';
import crypto from 'crypto';
import { IAdapter } from './base.adapter.js';
import { Balance, Position, TxRecord } from '../types/common.js';

const BASE_URL = 'https://api.bybit.com';

export class BybitAdapter implements IAdapter {
  platform = 'bybit';
  accountType = 'CRYPTO_EXCHANGE' as const;

  constructor(private apiKey: string, private apiSecret: string) {}

  isConfigured(): boolean {
    return !!this.apiKey && !!this.apiSecret;
  }

  private sign(params: Record<string, string | number>): string {
    const ts = Date.now();
    const recv = 5000;
    const paramStr = Object.entries({ ...params, api_key: this.apiKey, timestamp: ts, recv_window: recv })
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const sig = crypto.createHmac('sha256', this.apiSecret).update(paramStr).digest('hex');
    return `${paramStr}&sign=${sig}`;
  }

  private headers(ts: number, sig: string) {
    return {
      'X-BAPI-API-KEY': this.apiKey,
      'X-BAPI-SIGN': sig,
      'X-BAPI-TIMESTAMP': ts.toString(),
      'X-BAPI-RECV-WINDOW': '5000',
    };
  }

  private buildHeaders(payload: string) {
    const ts = Date.now();
    const recv = '5000';
    const prehash = `${ts}${this.apiKey}${recv}${payload}`;
    const sig = crypto.createHmac('sha256', this.apiSecret).update(prehash).digest('hex');
    return {
      'X-BAPI-API-KEY': this.apiKey,
      'X-BAPI-SIGN': sig,
      'X-BAPI-TIMESTAMP': ts.toString(),
      'X-BAPI-RECV-WINDOW': recv,
    };
  }

  async getBalances(): Promise<Balance[]> {
    if (!this.isConfigured()) return [];
    try {
      const ts = Date.now();
      const qs = `accountType=UNIFIED&timestamp=${ts}&api_key=${this.apiKey}&recv_window=5000`;
      const sig = crypto.createHmac('sha256', this.apiSecret).update(qs).digest('hex');
      const { data } = await axios.get(
        `${BASE_URL}/v5/account/wallet-balance?accountType=UNIFIED`,
        { headers: this.buildHeaders('accountType=UNIFIED') }
      );

      const balances: Balance[] = [];
      for (const acc of data?.result?.list ?? []) {
        for (const coin of acc?.coin ?? []) {
          const total = parseFloat(coin.walletBalance ?? '0');
          if (total > 0) {
            balances.push({
              asset: coin.coin,
              amount: total.toString(),
              usdValue: coin.usdValue ?? '0',
              chain: 'Bybit',
              platform: 'bybit',
            });
          }
        }
      }
      return balances;
    } catch (err) {
      console.error('Bybit getBalances error:', err);
      return [];
    }
  }

  async getPositions(): Promise<Position[]> {
    if (!this.isConfigured()) return [];
    try {
      const { data } = await axios.get(
        `${BASE_URL}/v5/position/list?category=linear&settleCoin=USDT`,
        { headers: this.buildHeaders('category=linear&settleCoin=USDT') }
      );
      return (data?.result?.list ?? [])
        .filter((p: any) => parseFloat(p.size) > 0)
        .map((p: any) => ({
          asset: p.symbol.replace('USDT', ''),
          size: p.size,
          entryPrice: p.avgPrice,
          markPrice: p.markPrice,
          pnl: p.unrealisedPnl,
          pnlPercent: ((parseFloat(p.unrealisedPnl) / parseFloat(p.positionValue)) * 100).toFixed(2),
          leverage: p.leverage,
          side: p.side === 'Buy' ? 'LONG' : 'SHORT',
          type: 'PERPETUAL',
          protocol: 'BYBIT',
          platform: 'bybit',
        })) as Position[];
    } catch {
      return [];
    }
  }

  async getTransactions(from?: Date): Promise<TxRecord[]> {
    if (!this.isConfigured()) return [];
    try {
      const startTime = from ? from.getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000;
      const qs = `category=spot&startTime=${startTime}&limit=50`;
      const { data } = await axios.get(`${BASE_URL}/v5/execution/list?${qs}`, {
        headers: this.buildHeaders(qs),
      });
      return (data?.result?.list ?? []).map((t: any) => ({
        asset: t.symbol.replace('USDT', ''),
        type: t.side === 'Buy' ? 'BUY' : 'SELL',
        amount: parseFloat(t.execQty),
        price: parseFloat(t.execPrice),
        fee: parseFloat(t.execFee),
        currency: 'USDT',
        timestamp: new Date(parseInt(t.execTime)),
        platform: 'bybit',
      })) as TxRecord[];
    } catch {
      return [];
    }
  }
}
