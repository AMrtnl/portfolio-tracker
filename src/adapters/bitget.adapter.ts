import axios from 'axios';
import crypto from 'crypto';
import { IAdapter } from './base.adapter.js';
import { Balance, Position, TxRecord } from '../types/common.js';

const BASE_URL = 'https://api.bitget.com';

export class BitgetAdapter implements IAdapter {
  platform = 'bitget';
  accountType = 'CRYPTO_EXCHANGE' as const;

  constructor(
    private apiKey: string,
    private apiSecret: string,
    private passphrase: string
  ) {}

  isConfigured(): boolean {
    return !!this.apiKey && !!this.apiSecret && !!this.passphrase;
  }

  private sign(timestamp: string, method: string, path: string, body = ''): string {
    const msg = `${timestamp}${method}${path}${body}`;
    return crypto.createHmac('sha256', this.apiSecret).update(msg).digest('base64');
  }

  private headers(method: string, path: string, body = '') {
    const ts = Date.now().toString();
    return {
      'ACCESS-KEY': this.apiKey,
      'ACCESS-SIGN': this.sign(ts, method, path, body),
      'ACCESS-TIMESTAMP': ts,
      'ACCESS-PASSPHRASE': this.passphrase,
      'Content-Type': 'application/json',
    };
  }

  async getBalances(): Promise<Balance[]> {
    if (!this.isConfigured()) return [];
    try {
      const path = '/api/v2/spot/account/assets';
      const { data } = await axios.get(`${BASE_URL}${path}`, {
        headers: this.headers('GET', path),
      });
      return (data?.data ?? [])
        .filter((b: any) => parseFloat(b.available) + parseFloat(b.frozen) > 0)
        .map((b: any) => ({
          asset: b.coin,
          amount: (parseFloat(b.available) + parseFloat(b.frozen)).toString(),
          usdValue: b.usdtValue ?? '0',
          chain: 'Bitget',
          platform: 'bitget',
        })) as Balance[];
    } catch (err) {
      console.error('Bitget getBalances error:', err);
      return [];
    }
  }

  async getPositions(): Promise<Position[]> {
    if (!this.isConfigured()) return [];
    try {
      const path = '/api/v2/mix/position/all-position?productType=USDT-FUTURES';
      const { data } = await axios.get(`${BASE_URL}${path}`, {
        headers: this.headers('GET', path),
      });
      return (data?.data ?? [])
        .filter((p: any) => parseFloat(p.total) > 0)
        .map((p: any) => ({
          asset: p.symbol.replace('USDT', ''),
          size: p.total,
          entryPrice: p.openPriceAvg,
          markPrice: p.markPrice,
          pnl: p.unrealizedPL,
          pnlPercent: ((parseFloat(p.unrealizedPL) / parseFloat(p.marginSize)) * 100).toFixed(2),
          leverage: p.leverage,
          side: p.holdSide === 'long' ? 'LONG' : 'SHORT',
          type: 'PERPETUAL',
          protocol: 'BITGET',
          platform: 'bitget',
        })) as Position[];
    } catch {
      return [];
    }
  }

  async getTransactions(from?: Date): Promise<TxRecord[]> {
    if (!this.isConfigured()) return [];
    try {
      const startTime = from ? from.getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000;
      const path = `/api/v2/spot/trade/fills?startTime=${startTime}&limit=100`;
      const { data } = await axios.get(`${BASE_URL}${path}`, {
        headers: this.headers('GET', path),
      });
      return (data?.data ?? []).map((t: any) => ({
        asset: t.symbol.replace('USDT', ''),
        type: t.side === 'buy' ? 'BUY' : 'SELL',
        amount: parseFloat(t.size),
        price: parseFloat(t.price),
        fee: parseFloat(t.fee),
        currency: t.feeCcy,
        timestamp: new Date(parseInt(t.cTime)),
        platform: 'bitget',
      })) as TxRecord[];
    } catch {
      return [];
    }
  }
}
