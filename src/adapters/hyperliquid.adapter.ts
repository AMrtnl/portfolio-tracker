import axios from 'axios';
import { ethers } from 'ethers';
import { IAdapter } from './base.adapter.js';
import { Balance, Position, TxRecord } from '../types/common.js';

const BASE_URL = 'https://api.hyperliquid.xyz';

export class HyperliquidAdapter implements IAdapter {
  platform = 'hyperliquid';
  accountType = 'CRYPTO_EXCHANGE' as const;

  private address: string;
  private privateKey?: string;

  constructor(credentials: { address?: string; privateKey?: string; mnemonic?: string }) {
    if (credentials.mnemonic) {
      const wallet = ethers.Wallet.fromPhrase(credentials.mnemonic);
      this.privateKey = wallet.privateKey;
      this.address = wallet.address;
    } else if (credentials.privateKey) {
      const wallet = new ethers.Wallet(credentials.privateKey);
      this.privateKey = credentials.privateKey;
      this.address = wallet.address;
    } else if (credentials.address) {
      this.address = credentials.address;
    } else {
      this.address = '';
    }
  }

  isConfigured(): boolean {
    return this.address.length > 0;
  }

  async getBalances(): Promise<Balance[]> {
    if (!this.isConfigured()) return [];
    try {
      const { data } = await axios.post(`${BASE_URL}/info`, {
        type: 'clearinghouseState',
        user: this.address,
      });

      const balances: Balance[] = [];

      if (data?.marginSummary?.accountValue) {
        balances.push({
          asset: 'USDC',
          amount: data.marginSummary.accountValue,
          usdValue: data.marginSummary.accountValue,
          chain: 'Hyperliquid',
          platform: 'hyperliquid',
        });
      }

      // Spot balances
      const spotData = await axios.post(`${BASE_URL}/info`, {
        type: 'spotClearinghouseState',
        user: this.address,
      });

      if (spotData.data?.balances) {
        for (const b of spotData.data.balances) {
          if (parseFloat(b.total) > 0) {
            balances.push({
              asset: b.coin,
              amount: b.total,
              usdValue: (parseFloat(b.total) * (b.entryNtl || 0)).toString(),
              chain: 'Hyperliquid',
              platform: 'hyperliquid',
            });
          }
        }
      }

      return balances;
    } catch (err) {
      console.error('Hyperliquid getBalances error:', err);
      return [];
    }
  }

  async getPositions(): Promise<Position[]> {
    if (!this.isConfigured()) return [];
    try {
      const { data } = await axios.post(`${BASE_URL}/info`, {
        type: 'clearinghouseState',
        user: this.address,
      });

      if (!data?.assetPositions) return [];

      return data.assetPositions
        .filter((p: any) => parseFloat(p.position?.szi ?? '0') !== 0)
        .map((p: any) => {
          const szi = parseFloat(p.position.szi);
          return {
            asset: p.position.coin,
            size: Math.abs(szi).toString(),
            entryPrice: p.position.entryPx ?? '0',
            markPrice: p.position.markPx ?? '0',
            pnl: p.position.unrealizedPnl ?? '0',
            pnlPercent: p.position.returnOnEquity ?? '0',
            leverage: p.position.leverage?.value?.toString() ?? '1',
            side: szi > 0 ? 'LONG' : 'SHORT',
            type: 'PERPETUAL',
            protocol: 'HYPERLIQUID',
            platform: 'hyperliquid',
          } as Position;
        });
    } catch (err) {
      console.error('Hyperliquid getPositions error:', err);
      return [];
    }
  }

  async getTransactions(from?: Date): Promise<TxRecord[]> {
    if (!this.isConfigured()) return [];
    try {
      const { data } = await axios.post(`${BASE_URL}/info`, {
        type: 'userFills',
        user: this.address,
      });

      if (!Array.isArray(data)) return [];

      const cutoff = from ? from.getTime() : 0;
      return data
        .filter((fill: any) => fill.time > cutoff)
        .map((fill: any) => ({
          asset: fill.coin,
          type: fill.dir === 'Open Long' || fill.dir === 'Open Short' ? 'BUY' : 'SELL',
          amount: parseFloat(fill.sz),
          price: parseFloat(fill.px),
          fee: parseFloat(fill.fee ?? '0'),
          currency: 'USD',
          timestamp: new Date(fill.time),
          platform: 'hyperliquid',
        })) as TxRecord[];
    } catch (err) {
      console.error('Hyperliquid getTransactions error:', err);
      return [];
    }
  }
}
