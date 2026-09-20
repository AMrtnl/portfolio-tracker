import { useMemo } from 'react'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { Token } from '@/wh/Token'
import { ChangeChip } from '@/wh/controls'
import { Card, Stat } from '@/wh/layout'
import { ALLOCATION_COLORS, AreaChart, Meter, Tessera } from '@/wh/charts'
import { fmt } from '@/wh/format'
import { FIXTURE } from '@/wh/model/fixture'
import { demoHistory } from '@/wealth/demo'
import '@/wh/screens/screens.css'

const F = FIXTURE
const unit = F.currency

const KIND_CLASS = { property: 'property', broker: 'broker', bank: 'bank', pension: 'pension', wallet: 'wallet', mortgage: 'mortgage', loan: 'loan' } as const

/** The overview, drawn from the sample household with the real chart kit. No network, no session. */
export function OverviewPreview() {
  const values = useMemo(() => demoHistory(F.netWorth, 240, F.change12m.pct).map((p) => p.value), [])
  const colors: Record<string, string> = {
    Property: ALLOCATION_COLORS.property,
    'Equities and funds': ALLOCATION_COLORS.equitiesAndFunds,
    Pension: ALLOCATION_COLORS.pension,
    Cash: ALLOCATION_COLORS.cash,
    Crypto: ALLOCATION_COLORS.crypto,
  }
  const parts = F.allocation.map(([label, percent]) => ({ label, percent, color: colors[label] ?? ALLOCATION_COLORS.equitiesAndFunds }))
  const accounts = F.accounts.slice(0, 6)
  return (
    <>
      <div className="wh-col">
        <Card kind="pad">
          <div className="wh-nw-head">
            <div>
              <div className="wh-nw-label">Net worth</div>
              <div className="wh-figure xl" style={{ marginTop: 6 }}>
                {unit} {fmt(F.netWorth)}
              </div>
              <div className="wh-nw-change">
                <ChangeChip value={F.change12m.pct} />+{unit} {fmt(F.change12m.amount)} over 12 months
              </div>
            </div>
            <div className="wh-seg" aria-hidden="true" style={{ width: 240 }}>
              {['1M', '3M', 'YTD', '1Y', 'All'].map((r) => (
                <span key={r} className={`wh-seg-btn${r === '1Y' ? ' on' : ''}`}>
                  {r}
                </span>
              ))}
            </div>
          </div>
          <div className="wh-nw-chart">
            <AreaChart values={values} width={786} height={170} unit={unit} label="Net worth over twelve months, rising" />
          </div>
          <div className="wh-nw-stats" style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--wh-rule)' }}>
            <Stat icon={ICONS.figure.own} label="You own" value={fmt(F.assets)} />
            <Stat icon={ICONS.figure.owe} label="You owe" value={fmt(-F.liabilities)} tone="owed" />
            <Stat icon={ICONS.figure.liquid} label="Liquid" value={fmt(F.liquid)} />
          </div>
        </Card>
        <Card kind="table">
          <div className="wh-card-head" style={{ marginBottom: 6 }}>
            <h2 className="wh-card-title">Accounts</h2>
            <span className="wh-link">All {F.accounts.length}</span>
          </div>
          {accounts.map((a) => (
            <div key={a.name} className="wh-trow">
              <span className="wh-cell lead">
                <span className="wh-cell-name">
                  <Token name={a.name} classId={KIND_CLASS[a.kind]} size={32} classOnly={a.kind === 'property' || a.kind === 'mortgage' || a.kind === 'loan'} remote={false} />
                  <span>
                    <b>{a.name}</b>
                    <small>{a.source ?? a.kind}</small>
                  </span>
                </span>
              </span>
              <span className={`wh-cell${a.value < 0 ? ' wh-owed' : ''}`}>{fmt(a.value)}</span>
              <span className="wh-cell wh-muted opt" style={{ flex: '0.8 1 0' }}>
                {a.share != null ? `${a.share.toFixed(1)}%` : ''}
              </span>
              <span className="wh-cell opt" style={{ flex: '1 1 0' }}>
                {a.change12m != null ? <span className={a.change12m >= 0 ? 'wh-gain' : 'wh-owed'}>{`${a.change12m >= 0 ? '+' : '−'}${Math.abs(a.change12m).toFixed(1)}%`}</span> : <span className="wh-muted">{a.note ?? a.fresh ?? '—'}</span>}
              </span>
            </div>
          ))}
        </Card>
      </div>
      <div className="wh-col">
        <div className="wh-grow" role="presentation">
          <span className="wh-grow-tile">
            <Icon name={ICONS.nav.grow} size={20} filled />
          </span>
          <span className="wh-grow-text">
            <span className="wh-grow-label">Top Grow opportunity</span>
            <span className="wh-grow-title" style={{ display: 'block' }}>
              {F.grow[0].title}
            </span>
          </span>
          <span className="wh-grow-num">
            <span className="wh-grow-saving" style={{ display: 'block' }}>
              +{fmt(F.grow[0].savingPerYear ?? 0)}
            </span>
            <span className="wh-grow-unit">{unit} a year</span>
          </span>
        </div>
        <Card kind="bare" style={{ padding: 18 }}>
          <h2 className="wh-h2">Allocation</h2>
          <Tessera parts={parts} legend="stack" />
        </Card>
        <Card kind="bare" style={{ padding: '14px 18px 6px' }}>
          <h2 className="wh-h2" style={{ marginBottom: 2 }}>
            By country
          </h2>
          {F.exposure.country.slice(0, 4).map(([label, pct]) => (
            <div key={label} className="wh-meterrow">
              <span className="wh-meterrow-label">{label}</span>
              <Meter pct={pct} />
              <span className="wh-meterrow-pct">{Math.round(pct)}%</span>
            </div>
          ))}
        </Card>
      </div>
    </>
  )
}

/** A small card of holdings rows for the feature grid. */
export function HoldingsPreview() {
  return (
    <div className="wh-card list" style={{ padding: '2px 12px' }}>
      {F.holdings.slice(0, 4).map((h) => (
        <div key={h.name} className="wh-row compact">
          <Token name={h.name} classId={h.class?.startsWith('Fund') ? 'funds' : h.class === 'Equity' ? 'equities' : h.name === 'Bitcoin' ? 'bitcoin' : 'crypto'} size={32} remote={false} />
          <span className="wh-row-text">
            <span className="wh-row-title" style={{ fontSize: 13 }}>
              {h.name}
            </span>
            <span className="wh-row-sub" style={{ fontSize: 11 }}>
              {h.class ?? 'Crypto'}, {h.account}
            </span>
          </span>
          <span className="wh-row-num">
            <span className="wh-row-value" style={{ fontSize: 13 }}>
              {fmt(h.value)}
            </span>
            <span className={`wh-row-delta ${h.change != null && h.change < 0 ? 'wh-owed' : 'wh-gain'}`} style={{ fontSize: 11 }}>
              {h.change != null ? `${h.change >= 0 ? '+' : '−'}${Math.abs(h.change).toFixed(1)}%` : ''}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

/** Where the month went, as meters. */
export function CashflowPreview() {
  const rows = Object.entries(F.cashflow.september).slice(0, 4) as Array<[string, number]>
  const out = rows.reduce((s, [, v]) => s + v, 0)
  return (
    <div className="wh-card" style={{ padding: '6px 12px' }}>
      {rows.map(([label, v]) => (
        <div key={label} className="wh-meterrow" style={{ fontSize: 13 }}>
          <span className="wh-meterrow-label">{label}</span>
          <Meter pct={(v / out) * 100} />
          <span className="wh-meterrow-pct" style={{ fontSize: 13 }}>
            {fmt(v)}
          </span>
        </div>
      ))}
    </div>
  )
}

/** One Grow opportunity with its evidence. */
export function GrowPreview() {
  const g = F.grow[0]
  return (
    <div className="wh-card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span className="wh-growrow-tile wh-tint-ultra" style={{ background: 'var(--wh-token-bg)', color: 'var(--wh-token-fg)', width: 32, height: 32, borderRadius: 9 }}>
          <Icon name={ICONS.assetClass.funds} size={16} filled />
        </span>
        <span style={{ minWidth: 0 }}>
          <span className="wh-growrow-title" style={{ display: 'block', fontSize: 13 }}>
            {g.title}
          </span>
          <span className="wh-growrow-saving" style={{ fontSize: 13 }}>
            +{unit} {fmt(g.savingPerYear ?? 0)} a year
          </span>
        </span>
      </div>
      <p className="wh-caption" style={{ marginTop: 10, fontSize: 12 }}>
        {g.because}
      </p>
    </div>
  )
}
