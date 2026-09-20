import fs from 'fs';
import path from 'path';
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createAuth, currentUser, describeSignupMode } from './auth';
import { WalletCore } from './wallet-core';
import { PortfolioSummary, PortfolioSource } from './types/common';
import { Holding, isLiabilityAccount } from './types/accounts';
import type { Store } from './store';
import {
  bootHyperliquidAccount,
  getProvider,
  gocardless,
  hasLiveAdapter,
  listProviders,
  rehydrateHyperliquidAccounts,
  removeLiveAdapter,
  snaptrade,
  watch,
} from './providers';
import type { SyncResult } from './providers';
import { CHAIN_NAMES, describeWatchKey, detectWatchKey } from './wallets';
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
  invalidatePortfolioSnapshot,
  startHistoryScheduler,
} from './analytics';
import { createMoneyRouter } from './money';
import { createGoalsRouter } from './goals';
import { createGocardlessConnectRouter, importGocardlessTransactions } from './aggregators';
import {
  createBillingRouter,
  createBillingWebhook,
  describeBilling,
  requireLiveConnectionSlot,
} from './billing';
import { createCatalogRouter } from './catalog';
import { FxConverter } from './market/fx';
import { DISPLAY_CURRENCIES, HEADLINE_METRICS } from './settings';
import { rootDataDir } from './dataDir';
import { hasLegacyData } from './users/legacy';
import { isSessionConfigured } from './users/session';
import { getTenant, tenantFor } from './users/tenant';
import type { Tenant } from './users/tenant';
import { UserStore, toPublicUser } from './users/users';

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

// One user list for the process: auth, the scheduler and sign-up all share it,
// so a user created after boot is visible everywhere without a restart.
const users = new UserStore(rootDataDir());
const auth = createAuth(users);

// Stripe signs the exact bytes it sends, so the webhook must see the raw body
// and sit ahead of the JSON parser. It is public by design and verifies the
// signature itself.
app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  createBillingWebhook(users),
);

// Statement imports post a whole CSV as text; the default 100 kB would
// reject a yearly export before the handler could explain why.
app.use(express.json({ limit: '2mb' }));

/** Records a sync's outcome on the account so the UI can show freshness and errors. */
function finishSync(tenant: Tenant, id: string, result: SyncResult): void {
  const failed = Boolean(result.error && result.balances.length === 0);
  tenant.store.updateAccount(id, {
    status: failed ? 'error' : 'connected',
    lastSyncedAt: new Date().toISOString(),
    lastError: result.error ?? null,
  });
  invalidatePortfolioSnapshot(tenant.userId);
}

function liveIds(store: Store): Set<string> {
  const ids = new Set<string>();
  for (const a of store.getAllRaw()) {
    if (a.provider === 'hyperliquid' && hasLiveAdapter(a.id)) ids.add(a.id);
  }
  return ids;
}

/** Boots every user's Hyperliquid wallets so the first request after a restart is live. */
function rehydrateAllUsers() {
  const list = users.list();
  if (list.length === 0) {
    console.log('ℹ️  No users yet. Create the first account at /signup.');
    if (hasLegacyData(rootDataDir())) {
      console.log('📦 Legacy single-user data found in DATA_DIR; the first sign-up will adopt it.');
    }
    return;
  }
  let booted = 0;
  let other = 0;
  for (const user of list) {
    const { store } = getTenant(user.id);
    const accounts = store.getAllRaw();
    if (accounts.length === 0) continue;
    console.log(`👤 ${user.email}`);
    booted += rehydrateHyperliquidAccounts(store).booted;
    other += accounts.filter((a) => a.provider !== 'hyperliquid').length;
  }
  console.log(
    `📂 ${list.length} user(s) · ${booted} crypto wallet(s) live · ${other} other account(s) on disk.\n`,
  );
}

// ------------- Routes ---------------

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- auth (public): session, signup, login, logout ----

app.use('/api/auth', auth.publicRoutes);

// Everything below this line requires a valid session.
app.use('/api', auth.requireApiAuth);

// ---- account (gated): me, password, delete ----

app.use('/api/auth', auth.accountRoutes);

app.get('/api/providers', (_req: Request, res: Response) => {
  res.json({ providers: listProviders() });
});

// ---- plans, catalogue, bank links ----

app.use('/api/billing', createBillingRouter(users));
app.use('/api/catalog', createCatalogRouter());
app.use('/api/connect/gocardless', createGocardlessConnectRouter());

// ---- export ----

/** Everything the user owns, as one JSON download. Never includes secrets. */
app.get('/api/export', (req: Request, res: Response) => {
  const tenant = tenantFor(req);
  res.setHeader('Content-Disposition', 'attachment; filename="wealth-hub-export.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    user: toPublicUser(currentUser(req)),
    accounts: tenant.store.getAccounts(liveIds(tenant.store)),
    settings: tenant.settings.get(),
    transactions: tenant.money.listTransactions(),
    subscriptions: tenant.money.listSubscriptions(),
    budgets: tenant.money.getBudgets(),
    goals: tenant.goals.list(),
    history: tenant.history.load().days,
  });
});

// ---- preferences ----

/**
 * Settings plus the FX rates the client needs to show account balances
 * (stored in USD) in the display currency. `rates[X]` is how many units of
 * the display currency one unit of X buys; a missing key means no rate.
 */
app.get('/api/settings', async (req: Request, res: Response) => {
  const settings = tenantFor(req).settings.get();
  const fx = await FxConverter.load(settings.displayCurrency, [...DISPLAY_CURRENCIES]);
  res.json({
    ...settings,
    currencies: DISPLAY_CURRENCIES,
    metrics: HEADLINE_METRICS,
    rates: fx.ratesUsed(),
    warnings: fx.warnings,
  });
});

app.put('/api/settings', (req: Request, res: Response) => {
  const tenant = tenantFor(req);
  try {
    const next = tenant.settings.update(req.body || {});
    invalidatePortfolioSnapshot(tenant.userId);
    res.json(next);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid settings' });
  }
});

// ---- accounts ----

app.get('/api/accounts', (req: Request, res: Response) => {
  const { store } = tenantFor(req);
  res.json({ accounts: store.getAccounts(liveIds(store)) });
});

/** Legacy + crypto: POST { label, mnemonic } */
app.post('/api/accounts', (req: Request, res: Response) => {
  const tenant = tenantFor(req);
  const { label, mnemonic } = req.body as { label?: string; mnemonic?: string };
  if (!mnemonic || typeof mnemonic !== 'string') {
    return res.status(400).json({
      error: 'mnemonic is required (or use /api/accounts/manual / snaptrade)',
    });
  }
  const trimmed = mnemonic.trim();
  const accountLabel = (label || '').trim() || 'Hyperliquid';
  if (requireLiveConnectionSlot(req, res)) return;

  try {
    const wc = new WalletCore();
    wc.setMnemonic(trimmed);
    const address = wc.getAddress(0, 1337);
    const id = tenant.store.addCryptoWallet(accountLabel, trimmed, address);
    const { ok } = bootHyperliquidAccount(id, trimmed);
    if (!ok) {
      tenant.store.removeAccount(id);
      return res.status(400).json({ error: 'Failed to initialize wallet' });
    }
    invalidatePortfolioSnapshot(tenant.userId);
    console.log(`✅ Crypto account added: "${accountLabel}" → ${address}`);
    res.json(tenant.store.getAccount(id, true));
  } catch (err) {
    console.error('❌ Invalid mnemonic:', err);
    res.status(400).json({ error: 'Invalid mnemonic phrase' });
  }
});

app.post('/api/accounts/manual', (req: Request, res: Response) => {
  const tenant = tenantFor(req);
  const body = req.body as {
    label?: string;
    institution?: string;
    currency?: string;
    type?: 'manual' | 'broker' | 'bank' | 'loan' | 'pension' | 'estate';
    kind?: 'asset' | 'liability';
    bookClass?: 'estate' | 'pension' | 'stocks' | 'cash' | 'bonds' | 'crypto' | 'other';
    notes?: string;
    balance?: number;
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

  const id = tenant.store.addManualAccount(label, {
    institution: body.institution?.trim(),
    currency: body.currency,
    holdings,
    type: body.type,
    kind: body.kind,
    bookClass: body.bookClass,
    notes: body.notes,
    balance: body.balance,
  });
  invalidatePortfolioSnapshot(tenant.userId);
  console.log(`✅ Manual account added: "${label}" (${holdings.length} holdings)`);
  res.json(tenant.store.getAccount(id));
});

/**
 * Watch-only wallet: POST { label?, key, institution? } where key is a
 * Bitcoin account key (xpub / ypub / zpub) or a BTC / ETH / SOL address.
 * The first read runs inline for a few seconds so the row lands with a
 * figure; a slow chain finishes in the background.
 */
app.post('/api/accounts/watch', async (req: Request, res: Response) => {
  const tenant = tenantFor(req);
  const { store } = tenant;
  const body = req.body as { label?: string; key?: string; institution?: string };
  const key = detectWatchKey(String(body.key || ''));
  if (!key) {
    return res.status(400).json({
      error:
        'Paste a Bitcoin account key (xpub, ypub, or zpub) or a Bitcoin, Ethereum, or Solana address.',
    });
  }
  const duplicate = store
    .getAllRaw()
    .find(
      (a) =>
        a.provider === 'watch' &&
        (a.externalId || '').toLowerCase() === key.key.toLowerCase(),
    );
  if (duplicate) {
    return res.status(409).json({ error: `Already tracked as "${duplicate.label}"` });
  }
  if (requireLiveConnectionSlot(req, res)) return;

  const label =
    (body.label || '').trim() ||
    `${CHAIN_NAMES[key.chain]} · ${key.kind === 'xpub' ? 'Ledger' : 'Watch-only'}`;
  const id = store.addWatchWallet(label, {
    key: key.key,
    chain: key.chain,
    kind: key.kind,
    institution: body.institution?.trim() || undefined,
    notes: describeWatchKey(key),
  });

  const syncing = watch.sync(store.getAccount(id)!, { store }).then(
    (result) => {
      finishSync(tenant, id, result);
      return result;
    },
    (err: unknown) => {
      finishSync(tenant, id, {
        balances: [],
        positions: [],
        totalValueUsd: 0,
        error: errorMessage(err),
      });
      return null;
    },
  );
  const timer = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), 12_000).unref();
  });
  await Promise.race([syncing, timer]);

  invalidatePortfolioSnapshot(tenant.userId);
  console.log(`✅ Watch-only wallet added: "${label}" (${describeWatchKey(key)})`);
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
app.post('/api/accounts/snaptrade/import', async (req: Request, res: Response) => {
  if (!snaptrade.isConfigured()) return snaptradeUnavailable(res);
  const tenant = tenantFor(req);
  if (requireLiveConnectionSlot(req, res)) return;
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
      const id = tenant.store.upsertSnaptradeAccount(r);
      return tenant.store.getAccount(id);
    });
    invalidatePortfolioSnapshot(tenant.userId);
    console.log(`✅ Imported ${imported.length} SnapTrade account(s)`);
    res.json({ imported, message: `Imported ${imported.length} account(s).` });
  } catch (err) {
    res.status(502).json({
      error: 'SnapTrade import failed',
      message: errorMessage(err),
    });
  }
});

/** Bank feed → money ledger: POST { days? } for a GoCardless account. */
app.post('/api/accounts/:id/transactions/import', importGocardlessTransactions);

app.patch('/api/accounts/:id', (req: Request, res: Response) => {
  const tenant = tenantFor(req);
  const { id } = req.params;
  const body = req.body as {
    label?: string;
    institution?: string;
    holdings?: Holding[];
  };

  if (body.holdings !== undefined && !Array.isArray(body.holdings)) {
    return res.status(400).json({ error: 'holdings must be an array' });
  }

  const ok = tenant.store.updateAccount(id, {
    label: body.label,
    institution: body.institution,
    holdings: body.holdings,
  });
  if (!ok) return res.status(404).json({ error: 'Account not found' });
  invalidatePortfolioSnapshot(tenant.userId);
  res.json(tenant.store.getAccount(id, hasLiveAdapter(id)));
});

app.post('/api/accounts/:id/sync', async (req: Request, res: Response) => {
  const tenant = tenantFor(req);
  const { store } = tenant;
  const { id } = req.params;
  const account = store.getAccount(id, hasLiveAdapter(id));
  if (!account) return res.status(404).json({ error: 'Account not found' });

  // An explicit sync should hit the chain or the bank, not the provider's read cache.
  if (account.provider === 'watch') watch.forget(id);
  if (account.provider === 'gocardless') gocardless.forget(id);
  const provider = getProvider(account.provider);
  const result = await provider.sync(account, { store });
  finishSync(tenant, id, result);

  res.json({
    account: store.getAccount(id, hasLiveAdapter(id)),
    totalValueUsd: result.totalValueUsd,
    balanceCount: result.balances.length,
    positionCount: result.positions.length,
    error: result.error,
  });
});

app.delete('/api/accounts/:id', (req: Request, res: Response) => {
  const tenant = tenantFor(req);
  const { id } = req.params;
  const ok = tenant.store.removeAccount(id);
  if (!ok) return res.status(404).json({ error: 'Account not found' });
  removeLiveAdapter(id);
  watch.forget(id);
  gocardless.forget(id);
  invalidatePortfolioSnapshot(tenant.userId);
  console.log(`🗑️  Account ${id} removed.`);
  res.json({ success: true });
});

// ---- wallet status (compat) ----

app.get('/api/wallet/status', (req: Request, res: Response) => {
  const { store } = tenantFor(req);
  const accounts = store.getAccounts(liveIds(store));
  res.json({
    initialized: accounts.length > 0,
    accountCount: accounts.length,
  });
});

// ---- portfolio aggregate ----

app.get('/api/portfolio', async (req: Request, res: Response) => {
  const tenant = tenantFor(req);
  const { store } = tenant;
  try {
    const accounts = store.getAccounts(liveIds(store));
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
      accounts
        .filter((acct) => !isLiabilityAccount(acct))
        .map(async (acct) => {
          const provider = getProvider(acct.provider);
          const result = await provider.sync(acct, { store });
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

app.use('/api/analytics', createAnalyticsRouter());
app.use('/api/market', createMarketRouter());
app.use('/api/money', createMoneyRouter());
app.use('/api/goals', createGoalsRouter());

// ---- Static client (production single-service deploy) ----

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

const INDEX_HTML = path.join(CLIENT_DIST, 'index.html');

if (fs.existsSync(INDEX_HTML)) {
  const sendShell = (_req: Request, res: Response) => res.sendFile(INDEX_HTML);
  // The shell is the same file for every page, so gating it only makes sense
  // for the app itself: the SPA renders the marketing site, /login and
  // /signup publicly and fetches nothing personal until a session exists.
  app.get(['/app', '/app/*'], auth.requireAppPage, sendShell);
  // Hashed bundles and the shell hold no portfolio data.
  app.use(express.static(CLIENT_DIST, { index: false }));
  app.get('*', sendShell);
}

// ---- Start ----

rehydrateAllUsers();
startHistoryScheduler(users);

app.listen(PORT, HOST, () => {
  const providers = listProviders();
  console.log('🚀 Wealth Hub API Server');
  console.log(`📡 http://localhost:${PORT}`);
  console.log('🔗 Endpoints:');
  console.log('   GET    /api/health');
  console.log('   GET    /api/auth/session');
  console.log('   POST   /api/auth/signup              { email, password, name?, inviteCode? }');
  console.log('   POST   /api/auth/login               { email, password }');
  console.log('   POST   /api/auth/logout');
  console.log('   GET    /api/auth/me');
  console.log('   PATCH  /api/auth/me                  { name?, onboarded? }');
  console.log('   POST   /api/auth/password            { currentPassword, newPassword }');
  console.log('   DELETE /api/auth/me                  { password }');
  console.log('   GET    /api/export');
  console.log('   GET    /api/providers');
  console.log('   GET    /api/settings');
  console.log('   PUT    /api/settings');
  console.log('   GET    /api/accounts');
  console.log('   POST   /api/accounts                 { label, mnemonic }');
  console.log('   POST   /api/accounts/manual          { label, holdings? }');
  console.log('   POST   /api/accounts/watch           { label?, key }');
  console.log('   POST   /api/accounts/snaptrade/connect');
  console.log('   POST   /api/accounts/snaptrade/import');
  console.log('   GET    /api/connect/gocardless/institutions?country=CH');
  console.log('   POST   /api/connect/gocardless/start   { institutionId, redirect? }');
  console.log('   POST   /api/connect/gocardless/finish  { reference }');
  console.log('   POST   /api/accounts/:id/transactions/import { days? }');
  console.log('   GET    /api/catalog?country=CH');
  console.log('   GET    /api/billing');
  console.log('   POST   /api/billing/checkout         { plan, interval }');
  console.log('   POST   /api/billing/portal');
  console.log('   POST   /api/billing/webhook          (Stripe, public)');
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
  console.log('   GET    /api/money/*  ·  /api/goals/*');
  console.log('');
  for (const p of providers) {
    console.log(
      `   Connector ${p.id}: ${p.configured ? 'ready' : 'needs API keys'} — ${p.coverage}`,
    );
  }
  console.log(`   Billing: ${describeBilling()}`);
  console.log('');
  if (isSessionConfigured()) {
    console.log('🔒 Access gate: ON — accounts at /login');
    console.log(`✍️  Sign-ups: ${describeSignupMode()}`);
  } else {
    console.log(
      '🚨 Access gate: MISCONFIGURED — NODE_ENV=production with neither SESSION_SECRET nor STORE_SECRET. Serving 503 until one is set.',
    );
  }
  console.log('');
});
