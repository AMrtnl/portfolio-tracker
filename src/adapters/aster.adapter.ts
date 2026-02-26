import axios from 'axios';
import { ethers } from 'ethers';
import { IAdapter } from './base.adapter.js';
import { Balance, Position, TxRecord } from '../types/common.js';

// Aster is built on the Hyperliquid EVM (HyperEVM)
const HYPEREVM_RPC = 'https://rpc.hyperliquid.xyz/evm';
const ASTER_API = 'https://api.aster.finance';

export class AsterAdapter implements IAdapter {
  platform = 'aster';
  accountType = 'DEFI' as const;

  private address: string;
  private provider: ethers.JsonRpcProvider;

  constructor(credentials: { address?: string; privateKey?: string; mnemonic?: string }) {
    this.provider = new ethers.JsonRpcProvider(HYPEREVM_RPC);
    if (credentials.mnemonic) {
      this.address = ethers.Wallet.fromPhrase(credentials.mnemonic).address;
    } else if (credentials.privateKey) {
      this.address = new ethers.Wallet(credentials.privateKey).address;
    } else {
      this.address = credentials.address ?? '';
    }
  }

  isConfigured(): boolean {
    return this.address.length > 0;
  }

  async getBalances(): Promise<Balance[]> {
    if (!this.isConfigured()) return [];
    try {
      const balances: Balance[] = [];

      // Native HYPE balance on HyperEVM
      try {
        const hypeBalance = await this.provider.getBalance(this.address);
        const hypeFloat = parseFloat(ethers.formatEther(hypeBalance));
        if (hypeFloat > 0) {
          balances.push({
            asset: 'HYPE',
            amount: hypeFloat.toString(),
            usdValue: '0', // price fetched separately by market data service
            chain: 'HyperEVM',
            platform: 'aster',
          });
        }
      } catch { /* continue */ }

      // Aster LP positions
      try {
        const { data } = await axios.get(`${ASTER_API}/v1/positions?address=${this.address}`);
        for (const pos of data?.positions ?? []) {
          balances.push({
            asset: `ASTER-LP-${pos.pool}`,
            amount: pos.shares,
            usdValue: pos.valueUsd ?? '0',
            chain: 'HyperEVM',
            platform: 'aster',
          });
        }
      } catch { /* Aster API may not be available */ }

      return balances;
    } catch (err) {
      console.error('Aster getBalances error:', err);
      return [];
    }
  }

  async getPositions(): Promise<Position[]> {
    if (!this.isConfigured()) return [];
    try {
      const { data } = await axios.get(`${ASTER_API}/v1/lending?address=${this.address}`);
      return (data?.positions ?? []).map((p: any) => ({
        asset: p.asset,
        size: p.amount,
        entryPrice: '0',
        markPrice: p.price ?? '0',
        pnl: p.interestEarned ?? '0',
        pnlPercent: p.apy ?? '0',
        side: 'LONG' as const,
        type: 'SPOT' as const,
        protocol: 'ASTER',
        platform: 'aster',
        metadata: { poolId: p.poolId, positionType: p.type },
      })) as Position[];
    } catch {
      return [];
    }
  }

  async getTransactions(): Promise<TxRecord[]> {
    return [];
  }
}
