import type { Account } from 'snaptrade-typescript-sdk';
import type { PersonalSnaptrade } from './client';
import { getSnaptradeClient, isSnaptradeConfigured } from './client';
import {
  errorMessage,
  extractPositionsPayload,
  normalizeAccount,
  normalizeActivities,
  normalizeBalances,
  normalizeConnections,
  normalizeOrders,
} from './normalize';
import type {
  SnapAccountDetailVM,
  SnapAccountVM,
  SnapActivityVM,
  SnapConnectionVM,
  SnapOrderVM,
} from './types';

function requireClient(): PersonalSnaptrade {
  const client = getSnaptradeClient();
  if (!client) {
    throw new Error(
      'SnapTrade not configured. Set SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY in .env',
    );
  }
  return client;
}

export async function fetchSnapAccounts(): Promise<SnapAccountVM[]> {
  const client = requireClient();
  const res = await client.accountInformation.listUserAccounts();
  const accounts: Account[] = Array.isArray(res.data) ? res.data : [];
  console.log(`📡 SnapTrade: listed ${accounts.length} account(s)`);
  return accounts.filter((a: Account) => Boolean(a?.id)).map(normalizeAccount);
}

export async function fetchSnapConnections(): Promise<SnapConnectionVM[]> {
  const client = requireClient();
  const res = await client.connections.listBrokerageAuthorizations();
  const rows = Array.isArray(res.data) ? res.data : [];
  console.log(`📡 SnapTrade: listed ${rows.length} connection(s)`);
  return normalizeConnections(rows);
}

export async function fetchSnapAccountDetail(
  accountId: string,
): Promise<SnapAccountDetailVM> {
  const client = requireClient();
  const retrievedAt = new Date().toISOString();
  const errors: string[] = [];

  const [detailsSettled, balancesSettled, positionsSettled] =
    await Promise.allSettled([
      client.accountInformation.getUserAccountDetails({ accountId }),
      client.accountInformation.getUserAccountBalance({ accountId }),
      client.accountInformation.getAllAccountPositions({ accountId }),
    ]);

  let account: SnapAccountVM | null = null;
  if (detailsSettled.status === 'fulfilled') {
    account = normalizeAccount(detailsSettled.value.data);
  } else {
    errors.push(`details: ${errorMessage(detailsSettled.reason)}`);
  }

  let balancesData: ReturnType<typeof normalizeBalances> = [];
  let balancesError: string | undefined;
  if (balancesSettled.status === 'fulfilled') {
    balancesData = normalizeBalances(balancesSettled.value.data);
  } else {
    balancesError = errorMessage(balancesSettled.reason);
    errors.push(`balances: ${balancesError}`);
  }

  let positionsData: ReturnType<typeof extractPositionsPayload> = [];
  let positionsError: string | undefined;
  if (positionsSettled.status === 'fulfilled') {
    positionsData = extractPositionsPayload(positionsSettled.value.data);
  } else {
    positionsError = errorMessage(positionsSettled.reason);
    errors.push(`positions: ${positionsError}`);
  }

  if (errors.length) {
    console.warn(
      `⚠️  SnapTrade account ${accountId}: partial failure (${errors.length})`,
    );
  }

  return {
    account,
    balances: { data: balancesData, error: balancesError },
    positions: { data: positionsData, error: positionsError },
    retrievedAt,
    errors,
  };
}

export async function fetchSnapOrders(
  accountId: string,
): Promise<{ orders: SnapOrderVM[]; retrievedAt: string }> {
  const client = requireClient();
  const res = await client.accountInformation.getUserAccountRecentOrders({
    accountId,
    onlyExecuted: false,
  });
  return {
    orders: normalizeOrders(res.data),
    retrievedAt: new Date().toISOString(),
  };
}

export async function fetchSnapActivities(
  accountId: string,
  opts?: { startDate?: string; endDate?: string; limit?: number },
): Promise<{ activities: SnapActivityVM[]; retrievedAt: string }> {
  const client = requireClient();
  const end = opts?.endDate || new Date().toISOString().slice(0, 10);
  const start =
    opts?.startDate ||
    new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const limit = opts?.limit ?? 100;

  const res = await client.accountInformation.getAccountActivities({
    accountId,
    startDate: start,
    endDate: end,
    limit,
  });

  return {
    activities: normalizeActivities(res.data),
    retrievedAt: new Date().toISOString(),
  };
}

export async function startSnapConnectPortal(opts?: {
  broker?: string;
  customRedirect?: string;
}): Promise<{ redirectUrl?: string; message?: string }> {
  if (!isSnaptradeConfigured()) {
    return {
      message:
        'SnapTrade is not configured. Set SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY in .env (Personal plan at dashboard.snaptrade.com).',
    };
  }
  const client = getSnaptradeClient();
  if (!client) {
    return { message: 'SnapTrade SDK failed to initialize. Check server logs.' };
  }

  try {
    const body: {
      connectionType: 'read';
      broker?: string;
      customRedirect?: string;
    } = { connectionType: 'read' };
    if (opts?.broker) body.broker = opts.broker;
    if (opts?.customRedirect) body.customRedirect = opts.customRedirect;

    // Personal: no userId / userSecret
    const login = await client.authentication.loginSnapTradeUser(body);
    const data = login.data as { redirectURI?: string; redirectUri?: string };
    const redirectUrl = data?.redirectURI || data?.redirectUri;
    if (!redirectUrl) {
      return {
        message:
          'SnapTrade did not return a Connection Portal URL. Confirm your Personal API key.',
      };
    }
    return {
      redirectUrl,
      message:
        'Complete brokerage login in the SnapTrade portal, then return and import accounts.',
    };
  } catch (err) {
    return { message: `Could not start SnapTrade connect: ${errorMessage(err)}` };
  }
}

/** Balances + positions for provider sync (portfolio aggregation). */
export async function fetchBalancesAndPositions(accountId: string): Promise<{
  balances: ReturnType<typeof normalizeBalances>;
  positions: ReturnType<typeof extractPositionsPayload>;
  error?: string;
}> {
  const client = requireClient();
  const [balSettled, posSettled] = await Promise.allSettled([
    client.accountInformation.getUserAccountBalance({ accountId }),
    client.accountInformation.getAllAccountPositions({ accountId }),
  ]);

  const errors: string[] = [];
  let balances: ReturnType<typeof normalizeBalances> = [];
  let positions: ReturnType<typeof extractPositionsPayload> = [];

  if (balSettled.status === 'fulfilled') {
    balances = normalizeBalances(balSettled.value.data);
  } else {
    errors.push(`balances: ${errorMessage(balSettled.reason)}`);
  }

  if (posSettled.status === 'fulfilled') {
    positions = extractPositionsPayload(posSettled.value.data);
  } else {
    errors.push(`positions: ${errorMessage(posSettled.reason)}`);
  }

  return {
    balances,
    positions,
    error: errors.length ? errors.join('; ') : undefined,
  };
}
