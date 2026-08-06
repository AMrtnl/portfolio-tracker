import type {
  Account,
  AccountOrderRecord,
  AccountPosition,
  AccountUniversalActivity,
  Balance,
  BrokerageAuthorization,
  Position,
} from 'snaptrade-typescript-sdk';
import type {
  SnapAccountVM,
  SnapActivityVM,
  SnapBalanceVM,
  SnapConnectionVM,
  SnapOrderVM,
  SnapPositionVM,
} from './types';

export function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function maskSuffix(number: string | undefined | null): string | undefined {
  if (!number) return undefined;
  const cleaned = String(number).trim();
  if (!cleaned) return undefined;
  return cleaned.length > 4 ? `••••${cleaned.slice(-4)}` : cleaned;
}

export function normalizeAccount(account: Account): SnapAccountVM {
  const total = account.balance?.total;
  const currency = total?.currency || 'USD';
  const holdings = account.sync_status?.holdings;
  return {
    externalId: account.id,
    label: account.name || account.institution_name || 'Account',
    institution: account.institution_name || 'Brokerage',
    numberSuffix: maskSuffix(account.number),
    accountType: account.raw_type ?? null,
    accountCategory: account.account_category ?? null,
    status: account.status ?? null,
    currency,
    totalValue: total?.amount ?? null,
    isPaper: Boolean(account.is_paper),
    holdingsUnavailable: holdings?.holdings_unavailable ?? false,
    lastHoldingsSync: holdings?.last_successful_sync ?? null,
    brokerageAuthorizationId: account.brokerage_authorization,
  };
}

export function normalizeBalances(rows: Balance[] | unknown): SnapBalanceVM[] {
  const list = Array.isArray(rows) ? rows : [];
  const out: SnapBalanceVM[] = [];
  for (const row of list) {
    const currency = row?.currency?.code || 'USD';
    out.push({
      currency: String(currency).toUpperCase(),
      cash: row?.cash ?? null,
      buyingPower: row?.buying_power ?? null,
    });
  }
  return out;
}

/** Positions from getAllAccountPositions → AllAccountPositionsResponse.results */
export function normalizeAccountPositions(
  results: AccountPosition[] | unknown,
): SnapPositionVM[] {
  const list = Array.isArray(results) ? results : [];
  const out: SnapPositionVM[] = [];
  for (const row of list) {
    const instrument = row?.instrument as
      | { symbol?: string; raw_symbol?: string; description?: string | null }
      | undefined;
    const symbol =
      instrument?.symbol || instrument?.raw_symbol || '';
    const units = num(row?.units);
    if (!symbol || units == null || units === 0) continue;
    const price = num(row?.price);
    const averageCost = num(row?.cost_basis);
    const currency = (row?.currency || 'USD').toUpperCase();
    const marketValue =
      price != null ? Math.abs(units) * price : null;
    out.push({
      symbol: String(symbol),
      name: instrument?.description ?? null,
      units,
      price,
      averageCost,
      marketValue,
      currency,
      openPnl: null,
      cashEquivalent: Boolean(row?.cash_equivalent),
    });
  }
  return out;
}

/** Legacy Position[] from getUserAccountPositions (defensive / tests). */
export function normalizeLegacyPositions(
  rows: Position[] | unknown,
): SnapPositionVM[] {
  const list = Array.isArray(rows) ? rows : [];
  const out: SnapPositionVM[] = [];
  for (const row of list) {
    const uni = row?.symbol?.symbol;
    const symbol = uni?.symbol || uni?.raw_symbol || '';
    const units = num(row?.units);
    if (!symbol || units == null || units === 0) continue;
    const price = num(row?.price);
    const averageCost = num(row?.average_purchase_price);
    const currency =
      row?.currency?.code || uni?.currency?.code || 'USD';
    const marketValue =
      price != null ? Math.abs(units) * price : null;
    out.push({
      symbol: String(symbol),
      name: uni?.description ?? null,
      units,
      price,
      averageCost,
      marketValue,
      currency: String(currency).toUpperCase(),
      openPnl: row?.open_pnl ?? null,
      cashEquivalent: Boolean(row?.cash_equivalent),
    });
  }
  return out;
}

export function extractPositionsPayload(data: unknown): SnapPositionVM[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    // Could be legacy Position[]
    return normalizeLegacyPositions(data);
  }
  if (typeof data === 'object' && data !== null && 'results' in data) {
    return normalizeAccountPositions(
      (data as { results: AccountPosition[] }).results,
    );
  }
  return [];
}

export function normalizeOrders(
  data: { orders?: AccountOrderRecord[] } | AccountOrderRecord[] | unknown,
): SnapOrderVM[] {
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { orders?: AccountOrderRecord[] })?.orders)
      ? (data as { orders: AccountOrderRecord[] }).orders
      : [];
  return list.map((o) => {
    const symbol =
      o.universal_symbol?.symbol ||
      o.option_symbol?.ticker ||
      undefined;
    return {
      brokerageOrderId: o.brokerage_order_id,
      symbol: symbol || undefined,
      action: o.action,
      status: o.status,
      orderType: o.order_type,
      totalQuantity: o.total_quantity,
      filledQuantity: o.filled_quantity,
      limitPrice: o.limit_price,
      executionPrice: o.execution_price,
      timePlaced: o.time_placed,
      timeExecuted: o.time_executed,
      currency: o.universal_symbol?.currency?.code ?? null,
    };
  });
}

export function normalizeActivities(
  data: { data?: AccountUniversalActivity[] } | AccountUniversalActivity[] | unknown,
): SnapActivityVM[] {
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { data?: AccountUniversalActivity[] })?.data)
      ? (data as { data: AccountUniversalActivity[] }).data
      : [];
  return list.map((a) => ({
    id: a.id,
    type: a.type,
    symbol: a.symbol?.symbol || a.symbol?.raw_symbol || null,
    description: a.description,
    amount: a.amount ?? null,
    units: a.units ?? null,
    price: a.price ?? null,
    currency: a.currency?.code ?? null,
    tradeDate: a.trade_date ?? null,
    settlementDate: a.settlement_date ?? null,
    fee: a.fee ?? null,
    institution: a.institution,
  }));
}

export function normalizeConnections(
  rows: BrokerageAuthorization[] | unknown,
): SnapConnectionVM[] {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .filter((c) => c?.id)
    .map((c) => ({
      id: c.id!,
      name: c.name || c.brokerage?.display_name || c.brokerage?.name || 'Connection',
      brokerageName:
        c.brokerage?.display_name || c.brokerage?.name || 'Brokerage',
      brokerageSlug: c.brokerage?.slug,
      type: c.type,
      disabled: Boolean(c.disabled),
      disabledDate: c.disabled_date ?? null,
      dataFreshnessMode: c.data_freshness_mode,
      createdDate: c.created_date,
    }));
}

export function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const resp = (err as { response?: { data?: { detail?: string; message?: string }; status?: number } })
      .response;
    const detail = resp?.data?.detail || resp?.data?.message;
    if (detail) return String(detail);
    if (resp?.status) return `SnapTrade HTTP ${resp.status}`;
  }
  if (err instanceof Error) return err.message;
  return 'SnapTrade request failed';
}
