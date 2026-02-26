import prisma from '../db/client.js';
import CryptoJS from 'crypto-js';
import { IAdapter } from '../adapters/base.adapter.js';
import { HyperliquidAdapter } from '../adapters/hyperliquid.adapter.js';
import { BinanceAdapter } from '../adapters/binance.adapter.js';
import { BybitAdapter } from '../adapters/bybit.adapter.js';
import { BitgetAdapter } from '../adapters/bitget.adapter.js';
import { CoinbaseAdapter } from '../adapters/coinbase.adapter.js';
import { KrakenAdapter } from '../adapters/kraken.adapter.js';
import { OKXAdapter } from '../adapters/okx.adapter.js';
import { GateAdapter } from '../adapters/gate.adapter.js';
import { PolymarketAdapter } from '../adapters/polymarket.adapter.js';
import { KalshiAdapter } from '../adapters/kalshi.adapter.js';
import { AsterAdapter } from '../adapters/aster.adapter.js';
import { IBKRAdapter } from '../adapters/ibkr.adapter.js';
import { SchwabAdapter } from '../adapters/schwab.adapter.js';
import { SwissquoteAdapter } from '../adapters/swissquote.adapter.js';
import { SixBlinkAdapter } from '../adapters/six-blink.adapter.js';
import { Balance, Position, TxRecord, UnifiedPortfolio } from '../types/common.js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'finvault-default-key-32-chars!!';

export function encryptCredentials(data: Record<string, string>): string {
  return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
}

export function decryptCredentials(encrypted: string): Record<string, string> {
  const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

function buildAdapter(platform: string, creds: Record<string, string>): IAdapter | null {
  switch (platform) {
    case 'hyperliquid':
      return new HyperliquidAdapter({ mnemonic: creds.mnemonic, privateKey: creds.privateKey, address: creds.address });
    case 'binance':
      return new BinanceAdapter(creds.apiKey, creds.apiSecret);
    case 'bybit':
      return new BybitAdapter(creds.apiKey, creds.apiSecret);
    case 'bitget':
      return new BitgetAdapter(creds.apiKey, creds.apiSecret, creds.passphrase);
    case 'coinbase':
      return new CoinbaseAdapter(creds.apiKey, creds.apiSecret);
    case 'kraken':
      return new KrakenAdapter(creds.apiKey, creds.privateKey);
    case 'okx':
      return new OKXAdapter(creds.apiKey, creds.apiSecret, creds.passphrase);
    case 'gate':
      return new GateAdapter(creds.apiKey, creds.apiSecret);
    case 'polymarket':
      return new PolymarketAdapter(creds.privateKey);
    case 'kalshi':
      return new KalshiAdapter(creds.apiKey, creds.email, creds.password);
    case 'aster':
      return new AsterAdapter({ mnemonic: creds.mnemonic, privateKey: creds.privateKey, address: creds.address });
    case 'ibkr':
      return new IBKRAdapter(creds.gatewayUrl);
    case 'schwab':
      return new SchwabAdapter(creds.clientId, creds.clientSecret, creds.refreshToken);
    case 'swissquote':
      return new SwissquoteAdapter(creds.clientId, creds.clientSecret, creds.refreshToken);
    case 'six-blink':
      return new SixBlinkAdapter(creds.endpoint, creds.certPath, creds.certPassword, creds.clientId, creds.clientSecret);
    default:
      return null;
  }
}

export async function getAdaptersFromDB(): Promise<IAdapter[]> {
  const accounts = await prisma.account.findMany({ where: { isActive: true } });
  const adapters: IAdapter[] = [];
  for (const acc of accounts) {
    try {
      const creds = decryptCredentials(acc.credentialsJson);
      const adapter = buildAdapter(acc.platform, creds);
      if (adapter && adapter.isConfigured()) adapters.push(adapter);
    } catch {
      console.warn(`Could not load adapter for account ${acc.name} (${acc.platform})`);
    }
  }

  // Also load env-based defaults if no DB accounts exist
  if (adapters.length === 0) {
    if (process.env.MNEMONIC) {
      adapters.push(new HyperliquidAdapter({ mnemonic: process.env.MNEMONIC }));
      adapters.push(new AsterAdapter({ mnemonic: process.env.MNEMONIC }));
    }
    if (process.env.POLYMARKET_PRIVATE_KEY) {
      adapters.push(new PolymarketAdapter(process.env.POLYMARKET_PRIVATE_KEY));
    }
    if (process.env.KALSHI_API_KEY) {
      adapters.push(new KalshiAdapter(process.env.KALSHI_API_KEY));
    }
    if (process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET) {
      adapters.push(new BinanceAdapter(process.env.BINANCE_API_KEY, process.env.BINANCE_API_SECRET));
    }
    if (process.env.SCHWAB_CLIENT_ID) {
      adapters.push(new SchwabAdapter(process.env.SCHWAB_CLIENT_ID, process.env.SCHWAB_CLIENT_SECRET!, process.env.SCHWAB_REFRESH_TOKEN!));
    }
    if (process.env.IBKR_GATEWAY_URL) {
      adapters.push(new IBKRAdapter(process.env.IBKR_GATEWAY_URL));
    }
  }

  return adapters;
}

export async function fetchUnifiedPortfolio(): Promise<UnifiedPortfolio> {
  const adapters = await getAdaptersFromDB();

  const results = await Promise.allSettled(
    adapters.flatMap(a => [a.getBalances(), a.getPositions()])
  );

  const allBalances: Balance[] = [];
  const allPositions: Position[] = [];

  for (let i = 0; i < results.length; i += 2) {
    const balResult = results[i];
    const posResult = results[i + 1];
    if (balResult.status === 'fulfilled') allBalances.push(...balResult.value);
    if (posResult.status === 'fulfilled') allPositions.push(...posResult.value);
  }

  const cryptoPlatforms = new Set(['hyperliquid', 'binance', 'bybit', 'bitget', 'coinbase', 'kraken', 'okx', 'gate']);
  const tradFiPlatforms = new Set(['ibkr', 'schwab', 'swissquote']);
  const bankPlatforms = new Set(['six-blink']);
  const predictionPlatforms = new Set(['polymarket', 'kalshi']);
  const defiPlatforms = new Set(['aster']);

  let crypto = 0, tradfi = 0, cash = 0, predictions = 0, defi = 0;

  for (const b of allBalances) {
    const v = parseFloat(b.usdValue ?? '0');
    const p = b.platform ?? '';
    if (cryptoPlatforms.has(p)) crypto += v;
    else if (tradFiPlatforms.has(p)) tradfi += v;
    else if (bankPlatforms.has(p)) cash += v;
    else if (predictionPlatforms.has(p)) predictions += v;
    else if (defiPlatforms.has(p)) defi += v;
    else crypto += v; // default bucket
  }

  const totalValue = crypto + tradfi + cash + predictions + defi;

  // Save snapshot
  try {
    await prisma.portfolioSnapshot.create({
      data: {
        date: new Date(),
        totalValue,
        breakdownJson: JSON.stringify({ crypto, tradfi, cash, predictions, defi }),
      },
    });
  } catch { /* snapshot failure should not break the response */ }

  // Calculate PnL from snapshots
  const yesterday = await prisma.portfolioSnapshot.findFirst({
    where: { date: { gte: new Date(Date.now() - 26 * 3600 * 1000) } },
    orderBy: { date: 'asc' },
  });
  const pnl24h = yesterday ? totalValue - yesterday.totalValue : 0;
  const pnl24hPercent = yesterday && yesterday.totalValue > 0
    ? (pnl24h / yesterday.totalValue) * 100
    : 0;

  return {
    totalValue,
    breakdown: { crypto, tradfi, cash, predictions, defi },
    balances: allBalances,
    positions: allPositions,
    pnl24h,
    pnl24hPercent,
    lastUpdated: new Date().toISOString(),
  };
}

export async function addAccount(
  name: string,
  type: string,
  platform: string,
  credentials: Record<string, string>
): Promise<void> {
  const encrypted = encryptCredentials(credentials);
  await prisma.account.create({
    data: { name, type, platform, credentialsJson: encrypted },
  });
}

export async function updateAccount(
  id: string,
  updates: { name?: string; isActive?: boolean; credentials?: Record<string, string> }
): Promise<void> {
  const data: any = {};
  if (updates.name) data.name = updates.name;
  if (updates.isActive !== undefined) data.isActive = updates.isActive;
  if (updates.credentials) data.credentialsJson = encryptCredentials(updates.credentials);
  await prisma.account.update({ where: { id }, data });
}

export async function deleteAccount(id: string): Promise<void> {
  await prisma.account.delete({ where: { id } });
}

export async function getAccounts() {
  const accounts = await prisma.account.findMany({ orderBy: { createdAt: 'asc' } });
  return accounts.map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    platform: a.platform,
    isActive: a.isActive,
    lastSynced: a.lastSynced,
    createdAt: a.createdAt,
  }));
}

export async function getPortfolioHistory(days = 30) {
  const from = new Date(Date.now() - days * 24 * 3600 * 1000);
  return prisma.portfolioSnapshot.findMany({
    where: { date: { gte: from } },
    orderBy: { date: 'asc' },
    select: { date: true, totalValue: true, breakdownJson: true },
  });
}
