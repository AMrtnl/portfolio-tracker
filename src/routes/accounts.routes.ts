import { Router, Request, Response } from 'express';
import { getAccounts, addAccount, updateAccount, deleteAccount } from '../services/portfolio.service.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const accounts = await getAccounts();
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch accounts', message: (err as Error).message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, type, platform, credentials } = req.body;
    if (!name || !type || !platform || !credentials) {
      return res.status(400).json({ error: 'name, type, platform, and credentials are required' });
    }
    await addAccount(name, type, platform, credentials);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add account', message: (err as Error).message });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await updateAccount(id, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update account', message: (err as Error).message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await deleteAccount(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account', message: (err as Error).message });
  }
});

export default router;
