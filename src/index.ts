import dotenv from 'dotenv';
import { WalletCore } from './wallet-core';
import { HyperliquidAdapter } from './defi/hyperliquid';
import { PortfolioSummary } from './types/common';

// Load environment variables
dotenv.config();

class PortfolioTracker {
  private walletCore: WalletCore;
  private hyperliquid: HyperliquidAdapter;

  constructor() {
    this.walletCore = new WalletCore();
    this.initializeWallet();
    this.hyperliquid = new HyperliquidAdapter(this.walletCore);
  }

  private initializeWallet(): void {
    const mnemonic = process.env.MNEMONIC;
    if (!mnemonic) {
      console.warn('No mnemonic found in .env. Generating a new one...');
      const newMnemonic = this.walletCore.generateMnemonic();
      console.log('New mnemonic generated. Please save it securely:', newMnemonic);
      console.log('Add it to your .env file as MNEMONIC=your_mnemonic_here');
    } else {
      this.walletCore.setMnemonic(mnemonic);
      console.log('Wallet initialized with mnemonic from .env');
    }
  }

  public async getPortfolioSummary(): Promise<PortfolioSummary> {
    console.log('Fetching portfolio data...');
    
    // Get data from Hyperliquid
    const [hyperliquidBalances, hyperliquidPositions] = await Promise.all([
      this.hyperliquid.getBalances(),
      this.hyperliquid.getPositions(),
    ]);

    // Calculate total portfolio value
    const totalValue = this.calculateTotalValue([
      ...hyperliquidBalances,
    ]);

    // For demo purposes, using placeholder values for PnL
    const summary: PortfolioSummary = {
      totalValue: totalValue.toString(),
      pnl24h: '0', // Would be calculated from historical data
      pnl7d: '0',  // Would be calculated from historical data
      pnl30d: '0', // Would be calculated from historical data
      assets: [...hyperliquidBalances],
      positions: [...hyperliquidPositions],
      lastUpdated: new Date().toISOString(),
    };

    return summary;
  }

  private calculateTotalValue(balances: { usdValue: string }[]): number {
    return balances.reduce((sum, balance) => {
      return sum + parseFloat(balance.usdValue || '0');
    }, 0);
  }
}

// Example usage
async function main() {
  try {
    const tracker = new PortfolioTracker();
    const portfolio = await tracker.getPortfolioSummary();
    
    console.log('\n=== Portfolio Summary ===');
    console.log(`Total Value: $${parseFloat(portfolio.totalValue).toFixed(2)}`);
    console.log(`Assets (${portfolio.assets.length}):`);
    portfolio.assets.forEach(asset => {
      console.log(`  ${asset.asset}: ${asset.amount} ($${parseFloat(asset.usdValue).toFixed(2)})`);
    });
    
    if (portfolio.positions.length > 0) {
      console.log(`\nOpen Positions (${portfolio.positions.length}):`);
      portfolio.positions.forEach(pos => {
        console.log(`  ${pos.asset} ${pos.side} ${pos.size} @ $${pos.entryPrice}`);
        console.log(`    PnL: $${parseFloat(pos.pnl).toFixed(2)} (${parseFloat(pos.pnlPercent).toFixed(2)}%)`);
      });
    }
    
    console.log(`\nLast updated: ${new Date(portfolio.lastUpdated).toLocaleString()}`);
  } catch (error) {
    console.error('Error in portfolio tracker:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);
