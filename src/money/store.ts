import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  BillingCycle,
  MoneyFile,
  MoneyTransaction,
  Subscription,
  TxKind,
} from './types';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'money.json');

function emptyFile(): MoneyFile {
  return { version: 1, transactions: [], subscriptions: [] };
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
}

export class MoneyStore {
  private data: MoneyFile;

  constructor() {
    this.data = this.load();
  }

  private load(): MoneyFile {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as MoneyFile;
        if (parsed?.version === 1 && Array.isArray(parsed.transactions)) {
          return {
            version: 1,
            transactions: parsed.transactions,
            subscriptions: Array.isArray(parsed.subscriptions)
              ? parsed.subscriptions
              : [],
          };
        }
      }
    } catch (err) {
      console.warn('⚠️  Could not read money store, starting fresh:', err);
    }
    return emptyFile();
  }

  private save(): void {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf8');
  }

  listTransactions(): MoneyTransaction[] {
    return [...this.data.transactions].sort((a, b) => b.date.localeCompare(a.date));
  }

  addTransaction(input: {
    date: string;
    kind: TxKind;
    amount: number;
    category: string;
    note?: string;
  }): MoneyTransaction {
    if (!isIsoDate(input.date)) {
      throw new Error('date must be YYYY-MM-DD');
    }
    if (input.kind !== 'income' && input.kind !== 'spend') {
      throw new Error('kind must be income or spend');
    }
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('amount must be a positive number');
    }
    const category = String(input.category || '').trim();
    if (!category) throw new Error('category is required');

    const row: MoneyTransaction = {
      id: crypto.randomUUID(),
      date: input.date,
      kind: input.kind,
      amount,
      category,
      note: input.note?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    this.data.transactions.push(row);
    this.save();
    return row;
  }

  removeTransaction(id: string): boolean {
    const before = this.data.transactions.length;
    this.data.transactions = this.data.transactions.filter((t) => t.id !== id);
    if (this.data.transactions.length < before) {
      this.save();
      return true;
    }
    return false;
  }

  listSubscriptions(): Subscription[] {
    return [...this.data.subscriptions];
  }

  addSubscription(input: {
    name: string;
    plan?: string;
    amount: number;
    cycle: BillingCycle;
    day: number;
    month?: number;
    cat: string;
  }): Subscription {
    const name = String(input.name || '').trim();
    if (!name) throw new Error('name is required');
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('amount must be a positive number');
    }
    const cycle = input.cycle;
    if (cycle !== 'monthly' && cycle !== 'quarterly' && cycle !== 'yearly') {
      throw new Error('cycle must be monthly, quarterly, or yearly');
    }
    const day = Math.round(Number(input.day));
    if (!Number.isFinite(day) || day < 1 || day > 31) {
      throw new Error('day must be between 1 and 31');
    }
    let month = input.month;
    if (cycle !== 'monthly') {
      const m = month == null ? new Date().getMonth() : Number(month);
      if (!Number.isFinite(m) || m < 0 || m > 11) {
        throw new Error('month must be 0–11');
      }
      month = m;
    }

    const row: Subscription = {
      id: crypto.randomUUID(),
      name,
      plan: input.plan?.trim() || undefined,
      amount,
      cycle,
      day,
      month,
      cat: String(input.cat || 'essentials').trim() || 'essentials',
      createdAt: new Date().toISOString(),
    };
    this.data.subscriptions.push(row);
    this.save();
    return row;
  }

  removeSubscription(id: string): boolean {
    const before = this.data.subscriptions.length;
    this.data.subscriptions = this.data.subscriptions.filter((s) => s.id !== id);
    if (this.data.subscriptions.length < before) {
      this.save();
      return true;
    }
    return false;
  }
}

export const moneyStore = new MoneyStore();
