import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { checkAlerts } from './services/alerts.service.js';
import portfolioRoutes from './routes/portfolio.routes.js';
import accountsRoutes from './routes/accounts.routes.js';
import marketRoutes from './routes/market.routes.js';
import aiRoutes from './routes/ai.routes.js';
import budgetRoutes from './routes/budget.routes.js';
import alertsRoutes from './routes/alerts.routes.js';
import settingsRoutes from './routes/settings.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 4000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    name: 'FinVault',
    timestamp: new Date().toISOString(),
    features: {
      ai: !!process.env.ANTHROPIC_API_KEY,
      finnhub: !!process.env.FINNHUB_API_KEY,
      alphaVantage: !!process.env.ALPHA_VANTAGE_API_KEY,
    },
  });
});

app.use('/api/portfolio', portfolioRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/settings', settingsRoutes);

// ── Background Jobs ───────────────────────────────────────────────────────────
// Check alerts every 60 seconds
cron.schedule('* * * * *', () => {
  checkAlerts().catch(err => console.warn('Alert check failed:', err.message));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║           FinVault API Server            ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\n📡 Running on http://localhost:${PORT}`);
  console.log('\n📋 API Endpoints:');
  console.log(`   GET  /api/health`);
  console.log(`   GET  /api/portfolio`);
  console.log(`   GET  /api/portfolio/history`);
  console.log(`   GET  /api/accounts`);
  console.log(`   POST /api/accounts`);
  console.log(`   GET  /api/market/prices`);
  console.log(`   GET  /api/market/macro`);
  console.log(`   GET  /api/market/news`);
  console.log(`   GET  /api/market/calendar/economic`);
  console.log(`   GET  /api/market/calendar/earnings`);
  console.log(`   POST /api/ai/chat`);
  console.log(`   GET  /api/ai/insights`);
  console.log(`   GET  /api/budget/summary`);
  console.log(`   GET  /api/budget/subscriptions`);
  console.log(`   GET  /api/alerts`);
  console.log('\n✅ All systems nominal\n');
});

export default app;
