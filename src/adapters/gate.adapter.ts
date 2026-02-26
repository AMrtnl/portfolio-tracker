import axios from 'axios';
import crypto from 'crypto';
import { IAdapter } from './base.adapter.js';
import { Balance, Position, TxRecord } from '../types/common.js';

const BASE_URL = 'https://api.gateio.ws/api/v4';

export class GateAdapter implements IAdapter {
  platform = 'gate';
  accountType = 'CRYPTO_EXCHANGE' as const;

  constructor(private apiKey: string, private apiSecret: string) {}

  isConfigured(): boolean {
    return !!this.apiKey && !!this.apiSecret;
  }

  private sign(method: string, url: string, queryString: string, body: string): Record<string, string> {
    const ts = Math.floor(Date.now() / 1000).toString();
    const bodyHash = crypto.createHash('sha512').update(body || '').digest('hex');
    const signString = `${method}\n${url}\n${queryString}\n${bodyHash}\n${ts}`;
    const sig = crypto.createHmac('sha512', this.apiSecret).update(signString).digest('hex');
    return {
      KEY: this.apiKey,
      Timestamp: ts,
      SIGN: sig,
    };
  }

  async getBalances(): Promise<Balance[]> {
    if (!this.isConfigured()) return [];
    try {
      const path = '/spot/accounts';
      const { data } = await axios.get(`${BASE_URL}${path}`, {
        headers: this.sign('GET', path, '', ''),
      });
      const prices = await this.getPrices();
      return (data ?? [])
        .filter((b: any) => parseFloat(b.available) + parseFloat(b.locked) > 0)
        .map((b: any) => {
          const total = parseFloat(b.available) + parseFloat(b.locked);
          const sym = b.currency === 'USDT' ? 1 : (prices[`${b.currency}_USDT`] ?? 0);
          return {
            asset: b.currency,
            amount: total.toString(),
            usdValue: (total * sym).toString(),
            chain: 'Gate.io',
            platform: 'gate',
          } as Balance;
        });
    } catch (err) {
      console.error('Gate getBalances error:', err);
      return [];
    }
  }

  private async getPrices(): Promise<Record<string, number>> {
    try {
      const { data } = await axios.get(`${BASE_URL}/spot/tickers`);
      const map: Record<string, number> = {};
      for (const t of data) map[t.currency_pair] = parseFloat(t.last);
      return map;
    } catch {
      return {};
    }
  }

  async getPositions(): Promise<Position[]> {
    if (!this.isConfigured()) return [];
    try {
      const path = '/futures/usdt/positions';
      const { data } = await axios.get(`${BASE_URL}${path}`, {
        headers: this.sign('GET', path, '', ''),
      });
      return (data ?? [])
        .filter((p: any) => parseFloat(p.size) !== 0)
        .map((p: any) => ({
          asset: p.contract.replace('_USDT', ''),
          size: Math.abs(parseFloat(p.size)).toString(),
          entryPrice: p.entry_price,
          markPrice: p.mark_price,
          pnl: p.unrealised_pnl,
          pnlPercent: '0',
          leverage: p.leverage,
          side: parseFloat(p.size) > 0 ? 'LONG' : 'SHORT',
          type: 'PERPETUAL',
          protocol: 'GATE',
          platform: 'gate',
        })) as Position[];
    } catch {
      return [];
    }
  }

  async getTransactions(from?: Date): Promise<TxRecord[]> {
    if (!this.isConfigured()) return [];
    try {
      const start = from ? Math.floor(from.getTime() / 1000) : Math.floor((Date.now() - 30 * 24 * 3600 * 1000) / 1000);
      const qs = `from=${start}&limit=100`;
      const path = '/spot/my_trades';
      const { data } = await axios.get(`${BASE_URL}${path}?${qs}`, {
        headers: this.sign('GET', path, qs, ''),
      });
      return (data ?? []).map((t: any) => ({
        asset: t.currency_pair.replace('_USDT', ''),
        type: t.side === 'buy' ? 'BUY' : 'SELL',
        amount: parseFloat(t.amount),
        price: parseFloat(t.price),
        fee: parseFloat(t.fee),
        currency: t.fee_currency,
        timestamp: new Date(parseInt(t.create_time) * 1000),
        platform: 'gate',
      })) as TxRecord[];
    } catch {
      return [];
    }
  }
}
