/**
 * Watch-only wallets: recognise what the user pasted (or read from a Ledger)
 * and read its balances without ever touching a private key.
 */
import type { WatchChain, WatchKeyKind } from '../types/accounts';
import {
  SCHEME_LABELS,
  addressBalance,
  isBtcAddress,
  parseXpub,
  scanXpub,
  type BtcScheme,
  type FetchJson,
} from './btc';
import { fetchEthBalances, isEthAddress, type ChainBalance } from './eth';
import { fetchSolBalances, isSolAddress } from './sol';
import type { RpcBatch } from './rpc';

export interface WatchKey {
  chain: WatchChain;
  kind: WatchKeyKind;
  key: string;
  scheme?: BtcScheme;
}

export const CHAIN_NAMES: Record<WatchChain, string> = {
  btc: 'Bitcoin',
  eth: 'Ethereum',
  sol: 'Solana',
};

export function detectWatchKey(input: string): WatchKey | null {
  const key = (input || '').trim();
  if (!key) return null;
  if (/^[xyz]pub/.test(key)) {
    const parsed = parseXpub(key);
    return parsed ? { chain: 'btc', kind: 'xpub', key, scheme: parsed.scheme } : null;
  }
  if (isEthAddress(key)) return { chain: 'eth', kind: 'address', key };
  if (isBtcAddress(key)) return { chain: 'btc', kind: 'address', key };
  if (isSolAddress(key)) return { chain: 'sol', kind: 'address', key };
  return null;
}

export function describeWatchKey(key: WatchKey): string {
  const chain = CHAIN_NAMES[key.chain];
  if (key.kind === 'xpub' && key.scheme) return `${chain} · ${SCHEME_LABELS[key.scheme]}`;
  return `${chain} · single address`;
}

export interface WatchBalance extends ChainBalance {
  chain: string;
}

export interface WatchRead {
  balances: WatchBalance[];
  /** Human note for the account row, e.g. how many addresses were in use. */
  note?: string;
}

export interface WatchDeps {
  fetchJson?: FetchJson;
  rpc?: RpcBatch;
}

export async function fetchWatchBalances(
  key: WatchKey,
  deps: WatchDeps = {},
): Promise<WatchRead> {
  const chain = CHAIN_NAMES[key.chain];
  const tag = (rows: ChainBalance[]): WatchBalance[] => rows.map((r) => ({ ...r, chain }));

  if (key.chain === 'btc') {
    if (key.kind === 'xpub') {
      const parsed = parseXpub(key.key);
      if (!parsed) throw new Error('Not a valid Bitcoin account key');
      const scan = await scanXpub(parsed, deps.fetchJson);
      return {
        balances: scan.btc > 0 ? tag([{ asset: 'BTC', name: 'Bitcoin', amount: scan.btc }]) : [],
        note: `${scan.addressesUsed} address${scan.addressesUsed === 1 ? '' : 'es'} in use`,
      };
    }
    const btc = await addressBalance(key.key, deps.fetchJson);
    return { balances: btc > 0 ? tag([{ asset: 'BTC', name: 'Bitcoin', amount: btc }]) : [] };
  }
  if (key.chain === 'eth') return { balances: tag(await fetchEthBalances(key.key, deps.rpc)) };
  return { balances: tag(await fetchSolBalances(key.key, deps.rpc)) };
}
