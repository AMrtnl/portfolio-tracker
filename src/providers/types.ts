import { Balance, Position } from '../types/common';
import { ProviderId, ProviderInfo, PublicAccount } from '../types/accounts';

export interface SyncResult {
  balances: Balance[];
  positions: Position[];
  /** Absolute USD PnL % for weighting (Hyperliquid); others may be 0 */
  pnl?: { pnl24h: number; pnl7d: number; pnl30d: number };
  totalValueUsd: number;
  error?: string;
}

export interface ConnectResult {
  /** OAuth / Connection Portal URL when applicable */
  redirectUrl?: string;
  /** Message for the client */
  message?: string;
  /** Newly created / imported local account ids */
  accountIds?: string[];
}

/**
 * Finance data provider. Implementations must never expose secrets to the client.
 */
export interface FinanceProvider {
  id: ProviderId;
  info(): ProviderInfo;
  isConfigured(): boolean;

  /**
   * Start a connection flow (OAuth URL, etc.).
   * Manual/crypto use dedicated POST bodies instead.
   */
  startConnect?(opts?: Record<string, unknown>): Promise<ConnectResult>;

  /** Sync balances/positions for one linked account. */
  sync(account: PublicAccount): Promise<SyncResult>;
}
