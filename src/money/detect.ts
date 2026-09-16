import type { BillingCycle, MoneyTransaction, Subscription, TxKind } from './types';

/* ------------------------------------------------------------------ *
 * Automatic categorisation
 *
 * Keyword rules over the transaction note. Swiss and general European
 * merchants first, since manual and CSV-imported statements are where
 * this runs; nothing here is exhaustive, it only has to beat "Other".
 * ------------------------------------------------------------------ */

interface CategoryRule {
  category: string;
  keywords: string[];
}

const SPEND_RULES: CategoryRule[] = [
  {
    category: 'groceries',
    keywords: [
      'migros', 'coop', 'denner', 'aldi', 'lidl', 'volg', 'spar', 'manor food',
      'grocery', 'groceries', 'supermarket', 'supermarché', 'lebensmittel', 'alnatura',
      'globus delicatessa', 'farmy', 'le shop',
    ],
  },
  {
    category: 'housing',
    keywords: [
      'rent', 'miete', 'loyer', 'mortgage', 'hypothek', 'hypothèque', 'hypotheque',
      'nebenkosten', 'landlord', 'régie', 'regie', 'immobilien', 'wincasa', 'livit',
    ],
  },
  {
    category: 'insurance',
    keywords: [
      'insurance', 'versicherung', 'assurance', 'helsana', 'css', 'swica', 'sanitas',
      'axa', 'mobiliar', 'allianz', 'krankenkasse', 'concordia', 'visana', 'assura',
      'groupe mutuel', 'zurich insurance', 'baloise', 'generali', 'vaudoise',
    ],
  },
  {
    category: 'subscriptions',
    keywords: [
      'netflix', 'spotify', 'apple.com', 'apple music', 'icloud', 'apple tv', 'youtube',
      'disney', 'swisscom', 'sunrise', 'salt', 'wingo', 'yallo', 'upc', 'adobe',
      'microsoft 365', 'office 365', 'github', 'dropbox', 'notion', 'chatgpt', 'openai',
      'amazon prime', 'prime video', 'hbo', 'canal+', 'sky', 'nzz', 'tages-anzeiger',
      'le temps', 'gym', 'fitness', 'activ fitness', 'basefit', 'audible', 'kindle',
      'playstation', 'xbox', 'nintendo', 'twitch', 'patreon', 'strava', 'duolingo',
    ],
  },
  {
    category: 'transport',
    keywords: [
      'sbb', 'cff', 'ffs', 'zvv', 'tpg', 'vbz', 'bvb', 'tl ', 'postauto', 'uber', 'bolt',
      'taxi', 'shell', 'esso', 'bp', 'avia', 'socar', 'tamoil', 'migrol', 'agrola',
      'parking', 'parkhaus', 'parkplatz', 'mobility', 'swiss international', 'easyjet',
      'lufthansa', 'ryanair', 'train', 'fuel', 'benzin', 'essence', 'diesel', 'garage',
      'vignette', 'autobahn', 'publibike', 'lime', 'tier', 'voi',
    ],
  },
  {
    category: 'leisure',
    keywords: [
      'restaurant', 'ristorante', 'pizza', 'pizzeria', 'burger', 'sushi', 'café', 'cafe',
      'coffee', 'kaffee', 'starbucks', 'bar', 'pub', 'brasserie', 'bistro', 'cinema',
      'kino', 'pathé', 'pathe', 'theater', 'théâtre', 'concert', 'ticketcorner',
      'hotel', 'booking.com', 'airbnb', 'holiday', 'vacances', 'ferien', 'museum',
      'musée', 'zoo', 'ski', 'skilift', 'bergbahn', 'wellness', 'spa', 'bowling',
      'mcdonald', 'burger king', 'kfc', 'takeaway', 'uber eats', 'smood', 'eat.ch',
    ],
  },
];

const INCOME_RULES: CategoryRule[] = [
  {
    category: 'salary',
    keywords: ['salary', 'salaire', 'lohn', 'gehalt', 'payroll', 'wage', 'wages', 'stipend', 'salario'],
  },
  {
    category: 'bonus',
    keywords: ['bonus', 'prime', 'gratification', '13th', '13.', 'commission', 'incentive'],
  },
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word-bounded alternation: "css" never matches "access", "bp" never "bpm". */
function wordRegex(words: string[]): RegExp {
  const alternatives = words.map((k) => escapeRegex(k.trim()));
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}])`, 'iu');
}

const compiled = new Map<CategoryRule, RegExp>();
function ruleRegex(rule: CategoryRule): RegExp {
  let rx = compiled.get(rule);
  if (!rx) {
    rx = wordRegex(rule.keywords);
    compiled.set(rule, rx);
  }
  return rx;
}

/** Best-guess category id for a note, or null when nothing matches. */
export function suggestCategory(note: string | undefined | null, kind: TxKind): string | null {
  const text = (note || '').trim();
  if (!text) return null;
  const rules = kind === 'income' ? INCOME_RULES : SPEND_RULES;
  for (const rule of rules) {
    if (ruleRegex(rule).test(text)) return rule.category;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Recurring-charge detection
 * ------------------------------------------------------------------ */

export interface RecurringSuggestion {
  /** Stable key so the client can remember dismissals: merchant|cycle. */
  key: string;
  name: string;
  amount: number;
  cycle: BillingCycle;
  day: number;
  month?: number;
  cat: string;
  /** Spend category of the source transactions. */
  category: string;
  occurrences: number;
  firstDate: string;
  lastDate: string;
}

const TELECOM = wordRegex([
  'swisscom', 'sunrise', 'salt', 'wingo', 'yallo', 'upc', 'init7', 'quickline',
]);
const SOFTWARE = wordRegex([
  'adobe', 'microsoft', 'microsoft 365', 'office 365', 'github', 'dropbox', 'notion',
  'chatgpt', 'openai', 'icloud', 'google one', 'google storage', 'figma', '1password',
  'setapp', 'jetbrains',
]);
const MEDIA = wordRegex([
  'netflix', 'spotify', 'apple music', 'apple tv', 'youtube', 'disney', 'amazon prime',
  'prime video', 'hbo', 'canal+', 'sky', 'nzz', 'tages-anzeiger', 'le temps', 'audible',
  'kindle', 'playstation', 'xbox', 'nintendo', 'twitch', 'patreon',
]);

/** Which subscription bucket a detected charge belongs to. */
export function subscriptionCategoryFor(note: string, spendCategory: string): string {
  if (TELECOM.test(note)) return 'telecom';
  if (SOFTWARE.test(note)) return 'software';
  if (MEDIA.test(note)) return 'media';
  switch (spendCategory) {
    case 'transport':
      return 'transport';
    case 'housing':
      return 'home';
    case 'subscriptions':
      return 'media';
    case 'insurance':
    case 'groceries':
    case 'leisure':
    default:
      return 'essentials';
  }
}

/** Collapse a note to a merchant key: letters only, first three words. */
export function merchantKey(note: string): string {
  return note
    .toLowerCase()
    .replace(/[\p{N}]+/gu, ' ')
    .replace(/[^\p{L}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3)
    .join(' ');
}

function displayName(note: string): string {
  const cleaned = note
    .replace(/\b\d{2}[./-]\d{2}[./-]\d{2,4}\b/g, '')
    .replace(/\b\d{4,}\b/g, '')
    .replace(/[*#_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').slice(0, 4).join(' ');
  return words.length > 2 ? words : note.trim();
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
}

function median(values: number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function cycleFor(medianGap: number): BillingCycle | null {
  if (medianGap >= 24 && medianGap <= 38) return 'monthly';
  if (medianGap >= 80 && medianGap <= 100) return 'quarterly';
  if (medianGap >= 340 && medianGap <= 390) return 'yearly';
  return null;
}

const CYCLE_DAYS: Record<BillingCycle, number> = { monthly: 30, quarterly: 91, yearly: 365 };

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  let best = values[values.length - 1];
  let bestCount = 0;
  for (const v of values) {
    const c = (counts.get(v) || 0) + 1;
    counts.set(v, c);
    if (c > bestCount || (c === bestCount && v === values[values.length - 1])) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

/**
 * Find charges that repeat at a monthly, quarterly, or yearly rhythm and
 * are not already tracked as a subscription. Same merchant, amount within
 * 7 %, at least two occurrences, and still active (last charge within two
 * cycles of `now`).
 */
export function detectRecurring(
  transactions: MoneyTransaction[],
  existing: Subscription[] = [],
  now: Date = new Date(),
): RecurringSuggestion[] {
  const groups = new Map<string, MoneyTransaction[]>();
  for (const t of transactions) {
    if (t.kind !== 'spend' || !t.note) continue;
    const key = merchantKey(t.note);
    if (key.length < 2) continue;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  const existingKeys = new Set(existing.map((s) => merchantKey(s.name)));
  const out: RecurringSuggestion[] = [];

  for (const [key, list] of groups) {
    list.sort((a, b) => a.date.localeCompare(b.date));

    // Cluster by amount so "Netflix 17.90" and a one-off "Netflix 4.99" split.
    const clusters: MoneyTransaction[][] = [];
    for (const t of [...list].sort((a, b) => a.amount - b.amount)) {
      const last = clusters[clusters.length - 1];
      if (last && Math.abs(t.amount - last[0].amount) / last[0].amount <= 0.07) last.push(t);
      else clusters.push([t]);
    }

    for (const cluster of clusters) {
      if (cluster.length < 2) continue;
      cluster.sort((a, b) => a.date.localeCompare(b.date));
      const gaps = cluster.slice(1).map((t, i) => daysBetween(cluster[i].date, t.date));
      const cycle = cycleFor(median(gaps));
      if (!cycle) continue;
      const last = cluster[cluster.length - 1];
      const age = daysBetween(last.date, now.toISOString().slice(0, 10));
      if (age > CYCLE_DAYS[cycle] * 2 + 10) continue;

      const amount = Math.round(median(cluster.map((t) => t.amount)) * 100) / 100;
      const isTracked =
        existingKeys.has(key) ||
        existing.some(
          (s) =>
            s.cycle === cycle &&
            Math.abs(s.amount - amount) / amount <= 0.07 &&
            merchantKey(s.name).split(' ')[0] === key.split(' ')[0],
        );
      if (isTracked) continue;

      const lastDate = new Date(`${last.date}T00:00:00`);
      out.push({
        key: `${key}|${cycle}`,
        name: displayName(last.note || key),
        amount,
        cycle,
        day: mode(cluster.map((t) => Number(t.date.slice(8, 10)))),
        month: cycle === 'monthly' ? undefined : lastDate.getMonth(),
        cat: subscriptionCategoryFor(last.note || '', last.category),
        category: last.category,
        occurrences: cluster.length,
        firstDate: cluster[0].date,
        lastDate: last.date,
      });
    }
  }

  return out.sort((a, b) => b.amount - a.amount);
}
