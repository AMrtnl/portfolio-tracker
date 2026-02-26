import axios from 'axios';
import { IAdapter } from './base.adapter.js';
import { Balance, Position, TxRecord } from '../types/common.js';

/**
 * Charles Schwab — Developer API Adapter
 *
 * SETUP REQUIRED:
 * 1. Register at https://developer.schwab.com
 * 2. Create an app to get Client ID + Client Secret
 * 3. Perform OAuth2 flow to get a refresh token
 * 4. Set SCHWAB_CLIENT_ID, SCHWAB_CLIENT_SECRET, SCHWAB_REFRESH_TOKEN in .env
 *
 * OAuth2 endpoints:
 *   Auth: https://api.schwabapi.com/v1/oauth/authorize
 *   Token: https://api.schwabapi.com/v1/oauth/token
 */

const BASE_URL = 'https://api.schwabapi.com/trader/v1';
const TOKEN_URL = 'https://api.schwabapi.com/v1/oauth/token';

export class SchwabAdapter implements IAdapter {
  platform = 'schwab';
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
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  async getBalances(): Promise<Balance[]> {
    if (!this.isConfigured()) return [];
    try {
      await this.ensureToken();
      const { data } = await axios.get(`${BASE_URL}/accounts?fields=balances`, {
        headers: this.headers(),
      });
      const balances: Balance[] = [];
      for (const acc of data ?? []) {
        const cash = acc.securitiesAccount?.currentBalances?.cashBalance ?? 0;
        const liquidation = acc.securitiesAccount?.currentBalances?.liquidationValue ?? 0;
        if (cash > 0) {
          balances.push({
            asset: 'USD',
            amount: cash.toString(),
            usdValue: cash.toString(),
            chain: 'Schwab',
            platform: 'schwab',
          });
        }
        if (liquidation > 0 && liquidation !== cash) {
          balances.push({
            asset: 'PORTFOLIO',
            amount: liquidation.toString(),
            usdValue: liquidation.toString(),
            chain: 'Schwab',
            platform: 'schwab',
          });
        }
      }
      return balances;
    } catch (err) {
      console.error('Schwab getBalances error:', err);
      return [];
    }
  }

  async getPositions(): Promise<Position[]> {
    if (!this.isConfigured()) return [];
    try {
      await this.ensureToken();
      const { data } = await axios.get(`${BASE_URL}/accounts?fields=positions`, {
        headers: this.headers(),
      });
      const positions: Position[] = [];
      for (const acc of data ?? []) {
        for (const pos of acc.securitiesAccount?.positions ?? []) {
          positions.push({
            asset: pos.instrument?.symbol ?? '',
            size: Math.abs(pos.longQuantity - pos.shortQuantity).toString(),
            entryPrice: pos.averagePrice?.toString() ?? '0',
            markPrice: pos.marketValue
              ? (pos.marketValue / Math.abs(pos.longQuantity - pos.shortQuantity)).toFixed(2)
              : '0',
            pnl: (pos.currentDayProfitLoss ?? 0).toString(),
            pnlPercent: (pos.currentDayProfitLossPercentage ?? 0).toFixed(2),
            leverage: '1',
            side: pos.longQuantity > pos.shortQuantity ? 'LONG' : 'SHORT',
            type: pos.instrument?.assetType === 'OPTION' ? 'OPTION' : 'SPOT',
            protocol: 'SCHWAB',
            platform: 'schwab',
            metadata: {
              assetType: pos.instrument?.assetType,
              cusip: pos.instrument?.cusip,
              marketValue: pos.marketValue,
            },
          });
        }
      }
      return positions;
    } catch (err) {
      console.error('Schwab getPositions error:', err);
      return [];
    }
  }

  async getTransactions(from?: Date): Promise<TxRecord[]> {
    if (!this.isConfigured()) return [];
    try {
      await this.ensureToken();
      const { data: accounts } = await axios.get(`${BASE_URL}/accounts`, {
        headers: this.headers(),
      });
      const txs: TxRecord[] = [];
      const startDate = from
        ? from.toISOString().slice(0, 10)
        : new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

      for (const acc of accounts ?? []) {
        const accountNumber = acc.securitiesAccount?.accountNumber;
        if (!accountNumber) continue;
        const { data } = await axios.get(
          `${BASE_URL}/accounts/${accountNumber}/transactions?startDate=${startDate}&types=TRADE`,
          { headers: this.headers() }
        );
        for (const t of data ?? []) {
          txs.push({
            asset: t.transactionItem?.instrument?.symbol ?? '',
            type: t.type === 'TRADE' && (t.transactionItem?.instruction === 'BUY') ? 'BUY' : 'SELL',
            amount: Math.abs(t.transactionItem?.amount ?? 0),
            price: t.transactionItem?.price ?? 0,
            fee: Math.abs(t.fees?.commission ?? 0),
            currency: 'USD',
            timestamp: new Date(t.transactionDate ?? Date.now()),
            platform: 'schwab',
          });
        }
      }
      return txs;
    } catch {
      return [];
    }
  }
}
