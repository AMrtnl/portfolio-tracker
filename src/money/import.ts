import { suggestCategory } from './detect';
import type { TxKind } from './types';

/* ------------------------------------------------------------------ *
 * Bank statement import
 *
 * Banks export CSV in every dialect there is: semicolons or commas,
 * dd.mm.yyyy or ISO dates, "1'234.50" or "1.234,50", one signed amount
 * column or separate debit/credit columns, with or without a header row.
 * This parser guesses each of those from the content and never throws —
 * rows it cannot read are reported back, not dropped silently.
 * ------------------------------------------------------------------ */

export interface ImportedRow {
  date: string;
  kind: TxKind;
  amount: number;
  note: string;
  category: string;
}

export interface ParseResult {
  rows: ImportedRow[];
  /** Lines that could not be read, with the reason. */
  errors: string[];
  /** Which columns were used, for the confirmation UI. */
  mapping: { date: number; amount?: number; debit?: number; credit?: number; note?: number };
}

const DATE_HEADERS = ['date', 'datum', 'buchung', 'buchungsdatum', 'valuta', 'booking', 'transaction date', 'trade date', 'posted'];
const AMOUNT_HEADERS = ['amount', 'betrag', 'montant', 'value', 'sum', 'importo'];
const DEBIT_HEADERS = ['debit', 'soll', 'débit', 'belastung', 'withdrawal', 'out'];
const CREDIT_HEADERS = ['credit', 'haben', 'crédit', 'gutschrift', 'deposit', 'in'];
const NOTE_HEADERS = [
  'description', 'text', 'buchungstext', 'libellé', 'libelle', 'details', 'detail', 'memo',
  'narrative', 'payee', 'beschreibung', 'mitteilung', 'communication', 'reference', 'name',
  'merchant', 'counterparty',
];

function detectDelimiter(line: string): string {
  const counts: Array<[string, number]> = [
    [';', (line.match(/;/g) || []).length],
    ['\t', (line.match(/\t/g) || []).length],
    [',', (line.match(/,/g) || []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

/** Minimal RFC-4180-ish splitter: quotes, doubled quotes, no newlines in cells. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** Accepts ISO, dd.mm.yyyy, dd/mm/yyyy, dd-mm-yyyy, and yyyy/mm/dd. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const a = Number(m[1]);
    const b = Number(m[2]);
    // Day-first unless that is impossible (Swiss and EU exports lead with the day).
    return a > 12 && b <= 12 ? iso(year, b, a) : b > 12 ? iso(year, a, b) : iso(year, b, a);
  }
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "1'234.50", "1.234,50", "-12,30", "(45.00)", "CHF 12.00" → number. */
export function parseAmount(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[A-Za-z€$£]+/g, '').replace(/[\s'’]/g, '');
  if (s.startsWith('-') || s.startsWith('−')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // The later separator is the decimal mark; the other is a thousands mark.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    s = decimals === 3 && s.indexOf(',') === lastComma ? s.replace(',', '') : s.replace(',', '.');
  }
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

function findHeader(cells: string[], names: string[]): number | undefined {
  const lower = cells.map((c) => c.toLowerCase());
  for (const n of names) {
    const exact = lower.findIndex((c) => c === n);
    if (exact > -1) return exact;
  }
  // Short names ("in", "out", "soll") only count as whole words, so "in"
  // never claims "Beginning balance"; longer ones may sit inside a phrase.
  for (const n of names) {
    const partial = lower.findIndex((c) =>
      n.length <= 4 ? c.split(/[^a-z]+/).includes(n) : c.includes(n),
    );
    if (partial > -1) return partial;
  }
  return undefined;
}

export function parseStatement(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const errors: string[] = [];
  const mapping: ParseResult['mapping'] = { date: -1 };
  if (lines.length === 0) return { rows: [], errors: ['The file is empty.'], mapping };

  const delimiter = detectDelimiter(lines[0]);
  const table = lines.map((l) => splitLine(l, delimiter));

  // Header detection: a first row where no cell parses as a date.
  const first = table[0];
  const headerLike = !first.some((c) => parseDate(c));
  let dataStart = 0;
  if (headerLike) {
    dataStart = 1;
    mapping.date = findHeader(first, DATE_HEADERS) ?? -1;
    mapping.amount = findHeader(first, AMOUNT_HEADERS);
    mapping.debit = findHeader(first, DEBIT_HEADERS);
    mapping.credit = findHeader(first, CREDIT_HEADERS);
    mapping.note = findHeader(first, NOTE_HEADERS);
    // "Amount in" / "Amount out" matches the amount rule and the credit rule
    // at once: a distinct debit/credit pair is the more specific reading and
    // wins; otherwise the lone column that collided is the amount column.
    const pair =
      mapping.debit != null && mapping.credit != null && mapping.debit !== mapping.credit;
    if (pair) {
      if (mapping.amount === mapping.debit || mapping.amount === mapping.credit) {
        mapping.amount = undefined;
      }
    } else {
      if (mapping.debit === mapping.amount) mapping.debit = undefined;
      if (mapping.credit === mapping.amount) mapping.credit = undefined;
    }
  }

  // Fall back to sniffing the first data row.
  const sample = table[dataStart] ?? [];
  if (mapping.date < 0) mapping.date = sample.findIndex((c) => parseDate(c) != null);
  if (mapping.amount == null && mapping.debit == null && mapping.credit == null) {
    const numeric = sample
      .map((c, i) => ({ i, ok: i !== mapping.date && parseAmount(c) != null && !parseDate(c) }))
      .filter((x) => x.ok)
      .map((x) => x.i);
    mapping.amount = numeric.length ? numeric[numeric.length - 1] : undefined;
  }
  if (mapping.note == null) {
    let best = -1;
    let bestLen = 0;
    sample.forEach((c, i) => {
      if (i === mapping.date || i === mapping.amount || i === mapping.debit || i === mapping.credit) return;
      if (parseAmount(c) != null && !/[A-Za-z]{3,}/.test(c)) return;
      if (c.length > bestLen) {
        best = i;
        bestLen = c.length;
      }
    });
    mapping.note = best > -1 ? best : undefined;
  }

  if (mapping.date < 0) {
    return { rows: [], errors: ['No date column found.'], mapping };
  }
  if (mapping.amount == null && mapping.debit == null && mapping.credit == null) {
    return { rows: [], errors: ['No amount column found.'], mapping };
  }

  const rows: ImportedRow[] = [];
  for (let r = dataStart; r < table.length; r++) {
    const cells = table[r];
    const date = parseDate(cells[mapping.date] ?? '');
    if (!date) {
      errors.push(`Line ${r + 1}: unreadable date "${cells[mapping.date] ?? ''}"`);
      continue;
    }
    let signed: number | null = null;
    if (mapping.amount != null) {
      signed = parseAmount(cells[mapping.amount] ?? '');
    }
    if (signed == null && (mapping.debit != null || mapping.credit != null)) {
      const debit = mapping.debit != null ? parseAmount(cells[mapping.debit] ?? '') : null;
      const credit = mapping.credit != null ? parseAmount(cells[mapping.credit] ?? '') : null;
      if (debit != null || credit != null) signed = (credit ?? 0) - Math.abs(debit ?? 0);
    }
    if (signed == null || signed === 0) {
      errors.push(`Line ${r + 1}: no amount`);
      continue;
    }
    const note = (mapping.note != null ? cells[mapping.note] : '') || '';
    const kind: TxKind = signed > 0 ? 'income' : 'spend';
    rows.push({
      date,
      kind,
      amount: Math.round(Math.abs(signed) * 100) / 100,
      note: note.slice(0, 120),
      category: suggestCategory(note, kind) ?? (kind === 'income' ? 'other-income' : 'other'),
    });
  }

  return { rows, errors, mapping };
}
