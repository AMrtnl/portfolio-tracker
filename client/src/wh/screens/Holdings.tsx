import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ICONS } from '@/wh/icons'
import { Token, type ClassId } from '@/wh/Token'
import { Field, RoundButton, Segmented } from '@/wh/controls'
import { Card, Note, Row } from '@/wh/layout'
import { ALLOCATION_COLORS, Sparkline, Tessera } from '@/wh/charts'
import { useFigures } from '@/wh/format'
import { useBook } from '@/wh/model/book'
import { useHoldingRows, type HoldingRow } from '@/wh/model/holdings'
import { BUCKET_LABEL } from '@/wh/model/classify'
import { useDesktop } from '@/wh/useMediaQuery'
import { ScreenHeader } from './ScreenHeader'
import '@/wh/screens/screens.css'

type Filter = 'all' | 'funds' | 'equities' | 'crypto' | 'cash' | 'other'
const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'funds', label: 'Funds' },
  { value: 'equities', label: 'Equities' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]

const BUCKET_COLOR = {
  property: ALLOCATION_COLORS.property,
  equitiesAndFunds: ALLOCATION_COLORS.equitiesAndFunds,
  pension: ALLOCATION_COLORS.pension,
  cash: ALLOCATION_COLORS.cash,
  crypto: ALLOCATION_COLORS.crypto,
} as const

function inFilter(r: HoldingRow, f: Filter): boolean {
  if (f === 'all') return true
  const c: ClassId = r.classId
  if (f === 'funds') return c === 'funds' || c === 'bonds'
  if (f === 'equities') return c === 'equities'
  if (f === 'crypto') return c === 'crypto' || c === 'bitcoin'
  if (f === 'cash') return c === 'cash'
  return c === 'property' || c === 'pension' || c === 'collectibles' || c === 'other'
}

function rowTo(r: HoldingRow): string | undefined {
  if (r.kind === 'account' || r.classId === 'cash') return undefined
  return `/holdings/${encodeURIComponent(r.symbol)}`
}

function HoldingToken({ r, size }: { r: HoldingRow; size: number }) {
  const classOnly = r.classId === 'property' || r.classId === 'cash'
  return <Token name={r.name} symbol={r.kind === 'account' ? undefined : r.symbol} classId={r.classId} size={size} classOnly={classOnly} />
}

/** "ETF, world, USD", "Technology, US", "On Ledger, 0.62 BTC", "Property, by hand". */
function phoneSub(r: HoldingRow): string {
  if (r.classId === 'crypto' || r.classId === 'bitcoin') return `On ${r.account}${r.units ? `, ${r.units}` : ''}`
  if (r.classId === 'cash') return r.accountKind || r.account
  if (r.kind === 'account') return r.classId === 'property' ? `${r.classLabel}, ${r.account}` : `${r.classLabel}, ${r.currency}`
  const place = r.country.length <= 3 && !/world/i.test(r.classLabel) ? r.country : r.currency
  const what = r.classId === 'equities' && r.sector ? r.sector : r.classLabel
  return `${what}, ${place}`
}

export function Holdings() {
  const desktop = useDesktop()
  const book = useBook()
  const { rows, loading } = useHoldingRows()
  const { money, pct, unit } = useFigures()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [filtering, setFiltering] = useState(false)

  useEffect(() => {
    document.title = 'Holdings · Wealth Hub'
  }, [])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => inFilter(r, filter) && (!q || r.name.toLowerCase().includes(q) || r.symbol.toLowerCase().includes(q) || r.account.toLowerCase().includes(q)))
  }, [rows, filter, query])

  const parts = book.buckets.map((b) => ({ label: BUCKET_LABEL[b.bucket], percent: b.percent, color: BUCKET_COLOR[b.bucket] }))
  const top = rows.find((r) => r.kind === 'position' && r.classId !== 'cash')
  const controls = (
    <>
      <RoundButton icon={ICONS.action.search} label={searching ? 'Hide search' : 'Search holdings'} onClick={() => setSearching((v) => !v)} aria-pressed={searching} />
      <RoundButton icon={ICONS.action.filter} label={filtering ? 'Hide filter' : 'Filter by class'} onClick={() => setFiltering((v) => !v)} aria-pressed={filtering} />
    </>
  )
  const tools = (searching || filtering) && (
    <div className="wh-stack">
      {searching && <Field icon={ICONS.action.search} type="search" placeholder="Name, ticker or account" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search holdings" autoFocus />}
      {filtering && <Segmented options={FILTERS} value={filter} onChange={setFilter} label="Class" />}
    </div>
  )

  const empty = !loading && rows.length === 0
  const list = (
    <Card kind="bare" style={{ padding: desktop ? '10px 24px' : '4px 16px', borderRadius: 26 }}>
      {desktop && (
        <div className="wh-thead">
          <span className="wh-cell lead" style={{ flex: '2.4 1 0' }}>
            Holding
          </span>
          <span className="wh-cell" style={{ flex: '1.1 1 0' }}>
            Class
          </span>
          <span className="wh-cell" style={{ flex: '1 1 0' }}>
            Held at
          </span>
          <span className="wh-cell" style={{ flex: '0.9 1 0' }}>
            Value, {unit}
          </span>
          <span className="wh-cell" style={{ flex: '0.7 1 0' }}>
            Weight
          </span>
          <span className="wh-cell" style={{ flex: '0.8 1 0' }}>
            30 days
          </span>
        </div>
      )}
      {empty && <p className="wh-body" style={{ padding: '14px 0' }}>Nothing on the ledger yet. Connect an account to see what you own.</p>}
      {shown.map((r) =>
        desktop ? (
          rowTo(r) ? (
            <Link key={r.key} to={rowTo(r)!} className="wh-trow tap">
              <DesktopCells r={r} money={money} pct={pct} />
            </Link>
          ) : (
            <div key={r.key} className="wh-trow">
              <DesktopCells r={r} money={money} pct={pct} />
            </div>
          )
        ) : (
          <Row
            key={r.key}
            className="compact"
            to={rowTo(r)}
            token={<HoldingToken r={r} size={46} />}
            title={r.name}
            sub={phoneSub(r)}
            right={
              <>
                {r.spark ? <Sparkline values={r.spark} /> : null}
                <span className="wh-row-num w64">
                  <span className="wh-row-value">{money(r.value)}</span>
                  <span className={`wh-row-delta${r.change != null ? (r.change >= 0 ? ' wh-gain' : ' wh-owed') : ''}`}>{r.change != null ? pct(r.change) : r.weight != null ? `${r.weight.toFixed(1)}%` : ''}</span>
                </span>
              </>
            }
          />
        ),
      )}
      {!empty && shown.length === 0 && <p className="wh-caption" style={{ padding: '14px 0' }}>Nothing matches.</p>}
    </Card>
  )

  if (!desktop) {
    return (
      <div className="wh-screen">
        <ScreenHeader title="Holdings" actions={controls} />
        {tools}
        {parts.length > 0 && (
          <Card kind="pad-sm" style={{ borderRadius: 26 }}>
            <Tessera parts={parts} legend />
          </Card>
        )}
        {list}
      </div>
    )
  }

  return (
    <div className="wh-screen">
      <ScreenHeader title="Holdings" subtitle="Every position and every single thing you own, with its trend and its change." actions={controls} />
      {tools}
      <div className="wh-grid wide-side">
        <div className="wh-col">{list}</div>
        <div className="wh-col">
          {parts.length > 0 && (
            <Card kind="bare" style={{ padding: 20 }}>
              <h2 className="wh-h2">Allocation</h2>
              <Tessera parts={parts} legend="stack" />
            </Card>
          )}
          {top && top.weight != null && (
            <Note tone={top.weight >= 15 ? 'insight' : 'plain'} icon={ICONS.evidence.insight}>
              {top.name} is your largest position at {top.weight.toFixed(1)}% of everything you own{top.account ? `, held at ${top.account}` : ''}.
            </Note>
          )}
        </div>
      </div>
    </div>
  )
}

function DesktopCells({ r, money, pct }: { r: HoldingRow; money: (n: number) => string; pct: (p: number) => string }) {
  return (
    <>
      <span className="wh-cell lead" style={{ flex: '2.4 1 0' }}>
        <span className="wh-cell-name">
          <HoldingToken r={r} size={36} />
          <span>
            <b>{r.name}</b>
            <small>{r.units ? `${r.account}, ${r.units}` : r.account}</small>
          </span>
        </span>
      </span>
      <span className="wh-cell wh-muted" style={{ flex: '1.1 1 0' }}>
        {r.classLabel}
      </span>
      <span className="wh-cell" style={{ flex: '1 1 0' }}>
        {r.account}
      </span>
      <span className="wh-cell" style={{ flex: '0.9 1 0' }}>
        {money(r.value)}
      </span>
      <span className="wh-cell" style={{ flex: '0.7 1 0' }}>
        {r.weight != null ? `${r.weight.toFixed(1)}%` : ''}
      </span>
      <span className="wh-cell" style={{ flex: '0.8 1 0', gap: 8 }}>
        {r.spark ? <Sparkline values={r.spark} /> : <span className="wh-muted">{r.change != null ? pct(r.change) : '—'}</span>}
      </span>
    </>
  )
}
