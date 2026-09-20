import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { Token } from '@/wh/Token'
import { RoundButton, Segmented, TextLink } from '@/wh/controls'
import { Card, Note } from '@/wh/layout'
import { Meter, Sparkline } from '@/wh/charts'
import { useFigures } from '@/wh/format'
import { useExposure, type ExposureRow } from '@/wh/model/exposure'
import { useHoldingRows } from '@/wh/model/holdings'
import { useDesktop } from '@/wh/useMediaQuery'
import { ScreenHeader } from './ScreenHeader'
import '@/wh/screens/screens.css'

type Scope = 'equities' | 'all'
const SCOPES: ReadonlyArray<{ value: Scope; label: string }> = [
  { value: 'equities', label: 'Equities only' },
  { value: 'all', label: 'All assets' },
]
type Cut = 'sector' | 'country' | 'currency'
const CUTS: ReadonlyArray<{ value: Cut; label: string }> = [
  { value: 'sector', label: 'Sector' },
  { value: 'country', label: 'Country' },
  { value: 'currency', label: 'Currency' },
]

function MeterRows({ rows, all, limit }: { rows: ExposureRow[]; all?: boolean; limit?: number }) {
  const shown = limit ? rows.slice(0, limit) : rows
  const rest = limit ? rows.slice(limit) : []
  const other = rest.reduce((s, r) => s + r.pct, 0)
  return (
    <div className="wh-exp-rows">
      {shown.map((r) => (
        <div key={r.key} className="wh-meterrow">
          {r.code ? <span className="wh-meterrow-code">{r.code}</span> : <Icon name={r.icon ?? ICONS.sector.other} size={18} className={all ? 'wh-ultra' : 'wh-muted'} />}
          <span className="wh-meterrow-label">{r.label}</span>
          <Meter pct={r.pct} label={`${r.label} ${Math.round(r.pct)} percent`} />
          <span className="wh-meterrow-pct">{Math.round(r.pct)}%</span>
        </div>
      ))}
      {rest.length > 0 && (
        <div className="wh-meterrow">
          <Icon name={ICONS.sector.other} size={18} className="wh-muted" />
          <span className="wh-meterrow-label">{rest.length === 1 ? rest[0].label : 'Other'}</span>
          <Meter pct={other} />
          <span className="wh-meterrow-pct">{Math.round(other)}%</span>
        </div>
      )}
    </div>
  )
}

export function Exposure() {
  const desktop = useDesktop()
  const { sector, country, currency, insight, loading } = useExposure()
  const { rows } = useHoldingRows()
  const { money, unit } = useFigures()
  const [scope, setScope] = useState<Scope>('equities')
  const [cut, setCut] = useState<Cut>('sector')

  useEffect(() => {
    document.title = 'Exposure · Wealth Hub'
  }, [])

  const positions = rows.filter((r) => r.kind === 'position' && r.classId !== 'cash' && (scope === 'all' || r.classId === 'equities' || r.classId === 'funds' || r.classId === 'bonds'))
  const insightNote = insight && (
    <Note tone="insight">{insight}</Note>
  )
  const empty = !loading && sector.length === 0 && country.length === 0

  if (!desktop) {
    const list = cut === 'sector' ? sector : cut === 'country' ? country : currency
    return (
      <div className="wh-screen">
        <ScreenHeader title="Exposure" actions={<RoundButton icon={ICONS.evidence.assumption} label="What look-through means" onClick={() => window.alert('Look-through opens every fund and counts the companies inside it, so a stock held directly and again inside a fund is counted once, together.')} />} />
        <p className="wh-subtitle" style={{ marginTop: -6 }}>
          What you really hold, looking through every fund to the companies inside it.
        </p>
        <Segmented options={CUTS} value={cut} onChange={setCut} label="Cut" />
        <Card kind="bare" style={{ padding: '6px 16px', borderRadius: 26 }}>
          {empty ? <p className="wh-body" style={{ padding: '14px 0' }}>Connect a broker or a fund to see the look-through.</p> : <MeterRows rows={list} all={cut !== 'sector'} limit={7} />}
        </Card>
        {cut === 'sector' && country.length > 0 && (
          <Card kind="bare" style={{ padding: '14px 16px 6px', borderRadius: 26 }}>
            <div className="wh-card-head" style={{ marginBottom: 4 }}>
              <h2 className="wh-card-title sm">By country</h2>
              <TextLink onClick={() => setCut('country')} chevron={false}>
                All {country.length}
              </TextLink>
            </div>
            <MeterRows rows={[...country].sort((a, b) => b.pct - a.pct).slice(0, 2)} all />
          </Card>
        )}
        {insightNote}
      </div>
    )
  }

  return (
    <div className="wh-screen">
      <ScreenHeader title="Exposure" subtitle="What you really hold, looking through every fund to the companies inside it." actions={<div style={{ width: 350 }}><Segmented options={SCOPES} value={scope} onChange={setScope} label="Scope" /></div>} />
      <div className="wh-grid even">
        <Card kind="bare" style={{ padding: '18px 22px 10px' }}>
          <h2 className="wh-h2 row">
            <Icon name={ICONS.account.broker} size={20} />
            By sector
          </h2>
          {empty ? <p className="wh-body">Connect a broker or a fund to see the look-through.</p> : <MeterRows rows={sector} />}
        </Card>
        <Card kind="bare" style={{ padding: '18px 22px 10px' }}>
          <h2 className="wh-h2 row">
            <Icon name={ICONS.nav.exposure} size={20} />
            By country
          </h2>
          <MeterRows rows={country} all />
        </Card>
        <div className="wh-col">
          <Card kind="bare" style={{ padding: '18px 22px 10px' }}>
            <h2 className="wh-h2 row">
              <Icon name={ICONS.account.exchange} size={20} />
              By currency
            </h2>
            <MeterRows rows={currency} all />
          </Card>
          {insightNote}
        </div>
      </div>
      <Card kind="bare" style={{ padding: '10px 24px' }}>
        <div className="wh-thead">
          <span className="wh-cell lead" style={{ flex: '2.4 1 0' }}>
            Holding
          </span>
          <span className="wh-cell" style={{ flex: '1.1 1 0' }}>
            Class
          </span>
          <span className="wh-cell" style={{ flex: '1.2 1 0' }}>
            Sector
          </span>
          <span className="wh-cell" style={{ flex: '0.7 1 0' }}>
            Country
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
        {positions.map((r) => (
          <Link key={r.key} to={`/holdings/${encodeURIComponent(r.symbol)}`} className="wh-trow tap">
            <span className="wh-cell lead" style={{ flex: '2.4 1 0' }}>
              <span className="wh-cell-name">
                <Token name={r.name} symbol={r.symbol} classId={r.classId} size={36} />
                <span>
                  <b>{r.name}</b>
                  <small>{r.account}</small>
                </span>
              </span>
            </span>
            <span className="wh-cell wh-muted" style={{ flex: '1.1 1 0' }}>
              {r.classLabel}
            </span>
            <span className="wh-cell" style={{ flex: '1.2 1 0' }}>
              {r.sector ?? (r.classId === 'funds' ? 'Diversified' : '—')}
            </span>
            <span className="wh-cell" style={{ flex: '0.7 1 0' }}>
              {r.country} / {r.currency}
            </span>
            <span className="wh-cell" style={{ flex: '0.9 1 0' }}>
              {money(r.value)}
            </span>
            <span className="wh-cell" style={{ flex: '0.7 1 0' }}>
              {r.weight != null ? `${r.weight.toFixed(1)}%` : ''}
            </span>
            <span className="wh-cell" style={{ flex: '0.8 1 0' }}>
              {r.spark ? <Sparkline values={r.spark} /> : <span className="wh-muted">—</span>}
            </span>
          </Link>
        ))}
        {positions.length === 0 && <p className="wh-caption" style={{ padding: '14px 0' }}>No positions in this scope.</p>}
      </Card>
    </div>
  )
}
