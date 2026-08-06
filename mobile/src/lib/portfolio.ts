import type { PortfolioSummary, PublicAccount } from '../api/types';
import { toNumber } from './format';

/**
 * The aggregate endpoint sums every source into a single figure using fields
 * named `usdValue` / `valueUsd`, so USD is the honest reading of it today. It is
 * read from `portfolio.currency` first so the UI follows automatically when the
 * backend adds FX normalization (already on the server roadmap).
 */
export function portfolioCurrency(portfolio: PortfolioSummary | undefined): string {
  return portfolio?.currency?.toUpperCase() || 'USD';
}

/**
 * Distinct currencies the user actually holds. When this is more than the
 * aggregate currency, the total is a mix and the UI says so rather than
 * implying a converted figure.
 */
export function mixedCurrencies(
  accounts: PublicAccount[] | undefined,
  aggregateCurrency: string,
): string[] {
  const codes = new Set<string>();
  for (const account of accounts ?? []) {
    const code = account.currency?.toUpperCase();
    if (code && code !== aggregateCurrency) codes.add(code);
  }
  return [...codes].sort();
}

/** Groups balances by asset so the same ticker held in two accounts merges. */
export function allocationByAsset(portfolio: PortfolioSummary | undefined) {
  const totals = new Map<string, { value: number; accounts: Set<string> }>();
  for (const asset of portfolio?.assets ?? []) {
    const value = toNumber(asset.usdValue);
    if (value <= 0) continue;
    const entry = totals.get(asset.asset) ?? { value: 0, accounts: new Set<string>() };
    entry.value += value;
    if (asset.accountLabel) entry.accounts.add(asset.accountLabel);
    totals.set(asset.asset, entry);
  }
  return [...totals.entries()]
    .map(([label, entry]) => ({
      label,
      value: entry.value,
      sublabel:
        entry.accounts.size > 1
          ? `${entry.accounts.size} accounts`
          : [...entry.accounts][0],
    }))
    .sort((a, b) => b.value - a.value);
}

/** Allocation by source account, which is how the Sources section reads. */
export function allocationBySource(portfolio: PortfolioSummary | undefined) {
  return (portfolio?.sources ?? [])
    .filter((source) => source.valueUsd > 0)
    .map((source) => ({
      label: source.label,
      value: source.valueUsd,
      sublabel: source.provider,
    }))
    .sort((a, b) => b.value - a.value);
}

/** Per-source errors, used for the partial-failure banner. */
export function sourceProblems(portfolio: PortfolioSummary | undefined): string[] {
  return (portfolio?.sources ?? [])
    .filter((source) => source.error)
    .map((source) => `${source.label}: ${source.error}`);
}

/**
 * The API reports day change as a value-weighted percentage only, so the dollar
 * figure is derived. Shown alongside the percentage the way Stake and Yahoo
 * Finance present a day move.
 */
export function dayChange(portfolio: PortfolioSummary | undefined) {
  const total = toNumber(portfolio?.totalValue);
  const percent = toNumber(portfolio?.pnl24h);
  return {
    total,
    percent,
    amount: total * (percent / 100),
    positive: percent >= 0,
  };
}
