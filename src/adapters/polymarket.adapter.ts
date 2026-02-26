import axios from 'axios';
import { ethers } from 'ethers';
import { IAdapter } from './base.adapter.js';
import { Balance, Position, TxRecord } from '../types/common.js';

const CLOB_URL = 'https://clob.polymarket.com';
const GAMMA_URL = 'https://gamma-api.polymarket.com';

export class PolymarketAdapter implements IAdapter {
  platform = 'polymarket';
  accountType = 'PREDICTION' as const;

  private address: string;

  constructor(private privateKey?: string) {
    if (privateKey) {
      this.address = new ethers.Wallet(privateKey).address;
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
      // Get USDC balance from Polymarket
      const { data } = await axios.get(`${CLOB_URL}/balance?address=${this.address}`);
      const usdc = parseFloat(data?.balance ?? '0');
      if (usdc === 0) return [];
      return [{
        asset: 'USDC',
        amount: usdc.toString(),
        usdValue: usdc.toString(),
        chain: 'Polygon',
        platform: 'polymarket',
      }];
    } catch (err) {
      console.error('Polymarket getBalances error:', err);
      return [];
    }
  }

  async getPositions(): Promise<Position[]> {
    if (!this.isConfigured()) return [];
    try {
      const { data } = await axios.get(
        `${GAMMA_URL}/positions?user=${this.address.toLowerCase()}&sizeThreshold=0.01`
      );
      const positions: Position[] = [];
      for (const pos of data ?? []) {
        const size = parseFloat(pos.size ?? '0');
        if (size <= 0) continue;
        const currentPrice = parseFloat(pos.currentPrice ?? '0.5');
        const avgPrice = parseFloat(pos.avgPrice ?? '0.5');
        const pnl = (currentPrice - avgPrice) * size;
        positions.push({
          asset: pos.title ?? pos.marketSlug ?? 'Unknown Market',
          size: size.toString(),
          entryPrice: avgPrice.toFixed(4),
          markPrice: currentPrice.toFixed(4),
          pnl: pnl.toFixed(2),
          pnlPercent: (((currentPrice - avgPrice) / avgPrice) * 100).toFixed(2),
          side: 'LONG',
          type: 'PREDICTION',
          protocol: 'POLYMARKET',
          platform: 'polymarket',
          metadata: {
            marketId: pos.marketId,
            outcome: pos.outcome,
            conditionId: pos.conditionId,
          },
        });
      }
      return positions;
    } catch (err) {
      console.error('Polymarket getPositions error:', err);
      return [];
    }
  }

  async getTransactions(from?: Date): Promise<TxRecord[]> {
    if (!this.isConfigured()) return [];
    try {
      const { data } = await axios.get(
        `${GAMMA_URL}/trades?maker=${this.address.toLowerCase()}&limit=50`
      );
      const cutoff = from ? from.getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000;
      return (data ?? [])
        .filter((t: any) => new Date(t.timestamp).getTime() > cutoff)
        .map((t: any) => ({
          asset: t.market ?? 'Prediction',
          type: t.side === 'BUY' ? 'BUY' : 'SELL',
          amount: parseFloat(t.size),
          price: parseFloat(t.price),
          fee: parseFloat(t.fee ?? '0'),
          currency: 'USDC',
          timestamp: new Date(t.timestamp),
          platform: 'polymarket',
        })) as TxRecord[];
    } catch {
      return [];
    }
  }
}
