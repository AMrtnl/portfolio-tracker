import axios from 'axios';
import crypto from 'crypto';
import { IAdapter } from './base.adapter.js';
import { Balance, Position, TxRecord } from '../types/common.js';

const BASE_URL = 'https://api.binance.com';

export class BinanceAdapter implements IAdapter {
  platform = 'binance';
  accountType = 'CRYPTO_EXCHANGE' as const;

  constructor(private apiKey: string, private apiSecret: string) {}

  isConfigured(): boolean {
    return !!this.apiKey && !!this.apiSecret;
  }

  private sign(queryString: string): string {
    return crypto.createHmac('sha256', this.apiSecret).update(queryString).digest('hex');
  }

  private headers() {
    return { 'X-MBX-APIKEY': this.apiKey };
  }

  async getBalances(): Promise<Balance[]> {
    if (!this.isConfigured()) return [];
    try {
      const ts = Date.now();
      const qs = `timestamp=${ts}&omitZeroBalances=true`;
      const sig = this.sign(qs);
      const { data } = await axios.get(`${BASE_URL}/api/v3/account?${qs}&signature=${sig}`, {
        headers: this.headers(),
      });

      const prices = await this.getPrices();

      return data.balances
        .filter((b: any) => parseFloat(b.free) + parseFloat(b.locked) > 0)
        .map((b: any) => {
          const total = parseFloat(b.free) + parseFloat(b.locked);
          const usdPrice = prices[b.asset + 'USDT'] ?? prices[b.asset + 'BUSD'] ?? (b.asset === 'USDT' ? 1 : 0);
          return {
            asset: b.asset,
            amount: total.toString(),
            usdValue: (total * usdPrice).toString(),
            chain: 'Binance',
            platform: 'binance',
          } as Balance;
        });
    } catch (err) {
      console.error('Binance getBalances error:', err);
      return [];
    }
  }

  private async getPrices(): Promise<Record<string, number>> {
    try {
      const { data } = await axios.get(`${BASE_URL}/api/v3/ticker/price`);
      const map: Record<string, number> = {};
      for (const t of data) map[t.symbol] = parseFloat(t.price);
      return map;
    } catch {
      return {};
    }
  }

  async getPositions(): Promise<Position[]> {
    // Futures positions
    if (!this.isConfigured()) return [];
    try {
      const ts = Date.now();
      const qs = `timestamp=${ts}`;
      const sig = this.sign(qs);
      const { data } = await axios.get(
        `https://fapi.binance.com/fapi/v2/positionRisk?${qs}&signature=${sig}`,
        { headers: this.headers() }
      );
      return data
        .filter((p: any) => parseFloat(p.positionAmt) !== 0)
        .map((p: any) => ({
          asset: p.symbol.replace('USDT', ''),
          size: Math.abs(parseFloat(p.positionAmt)).toString(),
          entryPrice: p.entryPrice,
          markPrice: p.markPrice,
          pnl: p.unRealizedProfit,
          pnlPercent: ((parseFloat(p.unRealizedProfit) / parseFloat(p.notional)) * 100).toFixed(2),
          leverage: p.leverage,
          side: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
          type: 'PERPETUAL',
          protocol: 'BINANCE',
          platform: 'binance',
        })) as Position[];
    } catch {
      return [];
    }
  }

  async getTransactions(from?: Date): Promise<TxRecord[]> {
    if (!this.isConfigured()) return [];
    try {
      const ts = Date.now();
      const startTime = from ? from.getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000;
      const qs = `timestamp=${ts}&startTime=${startTime}`;
      const sig = this.sign(qs);
      const { data } = await axios.get(
        `${BASE_URL}/api/v3/myTrades?${qs}&signature=${sig}&limit=100`,
        { headers: this.headers() }
      );
      return data.map((t: any) => ({
        asset: t.symbol.replace('USDT', '').replace('BUSD', ''),
        type: t.isBuyer ? 'BUY' : 'SELL',
        amount: parseFloat(t.qty),
        price: parseFloat(t.price),
        fee: parseFloat(t.commission),
        currency: t.commissionAsset,
        timestamp: new Date(t.time),
        platform: 'binance',
      })) as TxRecord[];
    } catch {
      return [];
    }
  }
}
