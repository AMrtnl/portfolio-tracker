import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { Lockup } from '@/wh/Mark'
import { Token } from '@/wh/Token'
import { Button, ChangeChip, RoundButton, Segmented, StatusPill, TextLink } from '@/wh/controls'
import { Card, GrowCard, Stat } from '@/wh/layout'
import { ALLOCATION_COLORS, AreaChart, Tessera } from '@/wh/charts'
import { useFigures } from '@/wh/format'
import { useBook, type BookAccount } from '@/wh/model/book'
import { RANGES, useNetWorthSeries, type Range } from '@/wh/model/series'
import { useGrow } from '@/wh/model/grow'
import { BUCKET_LABEL } from '@/wh/model/classify'
import { useDesktop } from '@/wh/useMediaQuery'
import { PersonMenu } from '@/wh/Shell'
import { R } from '@/routes'
import { ScreenHeader } from './ScreenHeader'
import '@/wh/screens/screens.css'

const BUCKET_COLOR = {
  property: ALLOCATION_COLORS.property,
  equitiesAndFunds: ALLOCATION_COLORS.equitiesAndFunds,
  pension: ALLOCATION_COLORS.pension,
  cash: ALLOCATION_COLORS.cash,
  crypto: ALLOCATION_COLORS.crypto,
} as const

function AccountRow({ a, desktop }: { a: BookAccount; desktop: boolean }) {
  const { money, pct } = useFigures()
  const token = <Token name={a.account.institution || a.name} classId={a.classId} size={desktop ? 34 : 40} classOnly={a.classId === 'property' || a.liability} />
  const value = a.liability ? money(-a.value) : money(a.value)
  const change =
    a.change12m != null ? <span className={a.change12m >= 0 ? 'wh-gain' : 'wh-owed'}>{pct(a.change12m)}</span> : <span className="wh-muted">{a.note ?? '—'}</span>
  if (desktop) {
    return (
      <Link to={`${R.connect}#${a.id}`} className="wh-trow tap">
        <span className="wh-cell lead">
          <span className="wh-cell-name">
            {token}
            <span>
              <b>{a.name}</b>
              <small>{a.kind}</small>
            </span>
          </span>
        </span>
        <span className={`wh-cell${a.liability ? ' wh-owed' : ''}`}>{value}</span>
        <span className="wh-cell wh-muted" style={{ flex: '0.8 1 0' }}>
          {a.share != null ? `${a.share.toFixed(1)}%` : ''}
        </span>
        <span className="wh-cell" style={{ flex: '1.1 1 0' }}>
          {change}
        </span>
      </Link>
    )
  }
  return (
    <Link to={R.connect} className="wh-row tap compact">
      {token}
      <span className="wh-row-text">
        <span className="wh-row-title">{a.name}</span>
        <span className="wh-row-sub">{a.kind}</span>
      </span>
      <span className="wh-row-num w64">
        <span className={`wh-row-value${a.liability ? ' wh-owed' : ''}`}>{value}</span>
        <span className="wh-row-delta">{a.change12m != null ? change : a.share != null ? `${a.share.toFixed(1)}%` : a.note}</span>
      </span>
    </Link>
  )
}

function Freshness({ accounts }: { accounts: BookAccount[] }) {
  const order = (a: BookAccount) => (a.broken ? 0 : a.freshness === 'fresh' ? 1 : a.freshness === 'aging' ? 2 : 3)
  const live = accounts.filter((a) => !a.liability).sort((a, b) => order(a) - order(b))
  return (
    <Card kind="bare" style={{ padding: '16px 18px 8px' }}>
      <h2 className="wh-h2" style={{ marginBottom: 4 }}>
        Freshness
      </h2>
      {live.map((a) => (
        <div key={a.id} className={`wh-fresh${a.broken ? ' broken' : a.freshness === 'stale' || a.freshness === 'unknown' ? ' stale' : ''}`}>
          <Token name={a.account.institution || a.name} classId={a.classId} size={28} classOnly={a.classId === 'property'} />
          <b>{a.name}</b>
          <span>{a.broken ? 'needs attention' : a.freshLabel}</span>
          <Icon name={a.broken ? ICONS.status.failed : a.freshness === 'fresh' || a.freshness === 'aging' ? ICONS.status.fresh : ICONS.status.stale} size={16} />
        </div>
      ))}
    </Card>
  )
}

function Empty() {
  return (
    <Card kind="pad" className="wh-empty">
      <div className="wh-empty-art" aria-hidden="true">
        <svg width="220" height="90" viewBox="0 0 220 90" fill="none">
          <path d="M4 70 C 40 66, 60 40, 90 44 S 140 20, 170 26 S 200 8, 216 10" stroke="var(--wh-accent)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="216" cy="10" r="5" fill="var(--wh-accent)" stroke="var(--wh-well)" strokeWidth="2.5" />
        </svg>
      </div>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Nothing on the ledger yet</h2>
      <p>Connect a bank, a broker, a pension or a hardware wallet, read-only, or add property and debts by hand. Everything you own, minus everything you owe, in one currency.</p>
      <Button icon={ICONS.action.add} to={R.connect}>
        Connect your first account
      </Button>
    </Card>
  )
}

export function Overview() {
  const desktop = useDesktop()
  const navigate = useNavigate()
  const book = useBook()
  const { money, headline, unit } = useFigures()
  const [range, setRange] = useState<Range>('1Y')
  const series = useNetWorthSeries(range, book.owe, book.net)
  const grow = useGrow()
  const top = grow.opportunities[0]

  useEffect(() => {
    document.title = 'Overview · Wealth Hub'
  }, [])

  if (book.empty && !book.sampleOn) {
    return (
      <div className="wh-screen">
        <ScreenHeader title="Overview" subtitle="Everything you own, minus everything you owe." phoneLead={<Lockup size={16} />} actions={!desktop ? <PersonMenu /> : undefined} />
        <Empty />
      </div>
    )
  }

  const parts = book.buckets.map((b) => ({ label: BUCKET_LABEL[b.bucket], percent: b.percent, color: BUCKET_COLOR[b.bucket] }))
  const chip = series.thin ? null : <ChangeChip value={series.changePct} />
  const changeLine = series.thin ? 'History starts with the first snapshot.' : `${money(series.change, undefined, { sign: true }).replace(/^([+−])/, `$1${unit} `)} ${series.span}`
  const statusPill = book.broken.length ? (
    <StatusPill tone="bad" icon={ICONS.status.needsSignIn} onClick={() => navigate(R.connect)}>
      {book.broken[0].name} needs attention
    </StatusPill>
  ) : (
    <StatusPill tone="ok" icon={ICONS.status.synced} onClick={() => navigate(R.connect)}>
      {book.synced} synced
    </StatusPill>
  )
  const growCard = top ? <GrowCard title={top.title} saving={top.savingPerYear != null ? money(top.savingPerYear, undefined, { sign: true }) : top.effect ?? ''} unit={top.savingPerYear != null ? `${unit} a year` : 'risk'} to={R.growItem(top.id)} /> : null
  const rangeControl = <Segmented options={RANGES} value={range} onChange={setRange} label="Range" />

  if (!desktop) {
    return (
      <div className="wh-screen">
        <ScreenHeader
          title="Overview"
          phoneLead={<Lockup size={16} />}
          actions={
            <>
              <RoundButton icon={ICONS.action.add} label="Connect an account" to={R.connect} />
              <PersonMenu />
            </>
          }
        />
        <Card kind="bare">
          <div className="wh-hero">
            <div className="wh-nw-label">Net worth</div>
            <div className="wh-figure">{headline(book.net)}</div>
            <div className="wh-hero-change">
              {chip}
              {changeLine}
            </div>
          </div>
          <div style={{ padding: '0 12px 12px' }}>
            {series.thin ? <p className="wh-caption" style={{ padding: '0 6px 8px' }}>{series.note ?? 'History starts with the first snapshot.'}</p> : <AreaChart values={series.values} width={315} height={90} unit={unit} />}
            <div style={{ marginTop: 10 }}>{rangeControl}</div>
          </div>
        </Card>
        <div className="wh-statcards">
          <div className="wh-statcard">
            <span className="wh-statcard-tile" style={{ background: 'var(--wh-gain-soft)', color: 'var(--wh-gain)' }}>
              <Icon name={ICONS.figure.own} size={18} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="wh-statcard-label">You own</span>
              <span className="wh-statcard-value" style={{ display: 'block' }}>
                {money(book.own)}
              </span>
            </span>
          </div>
          <div className="wh-statcard">
            <span className="wh-statcard-tile" style={{ background: 'var(--wh-loss-soft)', color: 'var(--wh-loss)' }}>
              <Icon name={ICONS.figure.owe} size={18} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="wh-statcard-label">You owe</span>
              <span className="wh-statcard-value wh-owed" style={{ display: 'block' }}>
                {money(-book.owe)}
              </span>
            </span>
          </div>
        </div>
        {growCard}
        <Card kind="bare" style={{ padding: '2px 16px' }}>
          <div className="wh-card-head" style={{ padding: '10px 0 2px' }}>
            <h2 className="wh-card-title">Accounts</h2>
            {statusPill}
          </div>
          {book.accounts.map((a) => (
            <AccountRow key={a.id} a={a} desktop={false} />
          ))}
        </Card>
        {parts.length > 0 && (
          <Card kind="pad-sm">
            <h2 className="wh-h2">Allocation</h2>
            <Tessera parts={parts} legend />
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="wh-screen">
      <ScreenHeader
        title="Overview"
        subtitle="Everything you own, minus everything you owe."
        actions={
          <>
            {statusPill}
            <Button size="sm" variant="secondary" icon={ICONS.action.add} to={R.connect}>
              Connect
            </Button>
          </>
        }
      />
      <div className="wh-grid">
        <div className="wh-col">
          <Card kind="pad">
            <div className="wh-nw-head">
              <div>
                <div className="wh-nw-label">Net worth</div>
                <div className="wh-figure xl" style={{ marginTop: 6 }}>
                  {headline(book.net)}
                </div>
                <div className="wh-nw-change">
                  {chip}
                  {changeLine}
                </div>
              </div>
              <div style={{ width: 280 }}>{rangeControl}</div>
            </div>
            <div className="wh-nw-chart">
              {series.thin ? <p className="wh-caption">{series.note ?? 'History starts with the first snapshot. The mix below is live.'}</p> : <AreaChart values={series.values} width={786} height={190} unit={unit} />}
            </div>
            <div className="wh-nw-stats" style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--wh-rule)' }}>
              <Stat icon={ICONS.figure.own} label="You own" value={money(book.own)} />
              <Stat icon={ICONS.figure.owe} label="You owe" value={money(-book.owe)} tone="owed" />
              <Stat icon={ICONS.figure.liquid} label="Liquid" value={money(book.liquid)} />
              <Stat icon={ICONS.assetClass.cash} label="Cash" value={money(book.cash)} />
            </div>
          </Card>
          <Card kind="table">
            <div className="wh-card-head" style={{ marginBottom: 6 }}>
              <h2 className="wh-card-title">Accounts</h2>
              <TextLink to={R.connect}>All {book.accounts.length}</TextLink>
            </div>
            <div className="wh-thead">
              <span className="wh-cell lead">Account</span>
              <span className="wh-cell">Value, {unit}</span>
              <span className="wh-cell" style={{ flex: '0.8 1 0' }}>
                Share
              </span>
              <span className="wh-cell" style={{ flex: '1.1 1 0' }}>
                12 months
              </span>
            </div>
            {book.accounts.map((a) => (
              <AccountRow key={a.id} a={a} desktop />
            ))}
          </Card>
        </div>
        <div className="wh-col">
          {growCard}
          {parts.length > 0 && (
            <Card kind="bare" style={{ padding: 18 }}>
              <h2 className="wh-h2">Allocation</h2>
              <Tessera parts={parts} legend="stack" pct={(p) => `${Math.round(p)}%`} />
            </Card>
          )}
          <Freshness accounts={book.accounts} />
        </div>
      </div>
    </div>
  )
}
