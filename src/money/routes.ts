import { Router, Request, Response } from 'express';
import { tenantFor } from '../users/tenant';
import {
  INCOME_CATEGORIES,
  SPEND_CATEGORIES,
  SUB_CATEGORIES,
  spendCat,
} from './categories';
import { detectRecurring, suggestCategory } from './detect';
import { parseStatement } from './import';
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

/** Every handler resolves the caller's own ledger from the request. */
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
    let rows = tenantFor(req).money.listTransactions();
    if (from) rows = rows.filter((t) => t.date >= from);
    if (to) rows = rows.filter((t) => t.date <= to);
    res.json({ transactions: rows });
  });

  /** Category guess for a note, so the form can fill itself in as you type. */
  router.get('/categorize', (req: Request, res: Response) => {
    const note = typeof req.query.note === 'string' ? req.query.note : '';
    const kind: TxKind = req.query.kind === 'income' ? 'income' : 'spend';
    res.json({ category: suggestCategory(note, kind) });
  });

  router.post('/transactions', (req: Request, res: Response) => {
    const body = req.body as {
      date?: string;
      kind?: TxKind;
      amount?: number;
      category?: string;
      note?: string;
    };
    const kind: TxKind = body.kind || 'spend';
    const wantsGuess = !body.category || body.category === 'auto';
    try {
      const row = tenantFor(req).money.addTransaction({
        date: body.date || new Date().toISOString().slice(0, 10),
        kind,
        amount: Number(body.amount),
        category: wantsGuess
          ? suggestCategory(body.note, kind) ?? (kind === 'income' ? 'other-income' : 'other')
          : String(body.category),
        note: body.note,
      });
      res.status(201).json(row);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Invalid transaction',
      });
    }
  });

  /**
   * Bank statement import: paste or upload a CSV, get transactions back
   * already categorised. Rows identical to an existing transaction (same
   * day, kind, amount, and note) are skipped so re-importing is safe.
   */
  router.post('/import', (req: Request, res: Response) => {
    const body = req.body as { text?: string };
    const text = typeof body.text === 'string' ? body.text : '';
    if (!text.trim()) {
      return res.status(400).json({ error: 'Paste or upload a CSV statement first.' });
    }
    if (text.length > 2_000_000) {
      return res.status(413).json({ error: 'That file is too large — split it by month.' });
    }
    const money = tenantFor(req).money;
    const parsed = parseStatement(text);
    // A row is a duplicate only while the ledger still holds an unmatched
    // copy of it, so two real parking charges on the same day both survive
    // but re-importing last month's file adds nothing.
    const sigOf = (t: { date: string; kind: string; amount: number; note?: string }) =>
      `${t.date}|${t.kind}|${t.amount}|${(t.note || '').toLowerCase()}`;
    const spare = new Map<string, number>();
    for (const t of money.listTransactions()) {
      const sig = sigOf(t);
      spare.set(sig, (spare.get(sig) || 0) + 1);
    }
    const fresh: typeof parsed.rows = [];
    let skipped = 0;
    for (const row of parsed.rows) {
      const sig = sigOf(row);
      const left = spare.get(sig) || 0;
      if (left > 0) {
        spare.set(sig, left - 1);
        skipped++;
      } else {
        fresh.push(row);
      }
    }
    try {
      money.addTransactions(
        fresh.map((row) => ({
          date: row.date,
          kind: row.kind,
          amount: row.amount,
          category: row.category,
          note: row.note || undefined,
        })),
      );
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : 'Could not save the statement',
      });
    }
    res.json({
      imported: fresh.length,
      skipped,
      unreadable: parsed.errors.length,
      errors: parsed.errors.slice(0, 5),
      mapping: parsed.mapping,
    });
  });

  router.delete('/transactions/:id', (req: Request, res: Response) => {
    const ok = tenantFor(req).money.removeTransaction(req.params.id);
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
    const windowByCat = new Map<string, number>();

    for (const t of tenantFor(req).money.listTransactions()) {
      const key = t.date.slice(0, 7);
      const bucket = byKey.get(key);
      if (!bucket) continue;
      if (t.kind === 'income') bucket.income += t.amount;
      else bucket.spend += t.amount;
      if (t.kind === 'spend') {
        windowByCat.set(t.category, (windowByCat.get(t.category) || 0) + t.amount);
        if (key === latest.key) {
          spendByCat.set(t.category, (spendByCat.get(t.category) || 0) + t.amount);
        }
      }
    }

    // Monthly average per category over the window, for budget targets.
    const averages: Record<string, number> = {};
    for (const [id, total] of windowByCat) averages[id] = total / months;

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
      averages,
      hasActivity,
      retrievedAt: new Date().toISOString(),
    });
  });

  router.get('/budgets', (req: Request, res: Response) => {
    res.json({ budgets: tenantFor(req).money.getBudgets() });
  });

  /** PUT { budgets: { [categoryId]: monthlyAmount | null } } — null clears. */
  router.put('/budgets', (req: Request, res: Response) => {
    const body = req.body as { budgets?: Record<string, number | null> };
    if (!body?.budgets || typeof body.budgets !== 'object' || Array.isArray(body.budgets)) {
      return res.status(400).json({ error: 'budgets must be an object of category → amount' });
    }
    try {
      res.json({ budgets: tenantFor(req).money.setBudgets(body.budgets) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get('/subscriptions', (req: Request, res: Response) => {
    res.json({
      subscriptions: tenantFor(req).money.listSubscriptions(),
      categories: SUB_CATEGORIES,
    });
  });

  /** Recurring charges spotted in the ledger that are not tracked yet. */
  router.get('/subscriptions/suggestions', (req: Request, res: Response) => {
    const money = tenantFor(req).money;
    res.json({
      suggestions: detectRecurring(money.listTransactions(), money.listSubscriptions()),
      retrievedAt: new Date().toISOString(),
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
      const row = tenantFor(req).money.addSubscription({
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
    const ok = tenantFor(req).money.removeSubscription(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ success: true });
  });

  return router;
}
