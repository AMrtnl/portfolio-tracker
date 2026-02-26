import { Router, Request, Response } from 'express';
import { chatWithAI, generateInsights, analyzePosition, getConversationHistory } from '../services/ai.service.js';

const router = Router();

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({
        content: "FinVault AI is not configured. Please add your `ANTHROPIC_API_KEY` to the `.env` file to enable the AI advisor.",
      });
    }

    // Set up SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const stream = await chatWithAI(message, history ?? []);
    let fullContent = '';

    for await (const chunk of stream) {
      fullContent += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true, fullContent })}\n\n`);
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'AI chat failed', message: (err as Error).message });
    } else {
      res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
      res.end();
    }
  }
});

router.get('/insights', async (_req: Request, res: Response) => {
  try {
    const insights = await generateInsights();
    res.json(insights);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate insights', message: (err as Error).message });
  }
});

router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { asset, platform } = req.body;
    if (!asset) return res.status(400).json({ error: 'asset is required' });
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({ analysis: 'AI analysis requires an Anthropic API key.' });
    }
    const analysis = await analyzePosition(asset, platform ?? 'unknown');
    res.json({ analysis });
  } catch (err) {
    res.status(500).json({ error: 'Failed to analyze position', message: (err as Error).message });
  }
});

router.get('/history', async (_req: Request, res: Response) => {
  try {
    const history = await getConversationHistory();
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch AI history', message: (err as Error).message });
  }
});

router.delete('/history', async (_req: Request, res: Response) => {
  try {
    const { prisma } = await import('../db/client.js');
    await prisma.aIConversation.deleteMany();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear AI history', message: (err as Error).message });
  }
});

export default router;
