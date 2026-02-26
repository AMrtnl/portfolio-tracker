import axios from 'axios';
import crypto from 'crypto';
import { IAdapter } from './base.adapter.js';
import { Balance, Position, TxRecord } from '../types/common.js';

const BASE_URL = 'https://www.okx.com';

export class OKXAdapter implements IAdapter {
  platform = 'okx';
  accountType = 'CRYPTO_EXCHANGE' as const;

  constructor(
    private apiKey: string,
    private apiSecret: string,
    private passphrase: string
  ) {}

  isConfigured(): boolean {
    return !!this.apiKey && !!this.apiSecret && !!this.passphrase;
  }

  private sign(ts: string, method: string, path: string, body = ''): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(`${ts}${method}${path}${body}`)
      .digest('base64');
  }

  private headers(method: string, path: string, body = '') {
    const ts = new Date().toISOString();
    return {
      'OK-ACCESS-KEY': this.apiKey,
      'OK-ACCESS-SIGN': this.sign(ts, method, path, body),
      'OK-ACCESS-TIMESTAMP': ts,
      'OK-ACCESS-PASSPHRASE': this.passphrase,
      'Content-Type': 'application/json',
    };
  }

  async getBalances(): Promise<Balance[]> {
    if (!this.isConfigured()) return [];
    try {
      const path = '/api/v5/account/balance';
      const { data } = await axios.get(`${BASE_URL}${path}`, {
        headers: this.headers('GET', path),
      });
      const balances: Balance[] = [];
      for (const acc of data?.data ?? []) {
        for (const detail of acc?.details ?? []) {
          const eq = parseFloat(detail.eq ?? '0');
          if (eq > 0) {
            balances.push({
              asset: detail.ccy,
              amount: detail.cashBal,
              usdValue: detail.eqUsd,
              chain: 'OKX',
              platform: 'okx',
            });
          }
        }
      }
      return balances;
    } catch (err) {
      console.error('OKX getBalances error:', err);
      return [];
    }
  }

  async getPositions(): Promise<Position[]> {
    if (!this.isConfigured()) return [];
    try {
      const path = '/api/v5/account/positions?instType=SWAP';
      const { data } = await axios.get(`${BASE_URL}${path}`, {
        headers: this.headers('GET', path),
      });
      return (data?.data ?? [])
        .filter((p: any) => parseFloat(p.pos) !== 0)
        .map((p: any) => ({
          asset: p.instId.replace('-USDT-SWAP', '').replace('-USD-SWAP', ''),
          size: Math.abs(parseFloat(p.pos)).toString(),
          entryPrice: p.avgPx,
          markPrice: p.markPx,
          pnl: p.upl,
          pnlPercent: (parseFloat(p.uplRatio) * 100).toFixed(2),
          leverage: p.lever,
          side: parseFloat(p.pos) > 0 ? 'LONG' : 'SHORT',
          type: 'PERPETUAL',
          protocol: 'OKX',
          platform: 'okx',
        })) as Position[];
    } catch {
      return [];
    }
  }

  async getTransactions(from?: Date): Promise<TxRecord[]> {
    if (!this.isConfigured()) return [];
    try {
      const after = from ? from.getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000;
      const path = `/api/v5/trade/fills?instType=SPOT&after=${after}&limit=100`;
      const { data } = await axios.get(`${BASE_URL}${path}`, {
        headers: this.headers('GET', path),
      });
      return (data?.data ?? []).map((t: any) => ({
        asset: t.instId.replace('-USDT', '').replace('-USDC', ''),
        type: t.side === 'buy' ? 'BUY' : 'SELL',
        amount: parseFloat(t.fillSz),
        price: parseFloat(t.fillPx),
        fee: parseFloat(t.fee),
        currency: t.feeCcy,
        timestamp: new Date(parseInt(t.ts)),
        platform: 'okx',
      })) as TxRecord[];
    } catch {
      return [];
    }
  }
}
