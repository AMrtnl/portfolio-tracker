import { Router, Request, Response } from 'express';
import { requireAuth, getUserId } from '../middleware/auth.js';
import { requirePlan } from '../middleware/plan.js';
import { chatWithAI, generateInsights, analyzePosition, getConversationHistory } from '../services/ai.service.js';
import { prisma } from '../db/client.js';

const router = Router();
router.use(requireAuth);

router.post('/chat', requirePlan('pro'), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({ content: 'FinVault AI requires an `ANTHROPIC_API_KEY` to be configured.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const stream = await chatWithAI(userId, message, history ?? []);
    let fullContent = '';
    for await (const chunk of stream) {
      fullContent += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true, fullContent })}\n\n`);
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: (err as Error).message });
    else { res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`); res.end(); }
  }
});

router.get('/insights', requirePlan('pro'), async (req: Request, res: Response) => {
  try {
    const insights = await generateInsights(getUserId(req));
    res.json(insights);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/analyze', requirePlan('pro'), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { asset, platform } = req.body;
    if (!asset) return res.status(400).json({ error: 'asset is required' });
    const analysis = await analyzePosition(userId, asset, platform ?? 'unknown');
    res.json({ analysis });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/history', async (req: Request, res: Response) => {
  try {
    const history = await getConversationHistory(getUserId(req));
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete('/history', async (req: Request, res: Response) => {
  try {
    await prisma.aIConversation.deleteMany({ where: { userId: getUserId(req) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
