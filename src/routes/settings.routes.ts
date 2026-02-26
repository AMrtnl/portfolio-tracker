import { Router, Request, Response } from 'express';
import { prisma } from '../db/client.js';

const router = Router();

async function getOrCreateSettings() {
  let s = await prisma.userSettings.findFirst();
  if (!s) {
    s = await prisma.userSettings.create({
      data: { id: 'singleton', baseCurrency: 'USD', riskProfile: 'moderate', theme: 'dark' },
    });
  }
  return s;
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSettings();
    res.json({
      ...settings,
      alertPreferences: JSON.parse(settings.alertPreferences ?? '{}'),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings', message: (err as Error).message });
  }
});

router.patch('/', async (req: Request, res: Response) => {
  try {
    await getOrCreateSettings();
    const { baseCurrency, riskProfile, theme, alertPreferences } = req.body;
    const updated = await prisma.userSettings.update({
      where: { id: 'singleton' },
      data: {
        ...(baseCurrency && { baseCurrency }),
        ...(riskProfile && { riskProfile }),
        ...(theme && { theme }),
        ...(alertPreferences && { alertPreferences: JSON.stringify(alertPreferences) }),
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings', message: (err as Error).message });
  }
});

export default router;
