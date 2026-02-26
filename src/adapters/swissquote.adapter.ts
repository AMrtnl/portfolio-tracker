import axios from 'axios';
import { IAdapter } from './base.adapter.js';
import { Balance, Position, TxRecord } from '../types/common.js';

/**
 * Swissquote Bank — REST API Adapter
 *
 * SETUP REQUIRED:
 * 1. Log in to your Swissquote account
 * 2. Navigate to Settings → API → Create API credentials
 * 3. Perform OAuth2 flow:
 *    Auth: https://account.swissquote.ch/oauth2/authorize
 *    Token: https://account.swissquote.ch/oauth2/token
 * 4. Set SWISSQUOTE_CLIENT_ID, SWISSQUOTE_CLIENT_SECRET, SWISSQUOTE_REFRESH_TOKEN in .env
 */

const BASE_URL = 'https://api.swissquote.ch';
const TOKEN_URL = 'https://account.swissquote.ch/oauth2/token';

export class SwissquoteAdapter implements IAdapter {
  platform = 'swissquote';
  accountType = 'BROKER' as const;

  private accessToken: string = '';
  private tokenExpiry: number = 0;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private refreshToken: string
  ) {}

  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret && !!this.refreshToken;
  }

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) return;
    const creds = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const { data } = await axios.post(
      TOKEN_URL,
      `grant_type=refresh_token&refresh_token=${this.refreshToken}`,
      {
        headers: {
          Authorization: `Basic ${creds}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
  }

  private headers() {
    return { Authorization: `Bearer ${this.accessToken}`, Accept: 'application/json' };
  }

  async getBalances(): Promise<Balance[]> {
    if (!this.isConfigured()) return [];
    try {
      await this.ensureToken();
      const { data } = await axios.get(`${BASE_URL}/rest/2.0/accounts`, {
        headers: this.headers(),
      });
      const balances: Balance[] = [];
      for (const acc of data?.accounts ?? []) {
        balances.push({
          asset: acc.currency ?? 'CHF',
          amount: acc.cash?.toString() ?? '0',
          usdValue: acc.cashInPf?.toString() ?? '0', // portfolio currency value
          chain: 'Swissquote',
          platform: 'swissquote',
        });
      }
      return balances;
    } catch (err) {
      console.error('Swissquote getBalances error:', err);
      return [];
    }
  }

  async getPositions(): Promise<Position[]> {
    if (!this.isConfigured()) return [];
    try {
      await this.ensureToken();
      const { data } = await axios.get(`${BASE_URL}/rest/2.0/positions`, {
        headers: this.headers(),
      });
      return (data?.positions ?? []).map((p: any) => ({
        asset: p.symbol ?? p.isin ?? '',
        size: Math.abs(p.quantity ?? 0).toString(),
        entryPrice: (p.averageBuyPrice ?? 0).toString(),
        markPrice: (p.currentPrice ?? 0).toString(),
        pnl: (p.unrealizedGainLoss ?? 0).toString(),
        pnlPercent: (p.unrealizedGainLossPercent ?? 0).toFixed(2),
        leverage: '1',
        side: (p.quantity ?? 0) >= 0 ? 'LONG' : 'SHORT',
        type: 'SPOT',
        protocol: 'SWISSQUOTE',
        platform: 'swissquote',
        metadata: {
          isin: p.isin,
          currency: p.currency,
          exchange: p.exchange,
          name: p.name,
        },
      })) as Position[];
    } catch (err) {
      console.error('Swissquote getPositions error:', err);
      return [];
    }
  }

  async getTransactions(from?: Date): Promise<TxRecord[]> {
    if (!this.isConfigured()) return [];
    try {
      await this.ensureToken();
      const start = from
        ? from.toISOString().slice(0, 10)
        : new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

      const { data } = await axios.get(
        `${BASE_URL}/rest/2.0/transactions?from=${start}&limit=100`,
        { headers: this.headers() }
      );

      return (data?.transactions ?? []).map((t: any) => ({
        asset: t.symbol ?? t.isin ?? '',
        type: t.side === 'BUY' ? 'BUY' : 'SELL',
        amount: Math.abs(t.quantity ?? 0),
        price: t.price ?? 0,
        fee: t.fees ?? 0,
        currency: t.currency ?? 'CHF',
        timestamp: new Date(t.date ?? Date.now()),
        platform: 'swissquote',
      })) as TxRecord[];
    } catch {
      return [];
    }
  }
}
