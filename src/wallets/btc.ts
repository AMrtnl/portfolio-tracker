/**
 * Watch-only Bitcoin.
 *
 * An account-level public key (xpub / ypub / zpub — what Ledger Live and
 * every BIP32 wallet export) lets us derive every receive and change address
 * and total their balances from an Esplora-compatible API. No private
 * material is ever involved, so there is nothing to encrypt or leak.
 */
import { BIP32Factory, type BIP32Interface } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import bs58check from 'bs58check';

const bip32 = BIP32Factory(ecc);
const NETWORK = bitcoin.networks.bitcoin;

export type BtcScheme = 'p2pkh' | 'p2sh-p2wpkh' | 'p2wpkh';

/** SLIP-132 version bytes → derivation scheme (mainnet only). */
const VERSIONS: Record<string, BtcScheme> = {
  '0488b21e': 'p2pkh', // xpub · BIP44 legacy
  '049d7cb2': 'p2sh-p2wpkh', // ypub · BIP49 wrapped segwit
  '04b24746': 'p2wpkh', // zpub · BIP84 native segwit
};
const XPUB_VERSION = '0488b21e';

export const SCHEME_LABELS: Record<BtcScheme, string> = {
  p2pkh: 'legacy account (xpub)',
  'p2sh-p2wpkh': 'wrapped segwit account (ypub)',
  p2wpkh: 'native segwit account (zpub)',
};

/** Unused addresses to try past the last funded one before a branch is done (BIP44). */
export const GAP_LIMIT = 20;
/** Hard cap per branch so a hostile key can't turn into thousands of requests. */
const MAX_PER_BRANCH = 500;
const CONCURRENCY = 8;
const SATS = 100_000_000;

export interface ParsedXpub {
  scheme: BtcScheme;
  node: BIP32Interface;
}

/**
 * Accepts xpub / ypub / zpub. The scheme is remembered from the prefix; the
 * key itself is handed to bip32 re-encoded as an xpub since that is the only
 * prefix it understands.
 */
export function parseXpub(key: string): ParsedXpub | null {
  const trimmed = key.trim();
  if (!/^[xyz]pub[1-9A-HJ-NP-Za-km-z]{100,120}$/.test(trimmed)) return null;
  let payload: Uint8Array;
  try {
    payload = bs58check.decode(trimmed);
  } catch {
    return null;
  }
  if (payload.length !== 78) return null;
  const scheme = VERSIONS[Buffer.from(payload.subarray(0, 4)).toString('hex')];
  if (!scheme) return null;
  const asXpub = Buffer.concat([
    Buffer.from(XPUB_VERSION, 'hex'),
    Buffer.from(payload.subarray(4)),
  ]);
  try {
    return { scheme, node: bip32.fromBase58(bs58check.encode(asXpub), NETWORK) };
  } catch {
    return null;
  }
}

export function addressFor(node: BIP32Interface, scheme: BtcScheme): string {
  const pubkey = Buffer.from(node.publicKey);
  const payment =
    scheme === 'p2pkh'
      ? bitcoin.payments.p2pkh({ pubkey, network: NETWORK })
      : scheme === 'p2wpkh'
        ? bitcoin.payments.p2wpkh({ pubkey, network: NETWORK })
        : bitcoin.payments.p2sh({
            redeem: bitcoin.payments.p2wpkh({ pubkey, network: NETWORK }),
            network: NETWORK,
          });
  if (!payment.address) throw new Error('Could not derive a Bitcoin address');
  return payment.address;
}

/** Addresses `from … from+count-1` on the receive (0) or change (1) branch. */
export function deriveAddresses(
  parsed: ParsedXpub,
  branch: 0 | 1,
  from: number,
  count: number,
): string[] {
  const chain = parsed.node.derive(branch);
  const out: string[] = [];
  for (let i = from; i < from + count; i++) {
    out.push(addressFor(chain.derive(i), parsed.scheme));
  }
  return out;
}

export function isBtcAddress(value: string): boolean {
  try {
    bitcoin.address.toOutputScript(value.trim(), NETWORK);
    return true;
  } catch {
    return false;
  }
}

// ---- Esplora (mempool.space / blockstream.info) ----

export type FetchJson = (url: string) => Promise<unknown>;

interface EsploraStats {
  funded_txo_sum: number;
  spent_txo_sum: number;
  tx_count: number;
}

interface EsploraAddress {
  chain_stats?: Partial<EsploraStats>;
  mempool_stats?: Partial<EsploraStats>;
}

export interface AddressState {
  address: string;
  sats: number;
  used: boolean;
}

export function btcApiUrl(): string {
  return (process.env.BTC_API_URL || 'https://mempool.space/api').replace(/\/+$/, '');
}

export const defaultFetchJson: FetchJson = async (url) => {
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.json();
};

function stat(s: Partial<EsploraStats> | undefined, field: keyof EsploraStats): number {
  const v = s?.[field];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export async function addressState(
  address: string,
  fetchJson: FetchJson = defaultFetchJson,
): Promise<AddressState> {
  const data = (await fetchJson(`${btcApiUrl()}/address/${address}`)) as EsploraAddress;
  const sats =
    stat(data.chain_stats, 'funded_txo_sum') -
    stat(data.chain_stats, 'spent_txo_sum') +
    stat(data.mempool_stats, 'funded_txo_sum') -
    stat(data.mempool_stats, 'spent_txo_sum');
  const used = stat(data.chain_stats, 'tx_count') + stat(data.mempool_stats, 'tx_count') > 0;
  return { address, sats, used };
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export interface XpubScan {
  btc: number;
  addressesUsed: number;
  addressesScanned: number;
}

/**
 * Walks both branches with the BIP44 gap limit: keep deriving until twenty
 * consecutive addresses have never been used. Requests are batched so a
 * fresh account costs 40 lookups and a busy one only what it needs.
 */
export async function scanXpub(
  parsed: ParsedXpub,
  fetchJson: FetchJson = defaultFetchJson,
): Promise<XpubScan> {
  let sats = 0;
  let addressesUsed = 0;
  let addressesScanned = 0;

  for (const branch of [0, 1] as const) {
    let next = 0;
    let lastUsed = -1;
    for (;;) {
      const end = Math.min(MAX_PER_BRANCH, lastUsed + GAP_LIMIT + 1);
      if (next >= end) break;
      const addresses = deriveAddresses(parsed, branch, next, end - next);
      const states = await mapLimit(addresses, CONCURRENCY, (a) => addressState(a, fetchJson));
      states.forEach((state, i) => {
        if (!state.used) return;
        lastUsed = Math.max(lastUsed, next + i);
        addressesUsed += 1;
        sats += state.sats;
      });
      addressesScanned += addresses.length;
      next = end;
    }
  }

  return { btc: sats / SATS, addressesUsed, addressesScanned };
}

export async function addressBalance(
  address: string,
  fetchJson: FetchJson = defaultFetchJson,
): Promise<number> {
  const state = await addressState(address.trim(), fetchJson);
  return state.sats / SATS;
}
