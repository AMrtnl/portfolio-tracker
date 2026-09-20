import { describeWatchKey, detectWatchKey, fetchWatchBalances } from './index';
import { ETH_TOKENS, fetchEthBalances, hexToAmount } from './eth';
import { base58Decode, fetchSolBalances, isSolAddress } from './sol';
import type { RpcRequest } from './rpc';

const ZPUB =
  'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';
const BTC_ADDRESS = 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu';
const ETH_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const SOL_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

describe('detectWatchKey', () => {
  it('recognises Bitcoin account keys and addresses', () => {
    expect(detectWatchKey(ZPUB)).toEqual({ chain: 'btc', kind: 'xpub', key: ZPUB, scheme: 'p2wpkh' });
    expect(detectWatchKey(`  ${BTC_ADDRESS}\n`)).toEqual({
      chain: 'btc',
      kind: 'address',
      key: BTC_ADDRESS,
    });
  });

  it('recognises Ethereum and Solana addresses', () => {
    expect(detectWatchKey(ETH_ADDRESS)).toEqual({ chain: 'eth', kind: 'address', key: ETH_ADDRESS });
    expect(detectWatchKey(SOL_ADDRESS)).toEqual({ chain: 'sol', kind: 'address', key: SOL_ADDRESS });
  });

  it('returns null for anything else', () => {
    expect(detectWatchKey('')).toBeNull();
    expect(detectWatchKey('abandon abandon abandon about')).toBeNull();
    expect(detectWatchKey(`xprv${ZPUB.slice(4)}`)).toBeNull();
    expect(detectWatchKey('0x1234')).toBeNull();
  });

  it('describes what was detected', () => {
    expect(describeWatchKey(detectWatchKey(ZPUB)!)).toBe('Bitcoin · native segwit account (zpub)');
    expect(describeWatchKey(detectWatchKey(SOL_ADDRESS)!)).toBe('Solana · single address');
  });
});

describe('Ethereum', () => {
  it('converts hex units at the token decimals without float drift', () => {
    expect(hexToAmount('0x14d1120d7b160000', 18)).toBe(1.5);
    expect(hexToAmount('0xEE6B280', 6)).toBe(250);
    expect(hexToAmount('0x', 6)).toBe(0);
    expect(hexToAmount(`0x${(10n ** 24n).toString(16)}`, 18)).toBe(1_000_000);
    expect(hexToAmount('nope', 18)).toBe(0);
    expect(hexToAmount(undefined, 18)).toBe(0);
  });

  it('reads ETH plus the major tokens in one batch and skips zero or failed tokens', async () => {
    const rpc = jest.fn(async (_url: string, calls: RpcRequest[]) =>
      calls.map((call, i) => {
        if (i === 0) return { result: '0x14d1120d7b160000' };
        const token = ETH_TOKENS[i - 1];
        if (token.symbol === 'USDC') return { result: '0xEE6B280' };
        if (token.symbol === 'LINK') return { error: 'execution reverted' };
        return { result: '0x0' };
      }),
    );

    const balances = await fetchEthBalances(ETH_ADDRESS, rpc);

    expect(balances).toEqual([
      { asset: 'ETH', name: 'Ether', amount: 1.5 },
      { asset: 'USDC', name: 'USD Coin', amount: 250 },
    ]);
    const calls = rpc.mock.calls[0][1];
    expect(calls[0]).toEqual({
      method: 'eth_getBalance',
      params: [ETH_ADDRESS.toLowerCase(), 'latest'],
    });
    expect(calls[1].method).toBe('eth_call');
    expect((calls[1].params[0] as { data: string }).data).toBe(
      `0x70a08231${'0'.repeat(24)}${ETH_ADDRESS.slice(2).toLowerCase()}`,
    );
  });

  it('fails loudly when the native balance itself errors', async () => {
    const rpc = jest.fn(async (_url: string, calls: RpcRequest[]) =>
      calls.map(() => ({ error: 'rate limited' })),
    );
    await expect(fetchEthBalances(ETH_ADDRESS, rpc)).rejects.toThrow('rate limited');
  });
});

describe('Solana', () => {
  it('decodes base58 including leading zero bytes', () => {
    expect(base58Decode('11111111111111111111111111111111')).toEqual(new Uint8Array(32));
    expect(base58Decode(SOL_ADDRESS)?.length).toBe(32);
    expect(base58Decode('0OIl')).toBeNull();
  });

  it('validates addresses by decoded length, not just characters', () => {
    expect(isSolAddress(SOL_ADDRESS)).toBe(true);
    expect(isSolAddress(BTC_ADDRESS)).toBe(false);
    expect(isSolAddress(ETH_ADDRESS)).toBe(false);
  });

  it('sums SPL token accounts per mint and keeps only known tokens', async () => {
    const tokenAccount = (mint: string, uiAmount: number) => ({
      account: { data: { parsed: { info: { mint, tokenAmount: { uiAmount } } } } },
    });
    const rpc = jest.fn(async () => [
      { result: { value: 2_500_000_000 } },
      {
        result: {
          value: [
            tokenAccount('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 100),
            tokenAccount('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 50),
            tokenAccount('So11111111111111111111111111111111111111112', 9),
          ],
        },
      },
    ]);

    expect(await fetchSolBalances(SOL_ADDRESS, rpc)).toEqual([
      { asset: 'SOL', name: 'Solana', amount: 2.5 },
      { asset: 'USDC', name: 'USD Coin', amount: 150 },
    ]);
  });
});

describe('fetchWatchBalances', () => {
  it('tags balances with the chain and drops empty wallets', async () => {
    const fetchJson = jest.fn(async () => ({
      chain_stats: { funded_txo_sum: 200_000_000, spent_txo_sum: 50_000_000, tx_count: 4 },
    }));
    const read = await fetchWatchBalances(detectWatchKey(BTC_ADDRESS)!, { fetchJson });
    expect(read.balances).toEqual([{ asset: 'BTC', name: 'Bitcoin', amount: 1.5, chain: 'Bitcoin' }]);

    const empty = jest.fn(async () => ({}));
    expect((await fetchWatchBalances(detectWatchKey(BTC_ADDRESS)!, { fetchJson: empty })).balances).toEqual([]);
  });

  it('reports how many addresses an account key has in use', async () => {
    const fetchJson = jest.fn(async () => ({}));
    const read = await fetchWatchBalances(detectWatchKey(ZPUB)!, { fetchJson });
    expect(read.note).toBe('0 addresses in use');
  });
});
