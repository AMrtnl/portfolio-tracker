import axios from 'axios';
import https from 'https';
import { IAdapter } from './base.adapter.js';
import { Balance, Position, TxRecord } from '../types/common.js';

/**
 * Interactive Brokers — Client Portal API Adapter
 *
 * SETUP REQUIRED:
 * 1. Download the IBKR Client Portal Gateway from:
 *    https://www.interactivebrokers.com/en/trading/ib-api.php
 * 2. Run the gateway: `./bin/run.sh root/conf.yaml`
 * 3. Open https://localhost:5000 and authenticate with your IBKR credentials
 * 4. The gateway maintains the session — keep it running
 */

export class IBKRAdapter implements IAdapter {
  platform = 'ibkr';
  accountType = 'BROKER' as const;

  private baseUrl: string;
  private agent: https.Agent;

  constructor(gatewayUrl = 'https://localhost:5000') {
    this.baseUrl = gatewayUrl;
    // Accept self-signed cert from local gateway
    this.agent = new https.Agent({ rejectUnauthorized: false });
  }

  isConfigured(): boolean {
    return !!this.baseUrl;
  }

  private async get<T>(path: string): Promise<T> {
    const { data } = await axios.get<T>(`${this.baseUrl}/v1/api${path}`, {
      httpsAgent: this.agent,
      timeout: 10000,
    });
    return data;
  }

  private async getAccountId(): Promise<string> {
    const accounts = await this.get<any[]>('/portfolio/accounts');
    return accounts?.[0]?.id ?? '';
  }

  async getBalances(): Promise<Balance[]> {
    if (!this.isConfigured()) return [];
    try {
      const accountId = await this.getAccountId();
      if (!accountId) return [];

      const data = await this.get<any>(`/portfolio/${accountId}/ledger`);
      const balances: Balance[] = [];

      for (const [currency, info] of Object.entries(data ?? {})) {
        const cashBalance = (info as any).cashbalance;
        if (cashBalance && parseFloat(cashBalance) !== 0) {
          balances.push({
            asset: currency,
            amount: cashBalance.toString(),
            usdValue: currency === 'USD'
              ? cashBalance.toString()
              : ((info as any).cashbalancefxbase ?? cashBalance).toString(),
            chain: 'IBKR',
            platform: 'ibkr',
          });
        }
      }
      return balances;
    } catch (err) {
      console.error('IBKR getBalances error — is the Client Portal Gateway running?', err);
      return [];
    }
  }

  async getPositions(): Promise<Position[]> {
    if (!this.isConfigured()) return [];
    try {
      const accountId = await this.getAccountId();
      if (!accountId) return [];

      const data = await this.get<any[]>(`/portfolio/${accountId}/positions/0`);
      return (data ?? [])
        .filter((p: any) => p.position !== 0)
        .map((p: any) => ({
          asset: p.ticker ?? p.contractDesc ?? p.conid?.toString(),
          size: Math.abs(p.position).toString(),
          entryPrice: (p.avgCost ?? 0).toString(),
          markPrice: (p.mktPrice ?? 0).toString(),
          pnl: (p.unrealizedPnl ?? 0).toString(),
          pnlPercent: (((p.unrealizedPnl ?? 0) / ((p.avgCost ?? 1) * Math.abs(p.position))) * 100).toFixed(2),
          leverage: '1',
          side: p.position > 0 ? 'LONG' : 'SHORT',
          type: p.assetClass === 'OPT' ? 'OPTION' : 'SPOT',
          protocol: 'IBKR',
          platform: 'ibkr',
          metadata: {
            conid: p.conid,
            assetClass: p.assetClass,
            exchange: p.listingExchange,
            currency: p.currency,
          },
        })) as Position[];
    } catch (err) {
      console.error('IBKR getPositions error:', err);
      return [];
    }
  }

  async getTransactions(from?: Date): Promise<TxRecord[]> {
    if (!this.isConfigured()) return [];
    try {
      const accountId = await this.getAccountId();
      if (!accountId) return [];

      const start = from
        ? from.toISOString().slice(0, 10).replace(/-/g, '')
        : new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');

      const data = await this.get<any>(`/portfolio/${accountId}/trades?startDate=${start}`);
      return (data?.trades ?? []).map((t: any) => ({
        asset: t.symbol ?? '',
        type: t.side === 'B' ? 'BUY' : 'SELL',
        amount: Math.abs(parseFloat(t.size)),
        price: parseFloat(t.price),
        fee: parseFloat(t.commission ?? '0'),
        currency: t.currency ?? 'USD',
        timestamp: new Date(t.tradeTime ?? Date.now()),
        platform: 'ibkr',
      })) as TxRecord[];
    } catch {
      return [];
    }
  }
}
