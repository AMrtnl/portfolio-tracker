import fs from 'fs';
import path from 'path';
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
  authMode,
  authStatusHandler,
  isAuthenticated,
  loginHandler,
  loginPageHtml,
  logoutHandler,
  requireApiAuth,
  requirePageAuth,
} from './auth';
import { WalletCore } from './wallet-core';
import { PortfolioSummary, PortfolioSource } from './types/common';
import { Holding } from './types/accounts';
import { Store } from './store';
import {
  bootHyperliquidAccount,
  getProvider,
  hasLiveAdapter,
  listProviders,
  removeLiveAdapter,
  snaptrade,
} from './providers';
import {
  errorMessage,
  fetchSnapAccountDetail,
  fetchSnapAccounts,
  fetchSnapActivities,
  fetchSnapConnections,
  fetchSnapOrders,
  isSnaptradeConfigured,
} from './snaptrade';
import {
  createAnalyticsRouter,
  createMarketRouter,
  startHistoryScheduler,
} from './analytics';

dotenv.config();

function snaptradeUnavailable(res: Response) {
  return res.status(503).json({
    error: 'SnapTrade not configured',
    message:
      'Set SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY in .env. Free Personal plan: https://dashboard.snaptrade.com',
    configured: false,
  });
}

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const CLIENT_DIST = path.resolve(__dirname, '..', 'client', 'dist');

// Behind Railway's proxy, so req.ip / req.protocol must come from the
// forwarded headers for rate limiting and Secure cookies to work.
app.set('trust proxy', 1);

// Dev talks to this server through the Vite proxy (same-origin) and prod serves
// the client itself, so no cross-origin access is needed. A wildcard CORS
// header in production would only weaken the cookie gate.
if (!IS_PRODUCTION) {
  app.use(cors());
}
app.use(express.json());

const store = new Store();

function liveIds(): Set<string> {
  const ids = new Set<string>();
  for (const a of store.getAllRaw()) {
    if (a.provider === 'hyperliquid' && hasLiveAdapter(a.id)) ids.add(a.id);
  }
  return ids;
}

function rehydrateAccounts() {
  const accounts = store.getAllRaw();
  if (accounts.length === 0) {
    console.log('ℹ️  No saved accounts. Add one via Accounts in the UI.');
    return;
  }
  let booted = 0;
  for (const acct of accounts) {
    if (acct.provider !== 'hyperliquid') continue;
    const mnemonic = store.getMnemonic(acct.id);
    if (!mnemonic) {
      console.log(`  ❌ Could not decrypt wallet "${acct.label}"`);
      continue;
    }
    const { ok } = bootHyperliquidAccount(acct.id, mnemonic);
    console.log(
      ok
        ? `  ✅ Loaded crypto "${acct.label}" (${acct.externalId})`
        : `  ❌ Could not load crypto "${acct.label}"`,
    );
    if (ok) booted++;
  }
  const other = accounts.filter((a) => a.provider !== 'hyperliquid').length;
  console.log(
    `📂 ${booted} crypto wallet(s) live · ${other} other account(s) on disk.\n`,
  );
}

// ------------- Routes ---------------

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- auth (public) ----

app.get('/api/auth/session', authStatusHandler);
app.post('/api/auth/login', loginHandler);
app.post('/api/auth/logout', logoutHandler);

app.get('/login', (req: Request, res: Response) => {
  if (isAuthenticated(req)) return res.redirect(302, '/');
  res.type('html').send(loginPageHtml());
});

// Everything below this line requires a valid session.
app.use('/api', requireApiAuth);

app.get('/api/providers', (_req: Request, res: Response) => {
  res.json({ providers: listProviders() });
});

// ---- accounts ----

app.get('/api/accounts', (_req: Request, res: Response) => {
  res.json({ accounts: store.getAccounts(liveIds()) });
});

/** Legacy + crypto: POST { label, mnemonic } */
app.post('/api/accounts', (req: Request, res: Response) => {
  const { label, mnemonic } = req.body as { label?: string; mnemonic?: string };
  if (!mnemonic || typeof mnemonic !== 'string') {
    return res.status(400).json({
      error: 'mnemonic is required (or use /api/accounts/manual / snaptrade)',
    });
  }
  const trimmed = mnemonic.trim();
  const accountLabel = (label || '').trim() || 'Hyperliquid';

  try {
    const wc = new WalletCore();
    wc.setMnemonic(trimmed);
    const address = wc.getAddress(0, 1337);
    const id = store.addCryptoWallet(accountLabel, trimmed, address);
    const { ok } = bootHyperliquidAccount(id, trimmed);
    if (!ok) {
      store.removeAccount(id);
      return res.status(400).json({ error: 'Failed to initialize wallet' });
    }
    console.log(`✅ Crypto account added: "${accountLabel}" → ${address}`);
    res.json(store.getAccount(id, true));
  } catch (err) {
    console.error('❌ Invalid mnemonic:', err);
    res.status(400).json({ error: 'Invalid mnemonic phrase' });
  }
});

app.post('/api/accounts/manual', (req: Request, res: Response) => {
  const body = req.body as {
    label?: string;
    institution?: string;
    currency?: string;
    type?: 'manual' | 'broker' | 'bank';
    holdings?: Holding[];
  };

  const label = (body.label || '').trim();
  if (!label) return res.status(400).json({ error: 'label is required' });

  const holdings = Array.isArray(body.holdings) ? body.holdings : [];
  for (const h of holdings) {
    if (!h?.symbol || typeof h.symbol !== 'string') {
      return res.status(400).json({ error: 'Each holding needs a symbol' });
    }
  }

  const id = store.addManualAccount(label, {
    institution: body.institution?.trim(),
    currency: body.currency,
    holdings,
    type: body.type,
  });
  console.log(`✅ Manual account added: "${label}" (${holdings.length} holdings)`);
  res.json(store.getAccount(id));
});

// ---- SnapTrade Personal (read-only) ----

app.get('/api/snaptrade/status', async (_req: Request, res: Response) => {
  const configured = isSnaptradeConfigured();
  if (!configured) {
    return res.json({
      configured: false,
      accountCount: 0,
      connectionCount: 0,
      disabledConnectionCount: 0,
      retrievedAt: new Date().toISOString(),
    });
  }
  try {
    const [accountsSettled, connectionsSettled] = await Promise.allSettled([
      fetchSnapAccounts(),
      fetchSnapConnections(),
    ]);
    const accounts =
      accountsSettled.status === 'fulfilled' ? accountsSettled.value : [];
    const connections =
      connectionsSettled.status === 'fulfilled' ? connectionsSettled.value : [];
    const errors: string[] = [];
    if (accountsSettled.status === 'rejected') {
      errors.push(`accounts: ${errorMessage(accountsSettled.reason)}`);
    }
    if (connectionsSettled.status === 'rejected') {
      errors.push(`connections: ${errorMessage(connectionsSettled.reason)}`);
    }
    res.json({
      configured: true,
      accountCount: accounts.length,
      connectionCount: connections.length,
      disabledConnectionCount: connections.filter((c) => c.disabled).length,
      errors: errors.length ? errors : undefined,
      retrievedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({
      configured: true,
      error: 'SnapTrade status failed',
      message: errorMessage(err),
    });
  }
});

app.get('/api/snaptrade/accounts', async (_req: Request, res: Response) => {
  if (!isSnaptradeConfigured()) return snaptradeUnavailable(res);
  try {
    const accounts = await fetchSnapAccounts();
    res.json({
      accounts,
      retrievedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({
      error: 'Failed to list SnapTrade accounts',
      message: errorMessage(err),
    });
  }
});

app.get(
  '/api/snaptrade/accounts/:externalId',
  async (req: Request, res: Response) => {
    if (!isSnaptradeConfigured()) return snaptradeUnavailable(res);
    const { externalId } = req.params;
    if (!externalId) {
      return res.status(400).json({ error: 'externalId is required' });
    }
    try {
      const detail = await fetchSnapAccountDetail(externalId);
      const status =
        detail.account ||
        detail.balances.data.length > 0 ||
        detail.positions.data.length > 0
          ? 200
          : detail.errors.length
            ? 502
            : 200;
      res.status(status).json(detail);
    } catch (err) {
      res.status(502).json({
        error: 'Failed to load SnapTrade account',
        message: errorMessage(err),
      });
    }
  },
);

app.get(
  '/api/snaptrade/accounts/:externalId/orders',
  async (req: Request, res: Response) => {
    if (!isSnaptradeConfigured()) return snaptradeUnavailable(res);
    const { externalId } = req.params;
    try {
      const result = await fetchSnapOrders(externalId);
      res.json(result);
    } catch (err) {
      res.status(502).json({
        error: 'Failed to load recent orders',
        message: errorMessage(err),
        orders: [],
      });
    }
  },
);

app.get(
  '/api/snaptrade/accounts/:externalId/activities',
  async (req: Request, res: Response) => {
    if (!isSnaptradeConfigured()) return snaptradeUnavailable(res);
    const { externalId } = req.params;
    const startDate =
      typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate =
      typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
    const limitRaw =
      typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : NaN;
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 1000)
      : 100;
    try {
      const result = await fetchSnapActivities(externalId, {
        startDate,
        endDate,
        limit,
      });
      res.json(result);
    } catch (err) {
      res.status(502).json({
        error: 'Failed to load activities',
        message: errorMessage(err),
        activities: [],
      });
    }
  },
);

app.get('/api/snaptrade/connections', async (_req: Request, res: Response) => {
  if (!isSnaptradeConfigured()) return snaptradeUnavailable(res);
  try {
    const connections = await fetchSnapConnections();
    res.json({
      connections,
      retrievedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({
      error: 'Failed to list connections',
      message: errorMessage(err),
    });
  }
});

/** Start SnapTrade Connection Portal (needs API keys). */
app.post('/api/accounts/snaptrade/connect', async (req: Request, res: Response) => {
  if (!snaptrade.isConfigured()) return snaptradeUnavailable(res);
  const result = await snaptrade.startConnect(req.body || {});
  if (!result.redirectUrl) {
    return res.status(502).json({
      error: 'Could not start SnapTrade connection',
      message: result.message,
    });
  }
  res.json(result);
});

/** Import brokerage accounts already linked under the Personal API key. */
app.post('/api/accounts/snaptrade/import', async (_req: Request, res: Response) => {
  if (!snaptrade.isConfigured()) return snaptradeUnavailable(res);
  try {
    const remote = await snaptrade.listRemoteAccounts();
    if (remote.length === 0) {
      return res.json({
        imported: [],
        message:
          'No SnapTrade accounts found. Open Connect to link a brokerage in the SnapTrade portal first.',
      });
    }
    const imported = remote.map((r) => {
      const id = store.upsertSnaptradeAccount(r);
      return store.getAccount(id);
    });
    console.log(`✅ Imported ${imported.length} SnapTrade account(s)`);
    res.json({ imported, message: `Imported ${imported.length} account(s).` });
  } catch (err) {
    res.status(502).json({
      error: 'SnapTrade import failed',
      message: errorMessage(err),
    });
  }
});

app.patch('/api/accounts/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body as {
    label?: string;
    institution?: string;
    holdings?: Holding[];
  };

  if (body.holdings !== undefined && !Array.isArray(body.holdings)) {
    return res.status(400).json({ error: 'holdings must be an array' });
  }

  const ok = store.updateAccount(id, {
    label: body.label,
    institution: body.institution,
    holdings: body.holdings,
  });
  if (!ok) return res.status(404).json({ error: 'Account not found' });
  res.json(store.getAccount(id, hasLiveAdapter(id)));
});

app.post('/api/accounts/:id/sync', async (req: Request, res: Response) => {
  const { id } = req.params;
  const account = store.getAccount(id, hasLiveAdapter(id));
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const provider = getProvider(account.provider);
  const result = await provider.sync(account);

  const failed = Boolean(result.error && result.balances.length === 0);
  store.updateAccount(id, {
    status: failed ? 'error' : 'connected',
    lastSyncedAt: new Date().toISOString(),
    lastError: result.error ?? null,
  });

  res.json({
    account: store.getAccount(id, hasLiveAdapter(id)),
    totalValueUsd: result.totalValueUsd,
    balanceCount: result.balances.length,
    positionCount: result.positions.length,
    error: result.error,
  });
});

app.delete('/api/accounts/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const ok = store.removeAccount(id);
  if (!ok) return res.status(404).json({ error: 'Account not found' });
  removeLiveAdapter(id);
  console.log(`🗑️  Account ${id} removed.`);
  res.json({ success: true });
});

// ---- wallet status (compat) ----

app.get('/api/wallet/status', (_req: Request, res: Response) => {
  const accounts = store.getAccounts(liveIds());
  res.json({
    initialized: accounts.length > 0,
    accountCount: accounts.length,
  });
});

// ---- portfolio aggregate ----

app.get('/api/portfolio', async (_req: Request, res: Response) => {
  try {
    const accounts = store.getAccounts(liveIds());
    if (accounts.length === 0) {
      return res.status(503).json({
        error: 'No accounts configured. Connect a wallet, broker, or manual account.',
      });
    }

    console.log('📊 Aggregating portfolio across', accounts.length, 'account(s)...');

    let allBalances = [] as PortfolioSummary['assets'];
    let allPositions = [] as PortfolioSummary['positions'];
    let pnl24h = 0;
    let pnl7d = 0;
    let pnl30d = 0;
    let weightSum = 0;
    const sources: PortfolioSource[] = [];

    const settled = await Promise.allSettled(
      accounts.map(async (acct) => {
        const provider = getProvider(acct.provider);
        const result = await provider.sync(acct);
        return { acct, result };
      }),
    );

    for (const item of settled) {
      if (item.status === 'rejected') {
        sources.push({
          accountId: 'unknown',
          label: 'Unknown',
          provider: 'unknown',
          type: 'unknown',
          valueUsd: 0,
          status: 'error',
          error: errorMessage(item.reason),
        });
        continue;
      }
      const { acct, result } = item.value;
      // Partial sync still returns data + error — mark error only when empty
      const failed = Boolean(result.error && result.balances.length === 0);
      store.updateAccount(acct.id, {
        status: failed ? 'error' : 'connected',
        lastSyncedAt: new Date().toISOString(),
        lastError: result.error ?? null,
      });

      sources.push({
        accountId: acct.id,
        label: acct.label,
        provider: acct.provider,
        type: acct.type,
        valueUsd: result.totalValueUsd,
        status: failed ? 'error' : result.error ? 'partial' : 'connected',
        error: result.error,
      });

      allBalances = allBalances.concat(result.balances);
      allPositions = allPositions.concat(result.positions);

      const w = Math.max(result.totalValueUsd, 0);
      if (result.pnl && w > 0) {
        pnl24h += result.pnl.pnl24h * w;
        pnl7d += result.pnl.pnl7d * w;
        pnl30d += result.pnl.pnl30d * w;
        weightSum += w;
      }
    }

    const totalValue = allBalances.reduce(
      (sum, b) => sum + parseFloat(b.usdValue || '0'),
      0,
    );
    const avgPct = (weighted: number) =>
      weightSum > 0 ? (weighted / weightSum).toFixed(2) : '0';

    const portfolio: PortfolioSummary = {
      totalValue: totalValue.toString(),
      pnl24h: avgPct(pnl24h),
      pnl7d: avgPct(pnl7d),
      pnl30d: avgPct(pnl30d),
      assets: allBalances,
      positions: allPositions,
      sources,
      lastUpdated: new Date().toISOString(),
    };

    console.log(`✅ Portfolio: $${totalValue.toFixed(2)} across ${sources.length} source(s)`);
    res.json(portfolio);
  } catch (error) {
    console.error('❌ Error fetching portfolio:', error);
    res.status(500).json({
      error: 'Failed to fetch portfolio data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ---- analytics + market data (read-only) ----

app.use('/api/analytics', createAnalyticsRouter(store));
app.use('/api/market', createMarketRouter(store));

// ---- Static client (production single-service deploy) ----

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

const INDEX_HTML = path.join(CLIENT_DIST, 'index.html');

if (fs.existsSync(INDEX_HTML)) {
  const sendShell = (_req: Request, res: Response) => res.sendFile(INDEX_HTML);
  // `index: false` only stops express.static from resolving "/" to index.html —
  // the explicit path still slips through, so gate it before static runs.
  app.get('/index.html', requirePageAuth, sendShell);
  // Hashed bundles hold no portfolio data; the shell itself stays gated.
  app.use(express.static(CLIENT_DIST, { index: false }));
  app.get('*', requirePageAuth, sendShell);
}

// ---- Start ----

rehydrateAccounts();
startHistoryScheduler(store);

app.listen(PORT, HOST, () => {
  const providers = listProviders();
  console.log('🚀 Meridian API Server');
  console.log(`📡 http://localhost:${PORT}`);
  console.log('🔗 Endpoints:');
  console.log('   GET    /api/health');
  console.log('   GET    /api/providers');
  console.log('   GET    /api/accounts');
  console.log('   POST   /api/accounts                 { label, mnemonic }');
  console.log('   POST   /api/accounts/manual          { label, holdings? }');
  console.log('   POST   /api/accounts/snaptrade/connect');
  console.log('   POST   /api/accounts/snaptrade/import');
  console.log('   GET    /api/snaptrade/status');
  console.log('   GET    /api/snaptrade/accounts');
  console.log('   GET    /api/snaptrade/accounts/:externalId');
  console.log('   GET    /api/snaptrade/accounts/:externalId/orders');
  console.log('   GET    /api/snaptrade/accounts/:externalId/activities');
  console.log('   GET    /api/snaptrade/connections');
  console.log('   POST   /api/accounts/:id/sync');
  console.log('   PATCH  /api/accounts/:id');
  console.log('   DELETE /api/accounts/:id');
  console.log('   GET    /api/portfolio');
  console.log('   GET    /api/analytics/overview');
  console.log('   GET    /api/analytics/allocation?by=assetClass|sector|region|currency|account|institution|symbol');
  console.log('   GET    /api/analytics/concentration');
  console.log('   GET    /api/analytics/holdings');
  console.log('   GET    /api/analytics/income?months=12');
  console.log('   GET    /api/analytics/flows?months=12');
  console.log('   GET    /api/analytics/history?range=1m|3m|6m|1y|all');
  console.log('   GET    /api/analytics/benchmark?range=1y&symbol=SPY');
  console.log('   GET    /api/market/movers');
  console.log('   GET    /api/market/news?limit=20&symbol=');
  console.log('   GET    /api/market/history/:symbol?range=1m|3m|6m|1y|5y');
  console.log('   GET    /api/market/quote/:symbol');
  console.log('');
  for (const p of providers) {
    console.log(
      `   Provider ${p.id}: ${p.configured ? 'ready' : 'needs API keys'} — ${p.coverage}`,
    );
  }
  console.log('');
  const mode = authMode();
  if (mode === 'enforced') {
    console.log('🔒 Access gate: ON — password required at /login');
  } else if (mode === 'disabled') {
    console.log('🔓 Access gate: OFF (no APP_PASSWORD, non-production)');
  } else {
    console.log(
      '🚨 Access gate: MISCONFIGURED — NODE_ENV=production with no APP_PASSWORD. Serving 503 until it is set.',
    );
  }
  console.log('');
});
