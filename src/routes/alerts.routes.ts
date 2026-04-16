import { Router, Request, Response } from 'express';
import { requireAuth, getUserId } from '../middleware/auth.js';
import { getAlerts, createAlert, updateAlert, deleteAlert } from '../services/alerts.service.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  try {
    res.json(await getAlerts(getUserId(req)));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const alert = await createAlert(getUserId(req), req.body);
    res.status(201).json(alert);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    await updateAlert(req.params.id, getUserId(req), req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await deleteAlert(req.params.id, getUserId(req));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
