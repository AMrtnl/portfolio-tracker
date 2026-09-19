import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { Mark } from '@/wh/Mark'
import { LivingMark } from '@/wh/LivingMark'
import { Token } from '@/wh/Token'
import { Button, ChangeChip, RoundButton, Segmented, StatusPill, TextLink } from '@/wh/controls'
import { Card, GrowCard, Stat } from '@/wh/layout'
import { ALLOCATION_COLORS, AreaChart, Tessera } from '@/wh/charts'
import { useFigures } from '@/wh/format'
import { useBook, type BookAccount } from '@/wh/data/book'
import { RANGES, useNetWorthSeries, type Range } from '@/wh/data/series'
import { useGrow } from '@/wh/data/grow'
import { BUCKET_LABEL } from '@/wh/data/classify'
import { useDesktop } from '@/wh/useMediaQuery'
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
  const token = <Token name={a.account.institution || a.name} classId={a.classId} size={desktop ? 36 : 46} classOnly={a.classId === 'property' || a.liability} />
  const value = a.liability ? money(-a.value) : money(a.value)
  const change =
    a.change12m != null ? <span className={a.change12m >= 0 ? 'wh-gain' : 'wh-owed'}>{pct(a.change12m)}</span> : <span className="wh-muted">{a.note ?? '—'}</span>
  if (desktop) {
    return (
      <Link to={a.liability ? '/connect' : `/connect#${a.id}`} className="wh-trow tap">
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
        <span className="wh-cell" style={{ flex: '0.8 1 0' }}>
          {a.share != null ? `${a.share.toFixed(1)}%` : ''}
        </span>
        <span className="wh-cell" style={{ flex: '1.1 1 0' }}>
          {change}
        </span>
      </Link>
    )
  }
  return (
    <Link to="/connect" className="wh-row tap compact">
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
    <Card kind="bare" style={{ padding: '18px 20px 10px' }}>
      <h2 className="wh-h2" style={{ marginBottom: 4 }}>
        Freshness
      </h2>
      {live.map((a) => (
        <div key={a.id} className={`wh-fresh${a.broken ? ' broken' : a.freshness === 'stale' || a.freshness === 'unknown' ? ' stale' : ''}`}>
          <Token name={a.account.institution || a.name} classId={a.classId} size={34} classOnly={a.classId === 'property'} />
          <b>{a.name}</b>
          <span>{a.broken ? 'needs attention' : a.freshLabel}</span>
          <Icon name={a.broken ? ICONS.status.failed : a.freshness === 'fresh' || a.freshness === 'aging' ? ICONS.status.fresh : ICONS.status.stale} size={18} />
        </div>
      ))}
    </Card>
  )
}

function Empty() {
  return (
    <Card kind="pad" className="wh-empty">
      <LivingMark width={120} decorative />
      <h2 className="wh-serif" style={{ margin: 0, fontSize: 28 }}>
        Nothing on the ledger yet
      </h2>
      <p>Connect a bank, a broker, a pension or a hardware wallet, read-only, or add property and debts by hand. Everything you own, minus everything you owe, in one currency.</p>
      <Button icon={ICONS.nav.connections} to="/connect">
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
        <ScreenHeader title="Overview" subtitle="Everything you own, minus everything you owe." />
        <Empty />
      </div>
    )
  }

  const parts = book.buckets.map((b) => ({ label: BUCKET_LABEL[b.bucket], percent: b.percent, color: BUCKET_COLOR[b.bucket] }))
  const chip = series.thin ? null : <ChangeChip value={series.changePct} />
  const changeLine = series.thin ? 'History starts with the first snapshot.' : `${money(series.change, undefined, { sign: true }).replace(/^([+−])/, `$1${unit} `)} ${series.span}`
  const statusPill = book.broken.length ? (
    <StatusPill tone="bad" icon={ICONS.status.needsSignIn} onClick={() => navigate('/connect')}>
      {book.broken[0].name} needs attention
    </StatusPill>
  ) : (
    <StatusPill tone="ok" icon={ICONS.status.synced} onClick={() => navigate('/connect')}>
      {book.synced} synced
    </StatusPill>
  )
  const growCard = top ? <GrowCard title={top.title} saving={top.savingPerYear != null ? money(top.savingPerYear, undefined, { sign: true }) : top.effect ?? ''} unit={top.savingPerYear != null ? `${unit} a year` : 'risk'} to={`/grow/${top.id}`} /> : null
  const rangeControl = <Segmented options={RANGES} value={range} onChange={setRange} label="Range" />

  if (!desktop) {
    return (
      <div className="wh-screen">
        <ScreenHeader
          title="Overview"
          phoneLead={<Mark width={42} />}
          actions={
            <>
              {statusPill}
              <RoundButton icon={ICONS.action.add} label="Connect an account" to="/connect" />
            </>
          }
        />
        <div className="wh-hero-plate">
          <img src="/wh/images/garden-dots-marble.png" alt="" style={{ objectPosition: '46% 38%' }} />
          <div className="wh-hero-panel">
            <div className="wh-nw-label">Net worth</div>
            <div className="wh-figure">{headline(book.net)}</div>
            <div className="wh-hero-change">
              {chip}
              {changeLine}
            </div>
          </div>
        </div>
        <Card kind="bare" style={{ padding: 14, borderRadius: 26 }}>
          {series.thin ? <p className="wh-caption">{series.note ?? 'History starts with the first snapshot.'}</p> : <AreaChart values={series.values} width={315} height={85} unit={unit} />}
          <div style={{ marginTop: 12 }}>{rangeControl}</div>
        </Card>
        <div className="wh-statcards">
          <div className="wh-statcard">
            <span className="wh-statcard-tile wh-tint-gain" style={{ background: 'var(--wh-gain-soft)', color: 'var(--wh-gain)' }}>
              <Icon name={ICONS.assetClass.cash} size={21} filled />
            </span>
            <span>
              <span className="wh-statcard-label">You own</span>
              <span className="wh-statcard-value" style={{ display: 'block' }}>
                {money(book.own)}
              </span>
            </span>
          </div>
          <div className="wh-statcard">
            <span className="wh-statcard-tile" style={{ background: 'var(--wh-owed-soft)', color: 'var(--wh-owed)' }}>
              <Icon name={ICONS.account.mortgage} size={21} filled />
            </span>
            <span>
              <span className="wh-statcard-label">You owe</span>
              <span className="wh-statcard-value wh-owed" style={{ display: 'block' }}>
                {money(-book.owe)}
              </span>
            </span>
          </div>
        </div>
        {growCard}
        <Card kind="bare" style={{ padding: '4px 16px', borderRadius: 26 }}>
          {book.accounts.map((a) => (
            <AccountRow key={a.id} a={a} desktop={false} />
          ))}
        </Card>
        {parts.length > 0 && (
          <Card kind="pad-sm" style={{ borderRadius: 26 }}>
            <Tessera parts={parts} legend />
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="wh-screen">
      <ScreenHeader title="Overview" subtitle="Everything you own, minus everything you owe." actions={<div style={{ width: 300 }}>{rangeControl}</div>} />
      <div className="wh-grid">
        <div className="wh-col">
          <Card kind="pad">
            <div className="wh-nw-head">
              <div>
                <div className="wh-nw-label">Net worth</div>
                <div className="wh-figure xl">{headline(book.net)}</div>
                <div className="wh-nw-change">
                  {chip}
                  {changeLine}
                </div>
              </div>
              <div className="wh-nw-stats">
                <Stat icon={ICONS.figure.own} label="You own" value={money(book.own)} />
                <Stat icon={ICONS.figure.owe} label="You owe" value={money(-book.owe)} tone="owed" />
                <Stat icon={ICONS.figure.liquid} label="Liquid" value={money(book.liquid)} />
              </div>
            </div>
            <div className="wh-nw-chart">
              {series.thin ? <p className="wh-caption">{series.note ?? 'History starts with the first snapshot. The mix below is live.'}</p> : <AreaChart values={series.values} width={786} height={198} unit={unit} />}
            </div>
          </Card>
          <Card kind="table">
            <div className="wh-card-head">
              <h2 className="wh-card-title">Accounts</h2>
              <TextLink to="/connect">All {book.accounts.length}</TextLink>
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
          <div className="wh-picture">
            <img src="/wh/images/garden-dots-marble.png" alt="" style={{ objectPosition: '60% 40%' }} />
            <div className="wh-picture-line">Own the whole picture.</div>
          </div>
          {growCard}
          {parts.length > 0 && (
            <Card kind="bare" style={{ padding: 20 }}>
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
