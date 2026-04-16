import { Router, Request, Response } from 'express';
import { requireAuth, getUserId } from '../middleware/auth.js';
import {
  getSubscriptions, addSubscription, updateSubscription, deleteSubscription,
  getBudgetSummary, getBudgetCategories, upsertBudgetCategory,
} from '../services/budget.service.js';

const router = Router();
router.use(requireAuth);

router.get('/summary', async (req: Request, res: Response) => {
  try { res.json(await getBudgetSummary(getUserId(req))); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

router.get('/subscriptions', async (req: Request, res: Response) => {
  try { res.json(await getSubscriptions(getUserId(req))); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

router.post('/subscriptions', async (req: Request, res: Response) => {
  try { res.status(201).json(await addSubscription(getUserId(req), req.body)); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

router.patch('/subscriptions/:id', async (req: Request, res: Response) => {
  try { await updateSubscription(req.params.id, getUserId(req), req.body); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

router.delete('/subscriptions/:id', async (req: Request, res: Response) => {
  try { await deleteSubscription(req.params.id, getUserId(req)); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

router.get('/categories', async (req: Request, res: Response) => {
  try { res.json(await getBudgetCategories(getUserId(req))); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

router.put('/categories', async (req: Request, res: Response) => {
  try {
    const { name, limit, color } = req.body;
    res.json(await upsertBudgetCategory(getUserId(req), name, limit, color));
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

export default router;
