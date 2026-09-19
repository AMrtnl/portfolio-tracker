/**
 * Watch-only Solana: native SOL and the major stablecoins held in classic
 * SPL token accounts, read through any public JSON-RPC endpoint.
 */
import { jsonRpcBatch, type RpcBatch } from './rpc';
import type { ChainBalance } from './eth';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const LAMPORTS = 1_000_000_000;

export const SOL_TOKENS: Record<string, { symbol: string; name: string }> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC', name: 'USD Coin' },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: 'USDT', name: 'Tether' },
};

/** Plain base58 (no checksum), as Solana public keys use. */
export function base58Decode(value: string): Uint8Array | null {
  const bytes: number[] = [];
  for (const ch of value) {
    let carry = ALPHABET.indexOf(ch);
    if (carry < 0) return null;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  let zeros = 0;
  for (const ch of value) {
    if (ch !== '1') break;
    zeros += 1;
  }
  return Uint8Array.from([...new Array<number>(zeros).fill(0), ...bytes.reverse()]);
}

export function isSolAddress(value: string): boolean {
  const v = value.trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) return false;
  return base58Decode(v)?.length === 32;
}

export function solRpcUrl(): string {
  return process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
}

interface TokenAccount {
  account?: {
    data?: {
      parsed?: {
        info?: { mint?: string; tokenAmount?: { uiAmount?: number | null } };
      };
    };
  };
}

export async function fetchSolBalances(
  address: string,
  rpc: RpcBatch = jsonRpcBatch,
): Promise<ChainBalance[]> {
  const addr = address.trim();
  const [balance, tokens] = await rpc(solRpcUrl(), [
    { method: 'getBalance', params: [addr] },
    {
      method: 'getTokenAccountsByOwner',
      params: [addr, { programId: TOKEN_PROGRAM }, { encoding: 'jsonParsed' }],
    },
  ]);
  if (balance?.error) throw new Error(balance.error);

  const out: ChainBalance[] = [];
  const lamports = (balance?.result as { value?: number } | undefined)?.value;
  if (typeof lamports === 'number' && lamports > 0) {
    out.push({ asset: 'SOL', name: 'Solana', amount: lamports / LAMPORTS });
  }

  const accounts = (tokens?.result as { value?: TokenAccount[] } | undefined)?.value ?? [];
  const byMint = new Map<string, number>();
  for (const acct of accounts) {
    const info = acct.account?.data?.parsed?.info;
    const amount = info?.tokenAmount?.uiAmount;
    if (!info?.mint || typeof amount !== 'number' || amount <= 0) continue;
    byMint.set(info.mint, (byMint.get(info.mint) ?? 0) + amount);
  }
  for (const [mint, amount] of byMint) {
    const token = SOL_TOKENS[mint];
    if (token) out.push({ asset: token.symbol, name: token.name, amount });
  }
  return out;
}
