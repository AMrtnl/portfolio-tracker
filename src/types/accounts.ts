/** Account / provider model for multi-source finance aggregation. */

export type AccountType =
  | 'crypto_wallet'
  | 'broker'
  | 'bank'
  | 'manual'
  | 'loan'
  | 'pension'
  | 'estate';

export type AccountKind = 'asset' | 'liability';

/** Visual / book class used by the wealth UI. Independent of broker type. */
export type BookClass =
  | 'estate'
  | 'pension'
  | 'stocks'
  | 'cash'
  | 'bonds'
  | 'crypto'
  | 'other';

export type ProviderId = 'hyperliquid' | 'snaptrade' | 'manual';

export type AccountStatus =
  | 'connected'
  | 'pending'
  | 'error'
  | 'disconnected'
  | 'unconfigured';

export type AssetClass = 'equity' | 'etf' | 'crypto' | 'cash' | 'other';

/** Normalized holding used by manual accounts and portfolio aggregation. */
export interface Holding {
  symbol: string;
  name?: string;
  quantity: number;
  /** Last known / user-entered USD price per unit */
  priceUsd: number;
  assetClass?: AssetClass;
}

export interface PublicAccount {
  id: string;
  label: string;
  type: AccountType;
  provider: ProviderId;
  status: AccountStatus;
  kind: AccountKind;
  bookClass?: BookClass;
  /** Wallet address, SnapTrade account id, etc. */
  externalId?: string;
  /** Short display id (masked address / account number) */
  maskedIdentifier?: string;
  institution?: string;
  currency: string;
  lastSyncedAt?: string;
  lastError?: string;
  createdAt: string;
  /** True when a live Hyperliquid adapter is booted for this account */
  live?: boolean;
  /** Manual holdings (only for manual accounts; never includes secrets) */
  holdings?: Holding[];
  /** Approximate USD total from last sync / stored holdings */
  totalValueUsd?: number;
  /** Rate, pillar, address — shown as the row subtitle. */
  notes?: string;
}

export function isLiabilityAccount(account: {
  kind?: AccountKind;
  type: AccountType;
}): boolean {
  return account.kind === 'liability' || account.type === 'loan';
}

export function inferKind(type: AccountType, kind?: AccountKind): AccountKind {
  if (kind) return kind;
  return type === 'loan' ? 'liability' : 'asset';
}

export function inferBookClass(
  type: AccountType,
  bookClass?: BookClass,
): BookClass | undefined {
  if (bookClass) return bookClass;
  switch (type) {
    case 'crypto_wallet':
      return 'crypto';
    case 'bank':
      return 'cash';
    case 'broker':
      return 'stocks';
    case 'pension':
      return 'pension';
    case 'estate':
      return 'estate';
    default:
      return undefined;
  }
}

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  description: string;
  accountTypes: AccountType[];
  configured: boolean;
  /** Regions / coverage notes for the UI */
  coverage: string;
  connectMode: 'mnemonic' | 'oauth' | 'manual' | 'import';
}
