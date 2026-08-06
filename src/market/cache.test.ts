import { InFlightMap, TtlCache } from './cache';

describe('TtlCache', () => {
  it('serves values until they expire', () => {
    const cache = new TtlCache<number>('test-ttl', 1000);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    expect(cache.has('a')).toBe(true);
  });

  it('stops serving expired entries', () => {
    const cache = new TtlCache<number>('test-expiry', 10);
    cache.set('a', 1, -1);
    expect(cache.get('a')).toBeUndefined();
  });

  it('still exposes an expired entry so callers can degrade to stale data', () => {
    const cache = new TtlCache<number>('test-stale', 10);
    cache.set('a', 42, -1);
    expect(cache.get('a')).toBeUndefined();
    // `get` evicts, so re-seed to inspect the stale path directly.
    cache.set('b', 42, -1);
    const stale = cache.getStale('b');
    expect(stale?.value).toBe(42);
    expect(stale?.expiresAt).toBeLessThanOrEqual(Date.now());
  });

  it('tracks hits and misses', () => {
    const cache = new TtlCache<number>('test-stats', 1000);
    cache.set('a', 1);
    cache.get('a');
    cache.get('missing');
    const stats = cache.stats();
    expect(stats).toMatchObject({ namespace: 'test-stats', entries: 1, hits: 1, misses: 1 });
  });

  it('clears everything', () => {
    const cache = new TtlCache<number>('test-clear', 1000);
    cache.set('a', 1);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.stats().entries).toBe(0);
  });
});

describe('InFlightMap', () => {
  it('collapses concurrent calls for the same key into one', async () => {
    const inFlight = new InFlightMap<number>();
    let calls = 0;
    const fn = () =>
      new Promise<number>((resolve) => {
        calls++;
        setTimeout(() => resolve(7), 5);
      });

    const [a, b] = await Promise.all([inFlight.run('k', fn), inFlight.run('k', fn)]);
    expect(a).toBe(7);
    expect(b).toBe(7);
    expect(calls).toBe(1);
  });

  it('allows a new call once the previous one settles', async () => {
    const inFlight = new InFlightMap<number>();
    let calls = 0;
    const fn = async () => ++calls;
    await inFlight.run('k', fn);
    await inFlight.run('k', fn);
    expect(calls).toBe(2);
  });

  it('does not wedge the key when the call rejects', async () => {
    const inFlight = new InFlightMap<number>();
    await expect(
      inFlight.run('k', () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    await expect(inFlight.run('k', () => Promise.resolve(1))).resolves.toBe(1);
  });
});
