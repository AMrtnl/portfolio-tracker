import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePlan } from '../middleware/plan.js';
import axios from 'axios';

const router = Router();
router.use(requireAuth);

const ZX_BASE = 'https://api.0x.org/swap/allowance-holder';
const zxHeaders = () => ({
  '0x-api-key': process.env.ZEROX_API_KEY ?? '',
  '0x-version': 'v2',
});

// GET /api/swap/tokens?chainId=1
router.get('/tokens', requirePlan('pro'), async (req: Request, res: Response) => {
  try {
    const chainId = req.query.chainId ?? '1';
    const response = await axios.get(
      `https://tokens.coingecko.com/uniswap/all.json`,
      { timeout: 10000 }
    );
    const tokens = (response.data.tokens ?? [])
      .filter((t: any) => t.chainId === Number(chainId))
      .slice(0, 200);
    res.json(tokens);
  } catch {
    // Fallback: common tokens
    res.json([
      { symbol: 'ETH', name: 'Ether', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18, chainId: 1, logoURI: '' },
      { symbol: 'WETH', name: 'Wrapped Ether', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, chainId: 1 },
      { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, chainId: 1 },
      { symbol: 'USDT', name: 'Tether USD', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, chainId: 1 },
      { symbol: 'DAI', name: 'Dai', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, chainId: 1 },
      { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, chainId: 1 },
      { symbol: 'LINK', name: 'Chainlink', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18, chainId: 1 },
      { symbol: 'UNI', name: 'Uniswap', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, chainId: 1 },
      { symbol: 'AAVE', name: 'Aave Token', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', decimals: 18, chainId: 1 },
    ]);
  }
});

// GET /api/swap/price  — indicative, no commitment
router.get('/price', requirePlan('pro'), async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams(req.query as Record<string, string>);
    const response = await axios.get(`${ZX_BASE}/price?${params}`, { headers: zxHeaders() });
    res.json(response.data);
  } catch (err: any) {
    res.status(err.response?.status ?? 500).json(err.response?.data ?? { error: err.message });
  }
});

// GET /api/swap/quote  — firm quote with calldata
router.get('/quote', requirePlan('pro'), async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams(req.query as Record<string, string>);
    const response = await axios.get(`${ZX_BASE}/quote?${params}`, { headers: zxHeaders() });
    res.json(response.data);
  } catch (err: any) {
    res.status(err.response?.status ?? 500).json(err.response?.data ?? { error: err.message });
  }
});

export default router;
