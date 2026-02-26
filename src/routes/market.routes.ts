import { Router, Request, Response } from 'express';
import {
  getCryptoPrices,
  getMacroData,
  getEconomicCalendar,
  getEarningsCalendar,
  getMarketNews,
  getStockQuote,
} from '../services/market-data.service.js';

const router = Router();

router.get('/prices', async (_req: Request, res: Response) => {
  try {
    const prices = await getCryptoPrices();
    res.json(prices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prices', message: (err as Error).message });
  }
});

router.get('/macro', async (_req: Request, res: Response) => {
  try {
    const macro = await getMacroData();
    res.json(macro);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch macro data', message: (err as Error).message });
  }
});

router.get('/calendar/economic', async (_req: Request, res: Response) => {
  try {
    const events = await getEconomicCalendar();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch economic calendar', message: (err as Error).message });
  }
});

router.get('/calendar/earnings', async (_req: Request, res: Response) => {
  try {
    const events = await getEarningsCalendar();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch earnings calendar', message: (err as Error).message });
  }
});

router.get('/news', async (_req: Request, res: Response) => {
  try {
    const news = await getMarketNews();
    res.json(news);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch news', message: (err as Error).message });
  }
});

router.get('/quote/:symbol', async (req: Request, res: Response) => {
  try {
    const quote = await getStockQuote(req.params.symbol.toUpperCase());
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quote', message: (err as Error).message });
  }
});

export default router;
