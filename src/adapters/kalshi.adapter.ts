import axios from 'axios';
import { IAdapter } from './base.adapter.js';
import { Balance, Position, TxRecord } from '../types/common.js';

const BASE_URL = 'https://trading-api.kalshi.com/v2';

export class KalshiAdapter implements IAdapter {
  platform = 'kalshi';
  accountType = 'PREDICTION' as const;

  private token: string = '';

  constructor(private apiKey?: string, private email?: string, private password?: string) {}

  isConfigured(): boolean {
    return !!(this.apiKey || (this.email && this.password));
  }

  private async ensureAuth(): Promise<void> {
    if (this.token) return;
    if (this.apiKey) {
      this.token = this.apiKey;
      return;
    }
    if (this.email && this.password) {
      const { data } = await axios.post(`${BASE_URL}/log_in`, {
        email: this.email,
        password: this.password,
      });
      this.token = data.token;
    }
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  async getBalances(): Promise<Balance[]> {
    if (!this.isConfigured()) return [];
    try {
      await this.ensureAuth();
      const { data } = await axios.get(`${BASE_URL}/portfolio/balance`, {
        headers: this.headers(),
      });
      const balance = parseFloat(data?.balance ?? '0') / 100; // Kalshi uses cents
      if (balance === 0) return [];
      return [{
        asset: 'USD',
        amount: balance.toString(),
        usdValue: balance.toString(),
        chain: 'Kalshi',
        platform: 'kalshi',
      }];
    } catch (err) {
      console.error('Kalshi getBalances error:', err);
      return [];
    }
  }

  async getPositions(): Promise<Position[]> {
    if (!this.isConfigured()) return [];
    try {
      await this.ensureAuth();
      const { data } = await axios.get(`${BASE_URL}/portfolio/positions?count=100`, {
        headers: this.headers(),
      });
      const positions: Position[] = [];
      for (const pos of data?.market_positions ?? []) {
        const yesContracts = parseInt(pos.position ?? '0');
        if (yesContracts === 0) continue;
        const currentYesPrice = parseFloat(pos.market_exposure ?? '0') / Math.abs(yesContracts) / 100;
        positions.push({
          asset: pos.market_title ?? pos.ticker ?? 'Unknown Market',
          size: Math.abs(yesContracts).toString(),
          entryPrice: (parseFloat(pos.total_traded ?? '0') / Math.abs(yesContracts) / 100).toFixed(4),
          markPrice: currentYesPrice.toFixed(4),
          pnl: (parseFloat(pos.realized_pnl ?? '0') / 100).toFixed(2),
          pnlPercent: '0',
          side: yesContracts > 0 ? 'LONG' : 'SHORT',
          type: 'PREDICTION',
          protocol: 'KALSHI',
          platform: 'kalshi',
          metadata: { ticker: pos.ticker, marketId: pos.market_id },
        });
      }
      return positions;
    } catch (err) {
      console.error('Kalshi getPositions error:', err);
      return [];
    }
  }

  async getTransactions(from?: Date): Promise<TxRecord[]> {
    if (!this.isConfigured()) return [];
    try {
      await this.ensureAuth();
      const { data } = await axios.get(`${BASE_URL}/portfolio/fills?count=100`, {
        headers: this.headers(),
      });
      const cutoff = from ? from.toISOString() : new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      return (data?.fills ?? [])
        .filter((f: any) => f.created_time > cutoff)
        .map((f: any) => ({
          asset: f.market_ticker ?? 'Prediction',
          type: f.side === 'yes' ? 'BUY' : 'SELL',
          amount: parseInt(f.count),
          price: parseInt(f.yes_price) / 100,
          fee: parseFloat(f.action === 'fill' ? '0' : '0'),
          currency: 'USD',
          timestamp: new Date(f.created_time),
          platform: 'kalshi',
        })) as TxRecord[];
    } catch {
      return [];
    }
  }
}
