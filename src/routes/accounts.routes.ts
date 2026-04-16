import { Router, Request, Response } from 'express';
import { requireAuth, getUserId } from '../middleware/auth.js';
import { getUserPlan } from '../middleware/plan.js';
import { getAccounts, addAccount, updateAccount, deleteAccount } from '../services/portfolio.service.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  try {
    const accounts = await getAccounts(getUserId(req));
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch accounts', message: (err as Error).message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { name, type, platform, credentials } = req.body;
    if (!name || !type || !platform || !credentials) {
      return res.status(400).json({ error: 'name, type, platform, and credentials are required' });
    }
    // Enforce plan limit
    const [plan, existing] = await Promise.all([getUserPlan(userId), getAccounts(userId)]);
    if (existing.length >= plan.limits.accounts) {
      return res.status(403).json({
        error: 'upgrade_required',
        message: `Your ${plan.name} plan allows up to ${plan.limits.accounts} accounts. Upgrade to add more.`,
      });
    }
    await addAccount(userId, name, type, platform, credentials);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add account', message: (err as Error).message });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    await updateAccount(req.params.id, getUserId(req), req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update account', message: (err as Error).message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await deleteAccount(req.params.id, getUserId(req));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account', message: (err as Error).message });
  }
});

export default router;
