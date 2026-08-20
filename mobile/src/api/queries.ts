import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { apiRequest, ApiError } from './client';
import type {
  AccountsResponse,
  ActivitiesResponse,
  BillingCycle,
  CashflowResponse,
  ConnectionsResponse,
  MoneyTransaction,
  OrdersResponse,
  PortfolioSummary,
  PublicAccount,
  SnapAccountDetailVM,
  SnapStatus,
  Subscription,
  SubscriptionsResponse,
  TxKind,
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
  cashflow: ['money', 'cashflow'] as const,
  transactions: ['money', 'transactions'] as const,
  subscriptions: ['money', 'subscriptions'] as const,
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
export function usePortfolio(enabled = true) {
  return useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: () => apiRequest<PortfolioSummary>('/api/portfolio'),
    enabled,
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

function invalidateMoney(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['money'] });
}

function invalidateBook(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: queryKeys.accounts });
  void qc.invalidateQueries({ queryKey: queryKeys.portfolio });
}

export function useCashflow(months = 6) {
  return useQuery({
    queryKey: [...queryKeys.cashflow, months],
    queryFn: () =>
      apiRequest<CashflowResponse>(`/api/money/cashflow?months=${months}`),
    ...shared,
  });
}

export function useTransactions() {
  return useQuery({
    queryKey: queryKeys.transactions,
    queryFn: async () => {
      const data = await apiRequest<{ transactions: MoneyTransaction[] }>(
        '/api/money/transactions',
      );
      return data.transactions;
    },
    ...shared,
  });
}

export function useAddTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      date: string;
      kind: TxKind;
      amount: number;
      category: string;
      note?: string;
    }) =>
      apiRequest<MoneyTransaction>('/api/money/transactions', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/money/transactions/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useSubscriptions() {
  return useQuery({
    queryKey: queryKeys.subscriptions,
    queryFn: () => apiRequest<SubscriptionsResponse>('/api/money/subscriptions'),
    ...shared,
  });
}

export function useAddSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      plan?: string;
      amount: number;
      cycle: BillingCycle;
      day: number;
      month?: number;
      cat: string;
    }) =>
      apiRequest<Subscription>('/api/money/subscriptions', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useDeleteSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/money/subscriptions/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useAddManualAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      label: string;
      institution?: string;
      notes?: string;
      currency?: string;
      balance: number;
      type?: PublicAccount['type'];
      kind?: 'asset' | 'liability';
      bookClass?: string;
    }) =>
      apiRequest<PublicAccount>('/api/accounts/manual', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: () => invalidateBook(qc),
  });
}
