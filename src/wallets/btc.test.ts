import {
  GAP_LIMIT,
  addressState,
  deriveAddresses,
  isBtcAddress,
  parseXpub,
  scanXpub,
} from './btc';

// Public test vectors from BIP44 / BIP49 / BIP84 (the "abandon … about" seed).
const ZPUB =
  'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';
const XPUB =
  'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj';
const YPUB =
  'ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP';

const EMPTY = {
  chain_stats: { funded_txo_sum: 0, spent_txo_sum: 0, tx_count: 0 },
  mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0, tx_count: 0 },
};

function fakeApi(funded: Record<string, unknown>) {
  return jest.fn(async (url: string) => {
    const address = url.split('/').pop() as string;
    return funded[address] ?? EMPTY;
  });
}

describe('parseXpub / deriveAddresses', () => {
  it('derives BIP84 native segwit addresses from a zpub', () => {
    const parsed = parseXpub(ZPUB);
    expect(parsed?.scheme).toBe('p2wpkh');
    expect(deriveAddresses(parsed!, 0, 0, 2)).toEqual([
      'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
      'bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g',
    ]);
    expect(deriveAddresses(parsed!, 1, 0, 1)).toEqual([
      'bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el',
    ]);
  });

  it('derives BIP44 legacy addresses from an xpub', () => {
    const parsed = parseXpub(XPUB);
    expect(parsed?.scheme).toBe('p2pkh');
    expect(deriveAddresses(parsed!, 0, 0, 1)).toEqual(['1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA']);
  });

  it('derives BIP49 wrapped segwit addresses from a ypub', () => {
    const parsed = parseXpub(YPUB);
    expect(parsed?.scheme).toBe('p2sh-p2wpkh');
    expect(deriveAddresses(parsed!, 0, 0, 1)).toEqual(['37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf']);
  });

  it('rejects garbage, a broken checksum, and anything that is not a public key', () => {
    expect(parseXpub('')).toBeNull();
    expect(parseXpub(`zpub${'x'.repeat(107)}`)).toBeNull();
    expect(parseXpub(`${ZPUB.slice(0, -1)}a`)).toBeNull();
    expect(parseXpub(`xprv${XPUB.slice(4)}`)).toBeNull();
    expect(parseXpub('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu')).toBeNull();
  });
});

describe('isBtcAddress', () => {
  it('accepts bech32, legacy, and p2sh mainnet addresses', () => {
    expect(isBtcAddress('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu')).toBe(true);
    expect(isBtcAddress(' 1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA ')).toBe(true);
    expect(isBtcAddress('37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf')).toBe(true);
  });

  it('rejects typos and other chains', () => {
    expect(isBtcAddress('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyx')).toBe(false);
    expect(isBtcAddress('0xd8da6bf26964af9d7eed9e03e53415d37aa96045')).toBe(false);
    expect(isBtcAddress('')).toBe(false);
  });
});

describe('scanXpub', () => {
  const parsed = parseXpub(ZPUB)!;

  it('follows the gap limit on both branches and sums funded minus spent', async () => {
    const receive = deriveAddresses(parsed, 0, 0, 3);
    const change = deriveAddresses(parsed, 1, 0, 1);
    const api = fakeApi({
      [receive[0]]: { chain_stats: { funded_txo_sum: 100_000, spent_txo_sum: 0, tx_count: 1 } },
      [receive[2]]: {
        chain_stats: { funded_txo_sum: 50_000, spent_txo_sum: 20_000, tx_count: 2 },
        mempool_stats: { funded_txo_sum: 5_000, spent_txo_sum: 0, tx_count: 1 },
      },
      [change[0]]: { chain_stats: { funded_txo_sum: 30_000, spent_txo_sum: 0, tx_count: 1 } },
    });

    const scan = await scanXpub(parsed, api);

    expect(scan.btc).toBeCloseTo(0.00165, 10);
    expect(scan.addressesUsed).toBe(3);
    // receive: indices 0..22 (last used 2 + gap), change: 0..20 (last used 0 + gap)
    expect(scan.addressesScanned).toBe(3 + GAP_LIMIT + 1 + GAP_LIMIT);
    expect(api).toHaveBeenCalledTimes(scan.addressesScanned);
  });

  it('costs exactly one gap window per branch for an unused key', async () => {
    const api = fakeApi({});
    const scan = await scanXpub(parsed, api);
    expect(scan).toEqual({ btc: 0, addressesUsed: 0, addressesScanned: 2 * GAP_LIMIT });
  });

  it('propagates API failures instead of reporting a zero balance', async () => {
    const api = jest.fn(async () => {
      throw new Error('503 from mempool.space');
    });
    await expect(scanXpub(parsed, api)).rejects.toThrow('503');
  });
});

describe('addressState', () => {
  it('reads the Esplora shape and tolerates missing sections', async () => {
    const api = jest.fn(async (_url: string) => ({
      chain_stats: { funded_txo_sum: 250_000, spent_txo_sum: 100_000, tx_count: 3 },
    }));
    const state = await addressState('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu', api);
    expect(state).toEqual({
      address: 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
      sats: 150_000,
      used: true,
    });
    expect(api).toHaveBeenCalledWith(
      expect.stringMatching(/\/address\/bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu$/),
    );
  });
});
