import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { clerkMiddleware } from './middleware/auth.js';
import { checkAlerts } from './services/alerts.service.js';
import portfolioRoutes from './routes/portfolio.routes.js';
import accountsRoutes from './routes/accounts.routes.js';
import marketRoutes from './routes/market.routes.js';
import aiRoutes from './routes/ai.routes.js';
import budgetRoutes from './routes/budget.routes.js';
import alertsRoutes from './routes/alerts.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import billingRoutes from './routes/billing.routes.js';
import swapRoutes from './routes/swap.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 4000;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.APP_URL ?? 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Clerk auth — injects auth context on every request (does NOT block unauthenticated)
app.use(clerkMiddleware());

// ── Public routes ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    name: 'FinVault',
    timestamp: new Date().toISOString(),
    features: {
      ai: !!process.env.ANTHROPIC_API_KEY,
      clerk: !!process.env.CLERK_SECRET_KEY,
      lemonSqueezy: !!process.env.LEMONSQUEEZY_API_KEY,
      zerox: !!process.env.ZEROX_API_KEY,
    },
  });
});

// Webhook must receive raw body — register before json middleware if needed
app.use('/api/billing', billingRoutes);

// ── Protected routes (requireAuth called per-router) ──────────────────────────
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/swap', swapRoutes);

// ── Background jobs ────────────────────────────────────────────────────────────
cron.schedule('* * * * *', () => {
  checkAlerts().catch(err => console.warn('Alert check failed:', err.message));
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║           FinVault API  v2.0             ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\n📡  http://localhost:${PORT}`);
  console.log('🔐  Auth:    Clerk');
  console.log('💳  Billing: LemonSqueezy');
  console.log('🔄  Swap:    0x Protocol\n');
});

export default app;
