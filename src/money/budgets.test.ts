import fs from 'fs';
import os from 'os';
import path from 'path';
import { MoneyStore } from './store';

describe('budget targets', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-budgets-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('sets, clears, and persists monthly targets per category', () => {
    const store = new MoneyStore(dir);
    expect(store.getBudgets()).toEqual({});
    expect(store.setBudgets({ groceries: 600, leisure: '250' as never })).toEqual({
      groceries: 600,
      leisure: 250,
    });
    expect(store.setBudgets({ leisure: null, ' transport ': 120 })).toEqual({
      groceries: 600,
      transport: 120,
    });

    const reloaded = new MoneyStore(dir);
    expect(reloaded.getBudgets()).toEqual({ groceries: 600, transport: 120 });
    expect(fs.existsSync(path.join(dir, 'money.json'))).toBe(true);
  });

  it('rejects negative or non-numeric targets without saving', () => {
    const store = new MoneyStore(dir);
    expect(() => store.setBudgets({ groceries: -1 })).toThrow(/groceries/);
    expect(() => store.setBudgets({ groceries: 'lots' as never })).toThrow(/groceries/);
    expect(store.getBudgets()).toEqual({});
  });

  it('keeps two directories apart', () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-budgets-other-'));
    try {
      new MoneyStore(dir).setBudgets({ groceries: 600 });
      expect(new MoneyStore(other).getBudgets()).toEqual({});
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });
});
