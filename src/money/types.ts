export type TxKind = 'income' | 'spend';
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly';

export interface MoneyTransaction {
  id: string;
  date: string;
  kind: TxKind;
  amount: number;
  category: string;
  note?: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  name: string;
  plan?: string;
  amount: number;
  cycle: BillingCycle;
  /** Day of month the charge falls on (1–31). */
  day: number;
  /** 0–11, required for yearly and used as the quarter anchor for quarterly. */
  month?: number;
  cat: string;
  createdAt: string;
}

export interface MoneyFile {
  version: 1;
  transactions: MoneyTransaction[];
  subscriptions: Subscription[];
}
