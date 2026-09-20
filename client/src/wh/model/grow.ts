import { useMemo } from 'react'
import { useDemo } from '@/wealth/DemoContext'
import { useConcentration } from '@/hooks/useAnalytics'
import { useMergedHoldings } from '@/wealth/useMergedHoldings'
import { DEMO_POSITION_META } from '@/wealth/demo'
import { FIXTURE } from './fixture'
import { useBook } from './book'
import type { IconName } from '@/wh/icons'
import { ICONS } from '@/wh/icons'

export type GrowKind = 'fund' | 'cash' | 'eth' | 'stock'

export interface EvidenceLine {
  icon: IconName
  label: string
  value: string
  tone?: 'gain' | 'owed'
}

export interface Opportunity {
  id: string
  rank: number
  kind: GrowKind
  title: string
  /** Always starts with "Because". */
  because: string
  savingPerYear?: number
  /** For an opportunity that lowers risk rather than saves money. */
  effect?: string
  evidence: EvidenceLine[]
  assumptions: EvidenceLine[]
  risks: string[]
  /** For the scenario chart: the modelled path with and without the change, in years. */
  scenario?: { years: number; withChange: number[]; currentPath: number[] }
  sample: boolean
}

export const GROW_ICON: Record<GrowKind, IconName> = {
  fund: ICONS.assetClass.funds,
  cash: ICONS.assetClass.cash,
  eth: ICONS.assetClass.crypto,
  stock: ICONS.assetClass.equities,
}

export const GROW_TINT: Record<GrowKind, string> = { fund: 'ultra', cash: 'gain', eth: 'night', stock: 'ultra' }

const CASH_TARGET = 40_000
const STAKING_PCT = 3.0
const COMPARABLE_FEE = 0.16

function scenario(principal: number, currentFee: number, newFee: number, returnPct: number, years: number) {
  const withChange: number[] = []
  const currentPath: number[] = []
  for (let y = 0; y <= years; y++) {
    withChange.push(principal * Math.pow(1 + (returnPct - newFee) / 100, y))
    currentPath.push(principal * Math.pow(1 + (returnPct - currentFee) / 100, y))
  }
  return { years, withChange, currentPath }
}

const fmtMoney = (n: number, unit: string) => `${unit} ${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(Math.round(n))}`

/** The sample's four opportunities, straight from the fixture, with the evidence the design shows. */
function sampleOpportunities(unit: string): Opportunity[] {
  return FIXTURE.grow.map((g) => {
    const ev = g.evidence
    const as = g.assumptions
    const evidence: EvidenceLine[] = []
    const assumptions: EvidenceLine[] = []
    if (ev) {
      evidence.push({ icon: ICONS.evidence.holdings, label: 'Holdings analysed', value: String(ev.holdingsAnalysed) })
      evidence.push({ icon: ICONS.grow.fees, label: 'Current weighted fee', value: `${ev.currentFeePct.toFixed(2)}%`, tone: 'owed' })
      evidence.push({ icon: ICONS.evidence.comparison, label: 'Comparable median', value: `${ev.comparableMedianPct.toFixed(2)}%` })
      evidence.push({ icon: ICONS.activity.transfer, label: 'Trading cost to switch', value: fmtMoney(ev.tradingCost, unit), tone: 'owed' })
    }
    if (as) {
      assumptions.push({ icon: ICONS.evidence.return, label: 'Expected return', value: `${as.returnPct.toFixed(1)}% a year` })
      assumptions.push({ icon: ICONS.evidence.horizon, label: 'Time horizon', value: `${as.years} years` })
      assumptions.push({ icon: ICONS.evidence.modelledGain, label: 'Modelled gain', value: `+${fmtMoney(as.modelledGain, unit)}`, tone: 'gain' })
      assumptions.push({ icon: ICONS.evidence.breakEven, label: 'Cost repaid in', value: `about ${as.breakEvenMonths} months` })
    }
    if (g.kind === 'cash') {
      evidence.push({ icon: ICONS.assetClass.cash, label: 'Cash across accounts', value: fmtMoney(102_100, unit) })
      evidence.push({ icon: ICONS.evidence.comparison, label: 'Your cash target', value: fmtMoney(CASH_TARGET, unit) })
      evidence.push({ icon: ICONS.grow.idleCash, label: 'Above target', value: fmtMoney(102_100 - CASH_TARGET, unit), tone: 'owed' })
      assumptions.push({ icon: ICONS.evidence.return, label: 'Modelled yield on the excess', value: '3.1% a year' })
      assumptions.push({ icon: ICONS.evidence.horizon, label: 'Time horizon', value: '12 months' })
    }
    if (g.kind === 'eth') {
      evidence.push({ icon: ICONS.assetClass.crypto, label: 'Ether on the Ledger', value: '10.4 ETH' })
      evidence.push({ icon: ICONS.grow.staking, label: 'Currently earning', value: '0.0%', tone: 'owed' })
      assumptions.push({ icon: ICONS.evidence.return, label: 'Staking yield modelled', value: `${STAKING_PCT.toFixed(1)}% a year` })
      assumptions.push({ icon: ICONS.evidence.breakEven, label: 'Lock-up', value: 'days to weeks to exit' })
    }
    if (g.kind === 'stock') {
      evidence.push({ icon: ICONS.assetClass.equities, label: 'Apple, held directly', value: fmtMoney(92_200, unit) })
      evidence.push({ icon: ICONS.assetClass.funds, label: 'Apple, inside two funds', value: 'about 3% more' })
      evidence.push({ icon: ICONS.grow.concentration, label: 'Share of invested portfolio', value: '18%', tone: 'owed' })
      assumptions.push({ icon: ICONS.evidence.comparison, label: 'A common ceiling per stock', value: '10%' })
    }
    return {
      id: String(g.rank),
      rank: g.rank,
      kind: g.kind,
      title: g.title,
      because: /^because\b/i.test(g.because) ? g.because : `Because ${g.because}`,
      savingPerYear: g.savingPerYear,
      effect: g.effect,
      evidence,
      assumptions,
      risks: g.risks ?? (g.kind === 'cash' ? ['Cash you may need soon should stay cash.', 'Yields move; the figure is today’s.', 'Results are modelled, not guaranteed.'] : g.kind === 'eth' ? ['Staked ether is locked for a period.', 'Validator and protocol risk apply.', 'Results are modelled, not guaranteed.'] : ['Selling can trigger taxes.', 'A concentrated bet can also keep paying off.', 'This is analysis, not advice.']),
      scenario: g.kind === 'fund' && ev && as ? scenario(412_000, ev.currentFeePct, ev.comparableMedianPct, as.returnPct, as.years) : undefined,
      sample: true,
    }
  })
}

/**
 * Things worth improving, each with its reason starting with "Because", its
 * evidence and its risks. Ranked by what they are worth a year. From the
 * fixture while the sample household is on; from the live book otherwise,
 * using only the rules the data can support.
 */
export function useGrow(): { opportunities: Opportunity[]; totalPerYear: number; loading: boolean } {
  const { enabled: sampleOn } = useDemo()
  const book = useBook()
  const holdings = useMergedHoldings()
  const { data: concentration } = useConcentration()
  return useMemo(() => {
    const unit = 'CHF'
    if (sampleOn && !book.hasLive) {
      const opportunities = sampleOpportunities(unit)
      return { opportunities, totalPerYear: opportunities.reduce((s, o) => s + (o.savingPerYear ?? 0), 0), loading: false }
    }
    const out: Opportunity[] = []
    // Fees: only where a holding carries a known expense ratio.
    const funds = holdings.filter((h) => DEMO_POSITION_META[h.symbol]?.ter != null)
    const fundValue = funds.reduce((s, h) => s + (h.marketValue || 0), 0)
    if (fundValue > 0) {
      const weighted = funds.reduce((s, h) => s + (h.marketValue || 0) * (DEMO_POSITION_META[h.symbol]?.ter ?? 0), 0) / fundValue
      if (weighted > COMPARABLE_FEE + 0.2) {
        const saving = (fundValue * (weighted - COMPARABLE_FEE)) / 100
        out.push({
          id: 'fees',
          rank: 0,
          kind: 'fund',
          title: 'Reduce avoidable fund fees',
          because: `Because ${fmtMoney(fundValue, unit)} in funds costs ${weighted.toFixed(2)}% a year against a comparable median of ${COMPARABLE_FEE.toFixed(2)}%.`,
          savingPerYear: saving,
          evidence: [
            { icon: ICONS.evidence.holdings, label: 'Funds with a known fee', value: String(funds.length) },
            { icon: ICONS.grow.fees, label: 'Current weighted fee', value: `${weighted.toFixed(2)}%`, tone: 'owed' },
            { icon: ICONS.evidence.comparison, label: 'Comparable median', value: `${COMPARABLE_FEE.toFixed(2)}%` },
          ],
          assumptions: [{ icon: ICONS.evidence.return, label: 'Expected return', value: '5.0% a year' }],
          risks: ['Alternatives may follow different strategies.', 'Switching can trigger taxes and costs.', 'Results are modelled, not guaranteed.'],
          scenario: scenario(fundValue, weighted, COMPARABLE_FEE, 5, 10),
          sample: false,
        })
      }
    }
    if (book.cash > CASH_TARGET * 1.5) {
      const excess = book.cash - CASH_TARGET
      out.push({
        id: 'cash',
        rank: 0,
        kind: 'cash',
        title: 'Cash exceeds your target',
        because: `Because ${fmtMoney(book.cash, unit)} sits in cash against a target of ${fmtMoney(CASH_TARGET, unit)}.`,
        savingPerYear: excess * 0.031,
        evidence: [
          { icon: ICONS.assetClass.cash, label: 'Cash across accounts', value: fmtMoney(book.cash, unit) },
          { icon: ICONS.evidence.comparison, label: 'Your cash target', value: fmtMoney(CASH_TARGET, unit) },
          { icon: ICONS.grow.idleCash, label: 'Above target', value: fmtMoney(excess, unit), tone: 'owed' },
        ],
        assumptions: [{ icon: ICONS.evidence.return, label: 'Modelled yield on the excess', value: '3.1% a year' }],
        risks: ['Cash you may need soon should stay cash.', 'Yields move; the figure is today’s.', 'Results are modelled, not guaranteed.'],
        sample: false,
      })
    }
    const eth = holdings.filter((h) => h.symbol.toUpperCase() === 'ETH')
    const ethValue = eth.reduce((s, h) => s + (h.marketValue || 0), 0)
    const ethUnits = eth.reduce((s, h) => s + (h.units || 0), 0)
    if (ethValue > 1000) {
      out.push({
        id: 'eth',
        rank: 0,
        kind: 'eth',
        title: 'Ether sitting unstaked',
        because: `Because ${ethUnits.toFixed(2)} ETH earns nothing where it is. Staking is modelled at ${STAKING_PCT.toFixed(1)}%, with a lock-up.`,
        savingPerYear: (ethValue * STAKING_PCT) / 100,
        evidence: [
          { icon: ICONS.assetClass.crypto, label: 'Ether held', value: `${ethUnits.toFixed(2)} ETH` },
          { icon: ICONS.grow.staking, label: 'Currently earning', value: '0.0%', tone: 'owed' },
        ],
        assumptions: [{ icon: ICONS.evidence.return, label: 'Staking yield modelled', value: `${STAKING_PCT.toFixed(1)}% a year` }],
        risks: ['Staked ether is locked for a period.', 'Validator and protocol risk apply.', 'Results are modelled, not guaranteed.'],
        sample: false,
      })
    }
    const topPos = concentration?.top?.find((t) => !/^HOME$/i.test(t.symbol))
    const invested = holdings.filter((h) => (h.assetClass ?? '') !== 'cash').reduce((s, h) => s + (h.marketValue || 0), 0)
    if (topPos && invested > 0) {
      const share = ((topPos.value || 0) / invested) * 100
      if (share >= 15) {
        out.push({
          id: 'concentration',
          rank: 0,
          kind: 'stock',
          title: 'Single-stock concentration',
          because: `Because ${topPos.label || topPos.symbol} is ${share.toFixed(0)}% of your invested portfolio.`,
          effect: 'Lower risk',
          evidence: [
            { icon: ICONS.assetClass.equities, label: `${topPos.label || topPos.symbol}, held directly`, value: fmtMoney(topPos.value, unit) },
            { icon: ICONS.grow.concentration, label: 'Share of invested portfolio', value: `${share.toFixed(0)}%`, tone: 'owed' },
          ],
          assumptions: [{ icon: ICONS.evidence.comparison, label: 'A common ceiling per stock', value: '10%' }],
          risks: ['Selling can trigger taxes.', 'A concentrated bet can also keep paying off.', 'This is analysis, not advice.'],
          sample: false,
        })
      }
    }
    out.sort((a, b) => (b.savingPerYear ?? -1) - (a.savingPerYear ?? -1))
    out.forEach((o, i) => (o.rank = i + 1))
    return { opportunities: out, totalPerYear: out.reduce((s, o) => s + (o.savingPerYear ?? 0), 0), loading: book.loading }
  }, [sampleOn, book, holdings, concentration])
}
