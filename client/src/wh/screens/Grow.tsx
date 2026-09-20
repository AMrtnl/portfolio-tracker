import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { RoundButton } from '@/wh/controls'
import { Card, EvidenceRow, Note } from '@/wh/layout'
import { useFigures } from '@/wh/format'
import { GROW_ICON, GROW_TINT, useGrow, type Opportunity } from '@/wh/model/grow'
import { useDesktop } from '@/wh/useMediaQuery'
import { curve } from '@/wealth/math'
import { ScreenHeader } from './ScreenHeader'
import '@/wh/screens/screens.css'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

/** Two smooth paths over the years: with the change, and the current path. No axes, no library. */
function ScenarioChart({ scenario, label }: { scenario: NonNullable<Opportunity['scenario']>; label: string }) {
  const W = 700
  const H = 150
  const all = [...scenario.withChange, ...scenario.currentPath]
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const x = (i: number, n: number) => (i / Math.max(1, n - 1)) * W
  const y = (v: number) => H - 8 - ((v - lo) / (hi - lo || 1)) * (H - 16)
  const path = (vals: number[]) => curve(vals.map((v, i) => ({ px: x(i, vals.length), py: y(v) })))
  const end = scenario.withChange[scenario.withChange.length - 1] - scenario.currentPath[scenario.currentPath.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: H }} role="img" aria-label={`${label}: after ${scenario.years} years the path with the change ends ${Math.round(end).toLocaleString('en-GB')} higher than the current path.`}>
      <path d={path(scenario.currentPath)} fill="none" stroke="var(--wh-muted)" strokeWidth={2} strokeDasharray="5 6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={path(scenario.withChange)} fill="none" stroke="var(--wh-ultra)" strokeWidth={3.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function Saving({ o, money, unit, big }: { o: Opportunity; money: (n: number, f?: string, opts?: { sign?: boolean }) => string; unit: string; big?: boolean }) {
  if (o.savingPerYear != null) {
    return (
      <>
        <div className={big ? 'wh-growhero-saving' : 'wh-growrow-saving'}>
          {big ? (
            <>
              +{unit} <span className="wh-num">{money(o.savingPerYear)}</span> a year
            </>
          ) : (
            money(o.savingPerYear, undefined, { sign: true })
          )}
        </div>
        {!big && <div className="wh-growrow-unit">{unit} a year</div>}
      </>
    )
  }
  return (
    <>
      <div className={big ? 'wh-growhero-saving' : 'wh-growrow-saving'}>{o.effect ?? 'Lower'}</div>
      {!big && <div className="wh-growrow-unit">risk</div>}
    </>
  )
}

function Detail({ o, money, unit }: { o: Opportunity; money: (n: number, f?: string, opts?: { sign?: boolean }) => string; unit: string }) {
  return (
    <>
      {o.evidence.length > 0 && (
        <Card kind="bare" style={{ padding: '16px 20px 6px', borderRadius: 26 }}>
          <h3 className="wh-h2" style={{ fontSize: 14, marginBottom: 2 }}>
            Evidence
          </h3>
          {o.evidence.map((e) => (
            <EvidenceRow key={e.label} icon={e.icon} label={e.label} value={e.value} tone={e.tone} />
          ))}
        </Card>
      )}
      {o.assumptions.length > 0 && (
        <Card kind="bare" style={{ padding: '16px 20px 6px', borderRadius: 26 }}>
          <h3 className="wh-h2" style={{ fontSize: 14, marginBottom: 2 }}>
            Assumptions
          </h3>
          {o.assumptions.map((e) => (
            <EvidenceRow key={e.label} icon={e.icon} label={e.label} value={e.value} tone={e.tone} />
          ))}
        </Card>
      )}
      <Note tone="risk" title="Risks and trade-offs">
        {o.risks.join(' ')}
      </Note>
      <p className="wh-caption" style={{ padding: '0 6px' }}>
        Educational analysis of your own figures, not financial advice. Modelled with the assumptions above; results are not guaranteed.
      </p>
      {void money}
      {void unit}
    </>
  )
}

export function Grow() {
  const desktop = useDesktop()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { opportunities, totalPerYear, loading } = useGrow()
  const { money, unit } = useFigures()

  const selected = useMemo(() => opportunities.find((o) => o.id === id) ?? opportunities[0], [opportunities, id])

  useEffect(() => {
    document.title = selected && id ? `${selected.title} · Grow · Wealth Hub` : 'Grow · Wealth Hub'
  }, [selected, id])

  const count = opportunities.length
  const words = ['No things', 'One thing', 'Two things', 'Three things', 'Four things', 'Five things', 'Six things']
  const subtitle =
    count === 0
      ? loading
        ? 'Looking through the ledger.'
        : 'Nothing worth changing stands out right now.'
      : `${words[count] ?? `${count} things`} worth looking at${totalPerYear ? `, worth about ${unit} ${money(totalPerYear)} a year together` : ''}.`

  const list = (
    <div className="wh-growlist">
      {opportunities.map((o, i) => {
        const on = desktop && selected?.id === o.id
        return (
          <Link key={o.id} to={`/grow/${o.id}`} className={`wh-growrow${on ? ' on' : ''}`} aria-current={on ? 'true' : undefined}>
            <span className="wh-growrow-rank" style={{ color: on ? 'var(--wh-ultra)' : 'var(--wh-muted)' }}>
              {ROMAN[i] ?? i + 1}
            </span>
            <span className={`wh-growrow-tile wh-tint-${GROW_TINT[o.kind]}`} style={{ background: 'var(--wh-token-bg)', color: 'var(--wh-token-fg)' }}>
              <Icon name={GROW_ICON[o.kind]} size={26} filled />
            </span>
            <span className="wh-growrow-text">
              <span className="wh-growrow-title" style={{ display: 'block' }}>
                {o.title}
              </span>
              <span className="wh-growrow-because">{o.because}</span>
            </span>
            <span className="wh-growrow-num">
              <Saving o={o} money={money} unit={unit} />
            </span>
            <Icon name={ICONS.ui.chevronRight} size={22} className="wh-muted wh-growrow-chev" />
          </Link>
        )
      })}
      {count === 0 && !loading && (
        <Card kind="pad">
          <p className="wh-body">Grow ranks things worth improving from the ledger: fund fees above the comparable median, cash far above your target, ether earning nothing, a single stock that dominates. Each one comes with its evidence, its assumptions and its risks. Nothing here moves money.</p>
        </Card>
      )}
    </div>
  )

  if (!desktop) {
    if (id && selected) {
      return (
        <div className="wh-screen">
          <ScreenHeader
            title={selected.title}
            lead={<RoundButton icon={ICONS.ui.back} label="Back to Grow" onClick={() => navigate('/grow')} />}
            phoneMid={`Grow, ${selected.rank} of ${count}`}
            actions={
              typeof navigator !== 'undefined' && 'share' in navigator ? (
                <RoundButton icon={ICONS.action.share} label="Share" onClick={() => navigator.share({ title: selected.title, text: selected.because }).catch(() => undefined)} />
              ) : undefined
            }
          />
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span className={`wh-growrow-tile wh-tint-${GROW_TINT[selected.kind]}`} style={{ background: 'var(--wh-token-bg)', color: 'var(--wh-token-fg)', width: 52, height: 52, borderRadius: 16 }}>
              <Icon name={GROW_ICON[selected.kind]} size={28} filled />
            </span>
            <h1 className="wh-title" style={{ fontSize: 30 }}>
              {selected.title}
            </h1>
          </div>
          <p className="wh-body" style={{ fontSize: 16 }}>
            {selected.because}
          </p>
          <div className="wh-growhero phone">
            <span className="wh-growhero-label">Modelled {selected.savingPerYear != null ? 'saving' : 'effect'}</span>
            <Saving o={selected} money={money} unit={unit} big />
          </div>
          <Detail o={selected} money={money} unit={unit} />
        </div>
      )
    }
    return (
      <div className="wh-screen">
        <ScreenHeader title="Grow" />
        <p className="wh-subtitle" style={{ marginTop: -6 }}>
          {subtitle}
        </p>
        {list}
      </div>
    )
  }

  return (
    <div className="wh-screen">
      <ScreenHeader title="Grow" subtitle={subtitle} />
      <div className="wh-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 370px' }}>
        <div className="wh-col" style={{ gap: 12 }}>
          {list}
          {selected?.scenario && (
            <Card kind="bare" style={{ padding: 20 }}>
              <div className="wh-scenario" style={{ marginBottom: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name={ICONS.grow.scenario} size={18} />
                  Scenario: {selected.kind === 'fund' ? 'move to comparable funds at 0.16%' : 'with the change'}
                </span>
                <span className="wh-scenario-legend">
                  <span>
                    <i /> with change
                  </span>
                  <span>
                    <i className="dash" /> current path
                  </span>
                </span>
              </div>
              <ScenarioChart scenario={selected.scenario} label={selected.title} />
            </Card>
          )}
        </div>
        {selected && (
          <div className="wh-col" style={{ gap: 16 }}>
            <div className="wh-growhero">
              <div className="wh-growhero-label">Why Grow says this</div>
              <div className="wh-growhero-title">{selected.title}</div>
              <Saving o={selected} money={money} unit={unit} big />
            </div>
            <Detail o={selected} money={money} unit={unit} />
          </div>
        )}
      </div>
    </div>
  )
}
