import { Router, Request, Response } from 'express';
import { addGoal, listGoals, removeGoal, updateGoal, type GoalInput } from './store';

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function createGoalsRouter(): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    res.json({ goals: listGoals() });
  });

  router.post('/', (req: Request, res: Response) => {
    try {
      res.status(201).json(addGoal((req.body ?? {}) as GoalInput));
    } catch (err) {
      res.status(400).json({ error: message(err) });
    }
  });

  router.put('/:id', (req: Request, res: Response) => {
    try {
      const goal = updateGoal(req.params.id, (req.body ?? {}) as GoalInput);
      if (!goal) return res.status(404).json({ error: 'Goal not found' });
      res.json(goal);
    } catch (err) {
      res.status(400).json({ error: message(err) });
    }
  });

  router.delete('/:id', (req: Request, res: Response) => {
    if (!removeGoal(req.params.id)) return res.status(404).json({ error: 'Goal not found' });
    res.json({ success: true });
  });

  return router;
}
