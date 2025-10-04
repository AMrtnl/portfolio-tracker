import { ethers } from 'ethers';
import { Exchange, types } from '@hyperliquid/sdk';
import { WalletCore } from '../wallet-core';
import { Position, Balance } from '../types/common';

export class HyperliquidAdapter {
  private exchange: Exchange;
  private walletCore: WalletCore;
  private accountIndex: number;
  private walletAddress: string;

  constructor(walletCore: WalletCore, accountIndex: number = 0) {
    this.walletCore = walletCore;
    this.accountIndex = accountIndex;
    this.walletAddress = walletCore.getAddress(accountIndex, 1337); // Using 1337 as chainId for Hyperliquid
    
    // Initialize Hyperliquid exchange
    this.exchange = new Exchange({
      privateKey: walletCore.getPrivateKey(accountIndex, 1337),
      baseUrl: 'https://api.hyperliquid.xyz',
      chainId: 1337,
    });
  }

  /**
   * Get all open positions
   */
  public async getPositions(): Promise<Position[]> {
    try {
      const response = await this.exchange.getPositions(this.walletAddress);
      
      return response.map((position: any) => ({
        asset: position.coin,
        size: position.position.value,
        entryPrice: position.entryPx,
        markPrice: position.markPx,
        pnl: position.unrealizedPnl,
        pnlPercent: position.returnOnEquity,
        leverage: position.leverage,
        side: position.side === 'B' ? 'LONG' : 'SHORT',
        type: 'PERPETUAL',
        protocol: 'HYPERLIQUID',
      }));
    } catch (error) {
      console.error('Error fetching Hyperliquid positions:', error);
      return [];
    }
  }

  /**
   * Get account balances
   */
  public async getBalances(): Promise<Balance[]> {
    try {
      const response = await this.exchange.getBalances(this.walletAddress);
      
      return response.map((balance: any) => ({
        asset: balance.coin,
        amount: balance.free,
        usdValue: balance.usdValue,
        chain: 'Hyperliquid',
      }));
    } catch (error) {
      console.error('Error fetching Hyperliquid balances:', error);
      return [];
    }
  }

  /**
   * Place a new order
   */
  public async placeOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    size: number,
    price: number,
    orderType: 'LIMIT' | 'MARKET' = 'LIMIT'
  ): Promise<any> {
    const order: types.Order = {
      symbol,
      side: side === 'BUY' ? 'B' : 'S',
      orderQty: size,
      orderType,
      price,
      timeInForce: 'GTC', // Good Till Cancelled
    };

    try {
      return await this.exchange.placeOrder(order);
    } catch (error) {
      console.error('Error placing order on Hyperliquid:', error);
      throw error;
    }
  }

  /**
   * Cancel an existing order
   */
  public async cancelOrder(orderId: string): Promise<boolean> {
    try {
      await this.exchange.cancelOrder(orderId);
      return true;
    } catch (error) {
      console.error('Error canceling order on Hyperliquid:', error);
      return false;
    }
  }
}
