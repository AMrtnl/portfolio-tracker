import { Router, Request, Response } from 'express';
import { getAlerts, createAlert, updateAlert, deleteAlert } from '../services/alerts.service.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const alerts = await getAlerts();
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts', message: (err as Error).message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const alert = await createAlert(req.body);
    res.status(201).json(alert);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create alert', message: (err as Error).message });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    await updateAlert(req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update alert', message: (err as Error).message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await deleteAlert(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete alert', message: (err as Error).message });
  }
});

export default router;
