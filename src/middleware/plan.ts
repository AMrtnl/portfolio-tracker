import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { getUserId } from './auth.js';
import { PLANS } from '../routes/billing.routes.js';

export async function getUserPlan(userId: string) {
  const record = await prisma.userPlan.findUnique({ where: { userId } });
  const planId = record?.lsStatus === 'active' ? (record.plan ?? 'free') : 'free';
  return PLANS.find(p => p.id === planId) ?? PLANS[0];
}

export function requirePlan(minPlan: 'pro' | 'business') {
  const order = ['free', 'pro', 'business'];
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const plan = await getUserPlan(userId);
      if (order.indexOf(plan.id) < order.indexOf(minPlan)) {
        return res.status(403).json({
          error: 'upgrade_required',
          requiredPlan: minPlan,
          message: `This feature requires the ${minPlan} plan.`,
        });
      }
      next();
    } catch {
      next();
    }
  };
}
