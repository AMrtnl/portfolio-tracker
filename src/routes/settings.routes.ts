import { Router, Request, Response } from 'express';
import { requireAuth, getUserId } from '../middleware/auth.js';
import { prisma } from '../db/client.js';

const router = Router();
router.use(requireAuth);

async function getOrCreate(userId: string) {
  let s = await prisma.userSettings.findUnique({ where: { userId } });
  if (!s) s = await prisma.userSettings.create({ data: { userId } });
  return s;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const s = await getOrCreate(getUserId(req));
    res.json({ ...s, alertPreferences: JSON.parse(s.alertPreferences ?? '{}') });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.patch('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    await getOrCreate(userId);
    const { baseCurrency, riskProfile, theme, alertPreferences } = req.body;
    const updated = await prisma.userSettings.update({
      where: { userId },
      data: {
        ...(baseCurrency && { baseCurrency }),
        ...(riskProfile && { riskProfile }),
        ...(theme && { theme }),
        ...(alertPreferences && { alertPreferences: JSON.stringify(alertPreferences) }),
      },
    });
    res.json({ ...updated, alertPreferences: JSON.parse(updated.alertPreferences ?? '{}') });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
