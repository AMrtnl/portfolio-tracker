import axios from 'axios';
import crypto from 'crypto';
import qs from 'querystring';
import { IAdapter } from './base.adapter.js';
import { Balance, Position, TxRecord } from '../types/common.js';

const BASE_URL = 'https://api.kraken.com';

export class KrakenAdapter implements IAdapter {
  platform = 'kraken';
  accountType = 'CRYPTO_EXCHANGE' as const;

  constructor(private apiKey: string, private privateKey: string) {}

  isConfigured(): boolean {
    return !!this.apiKey && !!this.privateKey;
  }

  private sign(path: string, nonce: string, postData: string): string {
    const message = path + crypto.createHash('sha256').update(nonce + postData).digest('binary');
    const secret = Buffer.from(this.privateKey, 'base64');
    return crypto.createHmac('sha512', secret).update(message, 'binary').digest('base64');
  }

  private async post(endpoint: string, params: Record<string, string> = {}) {
    const nonce = Date.now().toString();
    const postData = qs.stringify({ nonce, ...params });
    const path = `/0/private/${endpoint}`;
    const sig = this.sign(path, nonce, postData);
    const { data } = await axios.post(`${BASE_URL}${path}`, postData, {
      headers: {
        'API-Key': this.apiKey,
        'API-Sign': sig,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    if (data.error?.length) throw new Error(data.error.join(', '));
    return data.result;
  }

  async getBalances(): Promise<Balance[]> {
    if (!this.isConfigured()) return [];
    try {
      const [balanceData, tickerData] = await Promise.all([
        this.post('Balance'),
        axios.get(`${BASE_URL}/0/public/Ticker?pair=XBTUSD,ETHUSD`).then(r => r.data.result),
      ]);

      const prices: Record<string, number> = {
        XXBT: parseFloat(tickerData.XXBTZUSD?.c?.[0] ?? '0'),
        XETH: parseFloat(tickerData.XETHZUSD?.c?.[0] ?? '0'),
        ZUSD: 1,
        USDT: 1,
        USDC: 1,
      };

      return Object.entries(balanceData)
        .filter(([, amount]) => parseFloat(amount as string) > 0)
        .map(([asset, amount]) => {
          const clean = asset.replace(/^X|^Z/, '');
          const price = prices[asset] ?? prices[clean] ?? 0;
          const amt = parseFloat(amount as string);
          return {
            asset: clean === 'XBT' ? 'BTC' : clean,
            amount: amt.toString(),
            usdValue: (amt * price).toString(),
            chain: 'Kraken',
            platform: 'kraken',
          } as Balance;
        });
    } catch (err) {
      console.error('Kraken getBalances error:', err);
      return [];
    }
  }

  async getPositions(): Promise<Position[]> {
    if (!this.isConfigured()) return [];
    try {
      const data = await this.post('OpenPositions');
      return Object.values(data).map((p: any) => ({
        asset: p.pair.replace('ZUSD', '').replace('X', '').replace('XBT', 'BTC'),
        size: Math.abs(parseFloat(p.vol)).toString(),
        entryPrice: p.cost,
        markPrice: '0',
        pnl: p.net ?? '0',
        pnlPercent: '0',
        leverage: '1',
        side: p.type === 'buy' ? 'LONG' : 'SHORT',
        type: 'SPOT',
        protocol: 'KRAKEN',
        platform: 'kraken',
      })) as Position[];
    } catch {
      return [];
    }
  }

  async getTransactions(from?: Date): Promise<TxRecord[]> {
    if (!this.isConfigured()) return [];
    try {
      const start = from ? Math.floor(from.getTime() / 1000) : Math.floor((Date.now() - 30 * 24 * 3600 * 1000) / 1000);
      const data = await this.post('TradesHistory', { start: start.toString() });
      return Object.values(data.trades ?? {}).map((t: any) => ({
        asset: t.pair.replace('ZUSD', '').replace('X', '').replace('XBT', 'BTC'),
        type: t.type === 'buy' ? 'BUY' : 'SELL',
        amount: parseFloat(t.vol),
        price: parseFloat(t.price),
        fee: parseFloat(t.fee),
        currency: 'USD',
        timestamp: new Date(t.time * 1000),
        platform: 'kraken',
      })) as TxRecord[];
    } catch {
      return [];
    }
  }
}
