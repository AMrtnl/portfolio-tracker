import { Router, Request, Response } from 'express';
import {
  INCOME_CATEGORIES,
  SPEND_CATEGORIES,
  SUB_CATEGORIES,
  spendCat,
} from './categories';
import { moneyStore } from './store';
import type { BillingCycle, TxKind } from './types';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function createMoneyRouter(): Router {
  const router = Router();

  router.get('/categories', (_req: Request, res: Response) => {
    res.json({
      spend: SPEND_CATEGORIES,
      income: INCOME_CATEGORIES,
      subscriptions: SUB_CATEGORIES,
    });
  });

  router.get('/transactions', (req: Request, res: Response) => {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    let rows = moneyStore.listTransactions();
    if (from) rows = rows.filter((t) => t.date >= from);
    if (to) rows = rows.filter((t) => t.date <= to);
    res.json({ transactions: rows });
  });

  router.post('/transactions', (req: Request, res: Response) => {
    const body = req.body as {
      date?: string;
      kind?: TxKind;
      amount?: number;
      category?: string;
      note?: string;
    };
    try {
      const row = moneyStore.addTransaction({
        date: body.date || new Date().toISOString().slice(0, 10),
        kind: body.kind || 'spend',
        amount: Number(body.amount),
        category: body.category || 'other',
        note: body.note,
      });
      res.status(201).json(row);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Invalid transaction',
      });
    }
  });

  router.delete('/transactions/:id', (req: Request, res: Response) => {
    const ok = moneyStore.removeTransaction(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ success: true });
  });

  router.get('/cashflow', (req: Request, res: Response) => {
    const months = Math.min(
      24,
      Math.max(1, parseInt(String(req.query.months || '6'), 10) || 6),
    );
    const now = new Date();
    const buckets: Array<{
      key: string;
      label: string;
      year: number;
      month: number;
      income: number;
      spend: number;
    }> = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: monthKey(d),
        label: MONTH_LABELS[d.getMonth()],
        year: d.getFullYear(),
        month: d.getMonth(),
        income: 0,
        spend: 0,
      });
    }
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    const latest = buckets[buckets.length - 1];
    const spendByCat = new Map<string, number>();

    for (const t of moneyStore.listTransactions()) {
      const key = t.date.slice(0, 7);
      const bucket = byKey.get(key);
      if (!bucket) continue;
      if (t.kind === 'income') bucket.income += t.amount;
      else bucket.spend += t.amount;
      if (t.kind === 'spend' && key === latest.key) {
        spendByCat.set(t.category, (spendByCat.get(t.category) || 0) + t.amount);
      }
    }

    const categories = [...spendByCat.entries()]
      .map(([id, amount]) => {
        const cat = spendCat(id);
        return { id, name: cat.name, color: cat.color, amount };
      })
      .sort((a, b) => b.amount - a.amount);

    const hasActivity = buckets.some((b) => b.income > 0 || b.spend > 0);

    res.json({
      months: buckets,
      categories,
      hasActivity,
      retrievedAt: new Date().toISOString(),
    });
  });

  router.get('/subscriptions', (_req: Request, res: Response) => {
    res.json({
      subscriptions: moneyStore.listSubscriptions(),
      categories: SUB_CATEGORIES,
    });
  });

  router.post('/subscriptions', (req: Request, res: Response) => {
    const body = req.body as {
      name?: string;
      plan?: string;
      amount?: number;
      cycle?: BillingCycle;
      day?: number;
      month?: number;
      cat?: string;
    };
    try {
      const row = moneyStore.addSubscription({
        name: body.name || '',
        plan: body.plan,
        amount: Number(body.amount),
        cycle: body.cycle || 'monthly',
        day: Number(body.day),
        month: body.month,
        cat: body.cat || 'essentials',
      });
      res.status(201).json(row);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Invalid subscription',
      });
    }
  });

  router.delete('/subscriptions/:id', (req: Request, res: Response) => {
    const ok = moneyStore.removeSubscription(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ success: true });
  });

  return router;
}
