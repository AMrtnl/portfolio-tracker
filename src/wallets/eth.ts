/**
 * Watch-only Ethereum: native ETH plus the handful of tokens that make up
 * most cold-storage balances, read through any public JSON-RPC endpoint.
 */
import { jsonRpcBatch, type RpcBatch } from './rpc';

export interface EthToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
}

export const ETH_TOKENS: EthToken[] = [
  { symbol: 'USDC', name: 'USD Coin', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6 },
  { symbol: 'USDT', name: 'Tether', address: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6 },
  { symbol: 'DAI', name: 'Dai', address: '0x6b175474e89094c44da98b954eedeac495271d0f', decimals: 18 },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', decimals: 8 },
  { symbol: 'STETH', name: 'Lido Staked Ether', address: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84', decimals: 18 },
  { symbol: 'LINK', name: 'Chainlink', address: '0x514910771af9ca656af840dff83e8264ecf986ca', decimals: 18 },
  { symbol: 'UNI', name: 'Uniswap', address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', decimals: 18 },
];

/** ERC-20 `balanceOf(address)` selector. */
const BALANCE_OF = '0x70a08231';

export function isEthAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

export function ethRpcUrl(): string {
  return process.env.ETH_RPC_URL || 'https://ethereum-rpc.publicnode.com';
}

/** Integer maths stays in BigInt; only the final ratio crosses to a float. */
export function hexToAmount(hex: unknown, decimals: number): number {
  if (typeof hex !== 'string' || !/^0x[0-9a-fA-F]*$/.test(hex)) return 0;
  const units = BigInt(hex === '0x' ? '0x0' : hex);
  const base = 10n ** BigInt(decimals);
  return Number(units / base) + Number(units % base) / Number(base);
}

export interface ChainBalance {
  asset: string;
  name: string;
  amount: number;
}

export async function fetchEthBalances(
  address: string,
  rpc: RpcBatch = jsonRpcBatch,
): Promise<ChainBalance[]> {
  const addr = address.trim().toLowerCase();
  const calls = [
    { method: 'eth_getBalance', params: [addr, 'latest'] },
    ...ETH_TOKENS.map((t) => ({
      method: 'eth_call',
      params: [{ to: t.address, data: BALANCE_OF + addr.slice(2).padStart(64, '0') }, 'latest'],
    })),
  ];
  const outcomes = await rpc(ethRpcUrl(), calls);

  if (outcomes[0]?.error) throw new Error(outcomes[0].error);
  const out: ChainBalance[] = [];
  const eth = hexToAmount(outcomes[0]?.result, 18);
  if (eth > 0) out.push({ asset: 'ETH', name: 'Ether', amount: eth });

  // A single token contract misbehaving shouldn't hide the rest of the wallet.
  ETH_TOKENS.forEach((token, i) => {
    const outcome = outcomes[i + 1];
    if (!outcome || outcome.error) return;
    const amount = hexToAmount(outcome.result, token.decimals);
    if (amount > 0) out.push({ asset: token.symbol, name: token.name, amount });
  });
  return out;
}
