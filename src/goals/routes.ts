import { Router, Request, Response } from 'express';
import { tenantFor } from '../users/tenant';
import type { GoalInput } from './store';

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Every handler resolves the caller's own goals store from the request. */
export function createGoalsRouter(): Router {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    res.json({ goals: tenantFor(req).goals.list() });
  });

  router.post('/', (req: Request, res: Response) => {
    try {
      res.status(201).json(tenantFor(req).goals.add((req.body ?? {}) as GoalInput));
    } catch (err) {
      res.status(400).json({ error: message(err) });
    }
  });

  router.put('/:id', (req: Request, res: Response) => {
    try {
      const goal = tenantFor(req).goals.update(req.params.id, (req.body ?? {}) as GoalInput);
      if (!goal) return res.status(404).json({ error: 'Goal not found' });
      res.json(goal);
    } catch (err) {
      res.status(400).json({ error: message(err) });
    }
  });

  router.delete('/:id', (req: Request, res: Response) => {
    if (!tenantFor(req).goals.remove(req.params.id)) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    res.json({ success: true });
  });

  return router;
}
