import { Router, Request, Response } from 'express';
import { fetchUnifiedPortfolio, getPortfolioHistory } from '../services/portfolio.service.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const portfolio = await fetchUnifiedPortfolio();
    res.json(portfolio);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch portfolio', message: (err as Error).message });
  }
});

router.get('/history', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const history = await getPortfolioHistory(days);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history', message: (err as Error).message });
  }
});

export default router;
