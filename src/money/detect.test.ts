import { detectRecurring, merchantKey, subscriptionCategoryFor, suggestCategory } from './detect';
import type { MoneyTransaction, Subscription } from './types';

function tx(date: string, amount: number, note: string, kind: 'income' | 'spend' = 'spend'): MoneyTransaction {
  return { id: `${date}-${note}`, date, kind, amount, category: 'other', note, createdAt: date };
}

describe('suggestCategory', () => {
  it('maps Swiss grocers and transport by keyword', () => {
    expect(suggestCategory('MIGROS ZUERICH HB', 'spend')).toBe('groceries');
    expect(suggestCategory('Coop Pronto Bern', 'spend')).toBe('groceries');
    expect(suggestCategory('SBB CFF FFS Mobile', 'spend')).toBe('transport');
    expect(suggestCategory('Helsana Praemie 09/2026', 'spend')).toBe('insurance');
    expect(suggestCategory('Netflix.com', 'spend')).toBe('subscriptions');
  });

  it('matches whole words only', () => {
    expect(suggestCategory('access fee', 'spend')).toBeNull();
    expect(suggestCategory('bpm studio', 'spend')).toBeNull();
    expect(suggestCategory('BP Tankstelle', 'spend')).toBe('transport');
  });

  it('uses income rules for income', () => {
    expect(suggestCategory('Salaire septembre', 'income')).toBe('salary');
    expect(suggestCategory('Lohn September', 'income')).toBe('salary');
    expect(suggestCategory('Bonus 2026', 'income')).toBe('bonus');
    expect(suggestCategory('Netflix refund', 'income')).toBeNull();
  });

  it('returns null for empty or unknown notes', () => {
    expect(suggestCategory('', 'spend')).toBeNull();
    expect(suggestCategory(undefined, 'spend')).toBeNull();
    expect(suggestCategory('Zahlung 4711', 'spend')).toBeNull();
  });
});

describe('merchantKey', () => {
  it('strips numbers, punctuation, and trailing detail', () => {
    expect(merchantKey('NETFLIX.COM 12345 AMSTERDAM')).toBe('netflix com amsterdam');
    expect(merchantKey('Swisscom (Schweiz) AG Rechnung 09/2026')).toBe('swisscom schweiz ag');
  });
});

describe('subscriptionCategoryFor', () => {
  it('prefers telecom and software over the spend category', () => {
    expect(subscriptionCategoryFor('Swisscom Rechnung', 'subscriptions')).toBe('telecom');
    expect(subscriptionCategoryFor('GitHub Pro', 'subscriptions')).toBe('software');
    expect(subscriptionCategoryFor('Spotify', 'subscriptions')).toBe('media');
    expect(subscriptionCategoryFor('SBB GA', 'transport')).toBe('transport');
    expect(subscriptionCategoryFor('Miete', 'housing')).toBe('home');
  });
});

describe('detectRecurring', () => {
  const now = new Date('2026-09-16T00:00:00Z');

  it('finds a monthly charge with a stable amount', () => {
    const rows = [
      tx('2026-06-05', 17.9, 'NETFLIX.COM'),
      tx('2026-07-05', 17.9, 'NETFLIX.COM'),
      tx('2026-08-05', 17.9, 'NETFLIX.COM'),
      tx('2026-09-05', 17.9, 'NETFLIX.COM'),
    ];
    const [s] = detectRecurring(rows, [], now);
    expect(s).toMatchObject({ cycle: 'monthly', amount: 17.9, day: 5, cat: 'media', occurrences: 4 });
    expect(s.name).toBe('NETFLIX.COM');
  });

  it('tolerates small amount drift and irregular days', () => {
    const rows = [
      tx('2026-06-03', 89.0, 'Swisscom AG'),
      tx('2026-07-06', 91.5, 'Swisscom AG'),
      tx('2026-08-04', 89.9, 'Swisscom AG'),
    ];
    const [s] = detectRecurring(rows, [], now);
    expect(s.cycle).toBe('monthly');
    expect(s.cat).toBe('telecom');
    expect(s.amount).toBeCloseTo(89.9, 1);
  });

  it('separates a one-off from the recurring amount at the same merchant', () => {
    const rows = [
      tx('2026-07-01', 12.9, 'Spotify'),
      tx('2026-08-01', 12.9, 'Spotify'),
      tx('2026-08-14', 4.99, 'Spotify'),
      tx('2026-09-01', 12.9, 'Spotify'),
    ];
    const out = detectRecurring(rows, [], now);
    expect(out).toHaveLength(1);
    expect(out[0].amount).toBe(12.9);
  });

  it('detects quarterly and yearly rhythms', () => {
    const rows = [
      tx('2025-09-10', 420, 'Helsana Praemie'),
      tx('2025-12-10', 420, 'Helsana Praemie'),
      tx('2026-03-10', 420, 'Helsana Praemie'),
      tx('2026-06-10', 420, 'Helsana Praemie'),
      tx('2025-09-01', 3600, 'SBB GA Jahresabo'),
      tx('2026-09-01', 3650, 'SBB GA Jahresabo'),
    ];
    const out = detectRecurring(rows, [], now);
    expect(out.find((s) => s.name.startsWith('SBB'))?.cycle).toBe('yearly');
    expect(out.find((s) => s.name.startsWith('Helsana'))?.cycle).toBe('quarterly');
  });

  it('ignores charges that stopped, singles, and income', () => {
    const rows = [
      tx('2025-01-05', 9.9, 'Old Gym'),
      tx('2025-02-05', 9.9, 'Old Gym'),
      tx('2026-09-01', 55, 'One off'),
      tx('2026-08-25', 5000, 'Salary', 'income'),
      tx('2026-09-25', 5000, 'Salary', 'income'),
    ];
    expect(detectRecurring(rows, [], now)).toHaveLength(0);
  });

  it('skips charges already tracked as subscriptions', () => {
    const rows = [
      tx('2026-07-05', 17.9, 'NETFLIX.COM'),
      tx('2026-08-05', 17.9, 'NETFLIX.COM'),
      tx('2026-09-05', 17.9, 'NETFLIX.COM'),
    ];
    const existing: Subscription[] = [
      { id: 'x', name: 'Netflix', amount: 17.9, cycle: 'monthly', day: 5, cat: 'media', createdAt: '' },
    ];
    expect(detectRecurring(rows, existing, now)).toHaveLength(0);
  });
});
