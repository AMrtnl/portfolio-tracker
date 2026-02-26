import axios from 'axios';
import crypto from 'crypto';
import { IAdapter } from './base.adapter.js';
import { Balance, Position, TxRecord } from '../types/common.js';

const BASE_URL = 'https://api.coinbase.com';

export class CoinbaseAdapter implements IAdapter {
  platform = 'coinbase';
  accountType = 'CRYPTO_EXCHANGE' as const;

  constructor(private apiKey: string, private apiSecret: string) {}

  isConfigured(): boolean {
    return !!this.apiKey && !!this.apiSecret;
  }

  private sign(timestamp: string, method: string, path: string, body = ''): string {
    const msg = `${timestamp}${method}${path}${body}`;
    return crypto.createHmac('sha256', this.apiSecret).update(msg).digest('hex');
  }

  private headers(method: string, path: string, body = '') {
    const ts = Math.floor(Date.now() / 1000).toString();
    return {
      'CB-ACCESS-KEY': this.apiKey,
      'CB-ACCESS-SIGN': this.sign(ts, method, path, body),
      'CB-ACCESS-TIMESTAMP': ts,
      'CB-VERSION': '2016-02-18',
      'Content-Type': 'application/json',
    };
  }

  async getBalances(): Promise<Balance[]> {
    if (!this.isConfigured()) return [];
    try {
      const path = '/v2/accounts';
      const { data } = await axios.get(`${BASE_URL}${path}?limit=100`, {
        headers: this.headers('GET', `${path}?limit=100`),
      });

      const accounts = data?.data ?? [];
      const balances: Balance[] = [];

      for (const acc of accounts) {
        const amount = parseFloat(acc.balance?.amount ?? '0');
        if (amount > 0) {
          const usdVal = parseFloat(acc.native_balance?.amount ?? '0');
          balances.push({
            asset: acc.balance.currency,
            amount: acc.balance.amount,
            usdValue: usdVal.toString(),
            chain: 'Coinbase',
            platform: 'coinbase',
          });
        }
      }
      return balances;
    } catch (err) {
      console.error('Coinbase getBalances error:', err);
      return [];
    }
  }

  async getPositions(): Promise<Position[]> {
    // Coinbase does not offer perps via this API
    return [];
  }

  async getTransactions(from?: Date): Promise<TxRecord[]> {
    if (!this.isConfigured()) return [];
    try {
      const path = '/v2/accounts';
      const { data: accsData } = await axios.get(`${BASE_URL}${path}?limit=100`, {
        headers: this.headers('GET', `${path}?limit=100`),
      });

      const txs: TxRecord[] = [];
      const cutoff = from ? from.getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000;

      for (const acc of (accsData?.data ?? []).slice(0, 5)) {
        const txPath = `/v2/accounts/${acc.id}/transactions`;
        try {
          const { data } = await axios.get(`${BASE_URL}${txPath}?limit=25`, {
            headers: this.headers('GET', `${txPath}?limit=25`),
          });
          for (const tx of data?.data ?? []) {
            const ts = new Date(tx.created_at).getTime();
            if (ts < cutoff) continue;
            const typeMap: Record<string, TxRecord['type']> = {
              buy: 'BUY', sell: 'SELL', send: 'WITHDRAWAL', receive: 'DEPOSIT',
            };
            txs.push({
              asset: tx.amount?.currency ?? '',
              type: typeMap[tx.type] ?? 'BUY',
              amount: Math.abs(parseFloat(tx.amount?.amount ?? '0')),
              price: parseFloat(tx.native_amount?.amount ?? '0') / Math.abs(parseFloat(tx.amount?.amount ?? '1')),
              fee: 0,
              currency: 'USD',
              timestamp: new Date(tx.created_at),
              platform: 'coinbase',
            });
          }
        } catch { /* skip individual account errors */ }
      }
      return txs;
    } catch {
      return [];
    }
  }
}
