import { Router, Request, Response } from 'express';
import {
  getSubscriptions,
  addSubscription,
  updateSubscription,
  deleteSubscription,
  getBudgetSummary,
  getBudgetCategories,
  upsertBudgetCategory,
} from '../services/budget.service.js';

const router = Router();

router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const summary = await getBudgetSummary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch budget summary', message: (err as Error).message });
  }
});

router.get('/subscriptions', async (_req: Request, res: Response) => {
  try {
    const subs = await getSubscriptions();
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscriptions', message: (err as Error).message });
  }
});

router.post('/subscriptions', async (req: Request, res: Response) => {
  try {
    const sub = await addSubscription(req.body);
    res.status(201).json(sub);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add subscription', message: (err as Error).message });
  }
});

router.patch('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    await updateSubscription(req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update subscription', message: (err as Error).message });
  }
});

router.delete('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    await deleteSubscription(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete subscription', message: (err as Error).message });
  }
});

router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const cats = await getBudgetCategories();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories', message: (err as Error).message });
  }
});

router.put('/categories', async (req: Request, res: Response) => {
  try {
    const { name, limit, color } = req.body;
    const cat = await upsertBudgetCategory(name, limit, color);
    res.json(cat);
  } catch (err) {
    res.status(500).json({ error: 'Failed to upsert category', message: (err as Error).message });
  }
});

export default router;
