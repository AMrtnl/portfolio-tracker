import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WalletCore } from './wallet-core';
import { HyperliquidAdapter } from './defi/hyperliquid';
import { PortfolioSummary } from './types/common';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize wallet and adapters
let walletCore: WalletCore;
let hyperliquid: HyperliquidAdapter;

function initializeWallet() {
  walletCore = new WalletCore();
  const mnemonic = process.env.MNEMONIC;
  
  if (!mnemonic) {
    console.warn('⚠️  No mnemonic found in .env file');
    console.log('Please add MNEMONIC=your_mnemonic_here to your .env file');
    return false;
  }
  
  try {
    walletCore.setMnemonic(mnemonic);
    hyperliquid = new HyperliquidAdapter(walletCore);
    console.log('✅ Wallet initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing wallet:', error);
    return false;
  }
}

// Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/portfolio', async (req: Request, res: Response) => {
  try {
    if (!walletCore || !hyperliquid) {
      return res.status(503).json({ 
        error: 'Wallet not initialized. Please configure your mnemonic in .env file.' 
      });
    }

    console.log('📊 Fetching portfolio data...');

    // Fetch data from Hyperliquid
    const [hyperliquidBalances, hyperliquidPositions] = await Promise.all([
      hyperliquid.getBalances(),
      hyperliquid.getPositions(),
    ]);

    // Calculate total portfolio value
    const totalValue = hyperliquidBalances.reduce((sum, balance) => {
      return sum + parseFloat(balance.usdValue || '0');
    }, 0);

    // Mock PnL data (in production, this would come from historical data)
    const portfolio: PortfolioSummary = {
      totalValue: totalValue.toString(),
      pnl24h: '2.5',
      pnl7d: '8.3',
      pnl30d: '15.7',
      assets: hyperliquidBalances,
      positions: hyperliquidPositions,
      lastUpdated: new Date().toISOString(),
    };

    console.log(`✅ Portfolio fetched: $${totalValue.toFixed(2)}`);
    res.json(portfolio);
  } catch (error) {
    console.error('❌ Error fetching portfolio:', error);
    res.status(500).json({ 
      error: 'Failed to fetch portfolio data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/wallet/address', (req: Request, res: Response) => {
  try {
    if (!walletCore) {
      return res.status(503).json({ error: 'Wallet not initialized' });
    }

    const address = walletCore.getAddress(0, 1337);
    res.json({ address });
  } catch (error) {
    console.error('Error getting wallet address:', error);
    res.status(500).json({ error: 'Failed to get wallet address' });
  }
});

// Start server
const isWalletInitialized = initializeWallet();

app.listen(PORT, () => {
  console.log('\n🚀 Portfolio Tracker API Server');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🔗 API endpoints:`);
  console.log(`   - GET /api/health`);
  console.log(`   - GET /api/portfolio`);
  console.log(`   - GET /api/wallet/address`);
  
  if (!isWalletInitialized) {
    console.log('\n⚠️  WARNING: Wallet not initialized!');
    console.log('Please add your mnemonic to the .env file to enable portfolio tracking.');
  } else {
    console.log('\n✅ Ready to track your portfolio!');
  }
  console.log('');
});
