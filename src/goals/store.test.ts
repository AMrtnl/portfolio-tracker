import fs from 'fs';
import os from 'os';
import path from 'path';
import { GoalsStore, addGoal, listGoals, removeGoal, updateGoal } from './store';

describe('goals store', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-goals-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds, updates, and removes goals, persisting across a fresh instance', () => {
    const first = new GoalsStore(dir);
    const goal = addGoal(first, {
      name: '  Emergency fund ',
      targetAmount: '30000',
      targetDate: '2027-06-01',
      accountIds: ['a1', 'a1', ' a2 '],
      monthlyContribution: 500,
      expectedReturn: 0.01,
    });
    expect(goal).toMatchObject({
      name: 'Emergency fund',
      targetAmount: 30000,
      targetDate: '2027-06-01',
      accountIds: ['a1', 'a2'],
      monthlyContribution: 500,
      expectedReturn: 0.01,
    });

    const updated = updateGoal(first, goal.id, { monthlyContribution: 750, targetDate: null });
    expect(updated).toMatchObject({ name: 'Emergency fund', monthlyContribution: 750 });
    expect(updated?.targetDate).toBeUndefined();

    const second = new GoalsStore(dir);
    expect(listGoals(second)).toHaveLength(1);
    expect(listGoals(second)[0].monthlyContribution).toBe(750);
    expect(removeGoal(second, goal.id)).toBe(true);
    expect(removeGoal(second, goal.id)).toBe(false);
    expect(listGoals(new GoalsStore(dir))).toEqual([]);
  });

  it('defaults contribution and return to zero', () => {
    expect(addGoal(new GoalsStore(dir), { name: 'Car', targetAmount: 12000 })).toMatchObject({
      accountIds: [],
      monthlyContribution: 0,
      expectedReturn: 0,
    });
  });

  it('rejects bad input without writing anything', () => {
    const store = new GoalsStore(dir);
    expect(() => addGoal(store, { targetAmount: 100 })).toThrow(/name/);
    expect(() => addGoal(store, { name: 'x', targetAmount: -5 })).toThrow(/targetAmount/);
    expect(() => addGoal(store, { name: 'x', targetAmount: 5, targetDate: 'June' })).toThrow(
      /targetDate/,
    );
    expect(() => addGoal(store, { name: 'x', targetAmount: 5, accountIds: 'a1' })).toThrow(
      /accountIds/,
    );
    expect(() => addGoal(store, { name: 'x', targetAmount: 5, expectedReturn: 2 })).toThrow(
      /expectedReturn/,
    );
    expect(() => addGoal(store, { name: 'x', targetAmount: 5, monthlyContribution: -1 })).toThrow(
      /monthlyContribution/,
    );
    expect(updateGoal(store, 'missing', { name: 'y' })).toBeNull();
    expect(listGoals(store)).toEqual([]);
    expect(fs.existsSync(path.join(dir, 'goals.json'))).toBe(false);
  });

  it('keeps two directories apart', () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-goals-other-'));
    try {
      addGoal(new GoalsStore(dir), { name: 'Mine', targetAmount: 1 });
      expect(listGoals(new GoalsStore(other))).toEqual([]);
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });
});
