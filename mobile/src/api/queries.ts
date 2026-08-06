import {
  useQueries,
  useQuery,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { apiRequest, ApiError } from './client';
import type {
  AccountsResponse,
  ActivitiesResponse,
  ConnectionsResponse,
  OrdersResponse,
  PortfolioSummary,
  PublicAccount,
  SnapAccountDetailVM,
  SnapStatus,
} from './types';

export const queryKeys = {
  portfolio: ['portfolio'] as const,
  accounts: ['accounts'] as const,
  snapStatus: ['snaptrade', 'status'] as const,
  connections: ['snaptrade', 'connections'] as const,
  snapAccount: (externalId: string) =>
    ['snaptrade', 'account', externalId] as const,
  orders: (externalId: string) =>
    ['snaptrade', 'account', externalId, 'orders'] as const,
  activities: (externalId: string) =>
    ['snaptrade', 'account', externalId, 'activities'] as const,
};

/** Retrying a 503 "not configured" or a 401 is pointless. */
function retryPolicy(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.isAuthFailure || error.isNotConfigured || error.status === 404) {
      return false;
    }
  }
  return failureCount < 2;
}

const shared = {
  retry: retryPolicy,
  staleTime: 30_000,
} satisfies Partial<UseQueryOptions>;

/**
 * The aggregate. `/api/portfolio` runs a live sync of every source with
 * `Promise.allSettled`, so a single broken account still yields data plus a
 * per-source error — surfaced rather than hidden.
 */
export function usePortfolio() {
  return useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: () => apiRequest<PortfolioSummary>('/api/portfolio'),
    ...shared,
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: async () => {
      const response = await apiRequest<AccountsResponse>('/api/accounts');
      return response.accounts;
    },
    ...shared,
  });
}

export function useSnapStatus() {
  return useQuery({
    queryKey: queryKeys.snapStatus,
    queryFn: () => apiRequest<SnapStatus>('/api/snaptrade/status'),
    ...shared,
  });
}

export function useConnections(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.connections,
    queryFn: async () => {
      const response = await apiRequest<ConnectionsResponse>(
        '/api/snaptrade/connections',
      );
      return response;
    },
    enabled,
    ...shared,
  });
}

export function useSnapAccountDetail(externalId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.snapAccount(externalId ?? 'none'),
    queryFn: () =>
      apiRequest<SnapAccountDetailVM>(
        `/api/snaptrade/accounts/${encodeURIComponent(externalId!)}`,
      ),
    enabled: Boolean(externalId),
    ...shared,
  });
}

export function useOrders(externalId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.orders(externalId ?? 'none'),
    queryFn: () =>
      apiRequest<OrdersResponse>(
        `/api/snaptrade/accounts/${encodeURIComponent(externalId!)}/orders`,
      ),
    enabled: Boolean(externalId),
    ...shared,
  });
}

export function useActivities(externalId: string | undefined, limit = 100) {
  return useQuery({
    queryKey: queryKeys.activities(externalId ?? 'none'),
    queryFn: () =>
      apiRequest<ActivitiesResponse>(
        `/api/snaptrade/accounts/${encodeURIComponent(externalId!)}/activities?limit=${limit}`,
      ),
    enabled: Boolean(externalId),
    ...shared,
  });
}

/** Brokerage accounts are the only ones with an orders/activities feed. */
export function brokerageExternalIds(accounts: PublicAccount[] | undefined) {
  return (accounts ?? [])
    .filter((account) => account.provider === 'snaptrade' && account.externalId)
    .map((account) => ({
      externalId: account.externalId!,
      label: account.label,
      currency: account.currency,
    }));
}

/**
 * The API exposes orders and activities per brokerage account only, so the
 * combined feed is fanned out client-side and merged. A single
 * `GET /api/activities` would remove this N+1 — noted as a backend gap.
 */
export function useCombinedActivityFeed(accounts: PublicAccount[] | undefined) {
  const sources = brokerageExternalIds(accounts);

  const orderQueries = useQueries({
    queries: sources.map((source) => ({
      queryKey: queryKeys.orders(source.externalId),
      queryFn: () =>
        apiRequest<OrdersResponse>(
          `/api/snaptrade/accounts/${encodeURIComponent(source.externalId)}/orders`,
        ),
      ...shared,
    })),
  });

  const activityQueries = useQueries({
    queries: sources.map((source) => ({
      queryKey: queryKeys.activities(source.externalId),
      queryFn: () =>
        apiRequest<ActivitiesResponse>(
          `/api/snaptrade/accounts/${encodeURIComponent(source.externalId)}/activities?limit=100`,
        ),
      ...shared,
    })),
  });

  const orders = sources.flatMap((source, index) =>
    (orderQueries[index]?.data?.orders ?? []).map((order) => ({
      ...order,
      accountLabel: source.label,
    })),
  );

  const activities = sources.flatMap((source, index) =>
    (activityQueries[index]?.data?.activities ?? []).map((activity) => ({
      ...activity,
      accountLabel: source.label,
    })),
  );

  const all = [...orderQueries, ...activityQueries];
  const failures = sources.flatMap((source, index) => {
    const messages = [
      orderQueries[index]?.error,
      activityQueries[index]?.error,
      orderQueries[index]?.data?.error,
      activityQueries[index]?.data?.error,
    ].filter(Boolean);
    return messages.length ? [{ label: source.label, messages }] : [];
  });

  return {
    sources,
    orders,
    activities,
    failures,
    isLoading: all.some((query) => query.isLoading),
    isFetching: all.some((query) => query.isFetching),
    /** Nothing loaded at all — distinct from "loaded but empty". */
    isTotalFailure: all.length > 0 && all.every((query) => query.isError),
  };
}
