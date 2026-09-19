import { useMemo, type CSSProperties, type ReactNode } from 'react'
import {
  areaGeometry,
  cashflowGeometry,
  creepGeometry,
  meterBars,
  pctChange,
  sparklineGeometry,
  tesseraTiles,
  type CashflowInput,
  type TesseraPart,
} from './math'
import './charts.css'

/** The five allocation colours from tokens.json, as tokens so they follow the ground (crypto is the ink: night on marble, marble on night). */
export const ALLOCATION_COLORS = {
  property: 'var(--wh-stone)',
  equitiesAndFunds: 'var(--wh-ultra)',
  pension: 'var(--wh-olive)',
  cash: '#9DB6F5',
  crypto: 'var(--wh-ink)',
} as const

const fmt = (n: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(n)

/* ---------------- Big chart ---------------- */

interface AreaChartProps {
  values: number[]
  width?: number
  height?: number
  /** Text alternative. Defaults to the start, end and change. */
  label?: string
  unit?: string
  className?: string
}

/** Smooth rounded ultramarine line, dot-screen fill that thins downward, a breathing gold point on today, glow on hover. */
export function AreaChart({ values, width = 790, height = 170, label, unit = '', className }: AreaChartProps) {
  const g = useMemo(() => areaGeometry(values, { width, height }), [values, width, height])
  if (!g) return null
  const change = pctChange(values)
  const alt =
    label ??
    `${unit ? unit + ' ' : ''}${fmt(values[0])} to ${fmt(values[values.length - 1])}${change != null ? `, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)}%` : ''} over ${values.length} points`
  const [ex, ey] = g.end
  return (
    <svg viewBox={`0 0 ${g.W} ${g.H}`} data-chart="nw" className={`wh-chart${className ? ` ${className}` : ''}`} role="img" aria-label={alt}>
      {g.grid.map((y) => (
        <line key={y} x1={0} y1={y} x2={g.W} y2={y} stroke="var(--wh-rule)" strokeWidth={1.5} strokeDasharray="2 6" strokeLinecap="round" />
      ))}
      <path data-dots d={g.dots} fill="var(--wh-ultra)" fillOpacity={0.38} shapeRendering="crispEdges" />
      <path data-aura d={g.line} fill="none" stroke="var(--wh-ultra)" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
      <path data-line d={g.line} fill="none" stroke="var(--wh-ultra)" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle data-halo cx={ex} cy={ey} r={7} fill="var(--wh-stone)" />
      <circle data-today cx={ex} cy={ey} r={7} fill="var(--wh-stone)" stroke="var(--wh-card)" strokeWidth={3} />
    </svg>
  )
}

/* ---------------- Sparkline ---------------- */

/** Stepped pixels, red only if the series ends lower than it started. */
export function Sparkline({ values, width = 64, height = 28, className }: { values: number[]; width?: number; height?: number; className?: string }) {
  const g = useMemo(() => sparklineGeometry(values, { width, height }), [values, width, height])
  if (!g) return <span className="wh-spark" style={{ width, height }} aria-hidden="true" />
  return (
    <svg viewBox={`0 0 ${g.viewW} ${g.viewH}`} width={width} height={height} shapeRendering="crispEdges" className={`wh-spark${className ? ` ${className}` : ''}`} aria-hidden="true">
      <path d={g.d} fill={g.negative ? 'var(--wh-owed)' : 'var(--wh-ultra)'} />
    </svg>
  )
}

/* ---------------- Meter ---------------- */

interface MeterProps {
  pct: number
  scale?: number
  n?: number
  /** Any CSS colour. Ultramarine by default. */
  color?: string
  label?: string
  className?: string
}

/** Twenty slim upright bars; the partial bar at lower opacity. For every percentage, never a pie. */
export function Meter({ pct, scale = 2.2, n = 20, color, label, className }: MeterProps) {
  const bars = useMemo(() => meterBars(pct, { scale, n }), [pct, scale, n])
  return (
    <span
      className={`wh-meter${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={label ?? `${pct.toFixed(pct % 1 ? 1 : 0)} percent`}
      style={color ? ({ '--wh-meter': color } as CSSProperties) : undefined}
    >
      {bars.map((b, k) => (
        <span key={k} className={b.on ? 'on' : undefined} style={b.opacity != null ? { opacity: b.opacity } : undefined} />
      ))}
    </span>
  )
}

/* ---------------- Tessera ---------------- */

interface TesseraProps {
  parts: TesseraPart[]
  cols?: number
  rows?: number
  gap?: number
  legend?: boolean | 'stack'
  /** Formats the percent in the legend. */
  pct?: (p: number) => string
  className?: string
}

/** One hundred bevelled tiles filled column by column. Allocation is made of the same stuff as the pictures. */
export function Tessera({ parts, cols = 20, rows = 5, gap = 3, legend = false, pct = (p) => `${Math.round(p)}%`, className }: TesseraProps) {
  const tiles = useMemo(() => tesseraTiles(parts, { cols, rows }), [parts, cols, rows])
  const alt = parts.map((p) => `${p.label} ${pct(p.percent)}`).join(', ')
  return (
    <div className={className}>
      <div
        className="wh-tessera"
        role="img"
        aria-label={alt}
        style={{ gridTemplateRows: `repeat(${rows}, 1fr)`, gridTemplateColumns: `repeat(${cols}, 1fr)`, gap, aspectRatio: `${cols} / ${rows}` }}
      >
        {tiles.map((t, i) => (
          <span key={i} style={{ background: t.color }} />
        ))}
      </div>
      {legend && (
        <div className={`wh-tessera-legend${legend === 'stack' ? ' stack' : ''}`} aria-hidden="true">
          {parts.map((p) => (
            <span key={p.label}>
              <i style={{ background: p.color }} />
              <em>{p.label}</em>
              <b>{pct(p.percent)}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- Cash flow ---------------- */

interface CashflowChartProps extends CashflowInput {
  width?: number
  height?: number
  /** Index of the month to set in bold under the chart. */
  nowIndex?: number
  labels?: boolean
  legend?: ReactNode
  label?: string
  className?: string
}

/** Rounded paired bars (green in, red out), an ultramarine position line, the forecast at lower strength on a marble band. */
export function CashflowChart({ months, ins, outs, position, forecastFrom, width = 900, height = 240, nowIndex, labels = true, label, className }: CashflowChartProps) {
  const g = useMemo(() => cashflowGeometry({ months, ins, outs, position, forecastFrom }, { width, height }), [months, ins, outs, position, forecastFrom, width, height])
  if (!g) return null
  const last = Math.max(0, Math.min(months.length, forecastFrom) - 1)
  const alt =
    label ??
    `Money in and out by month from ${months[0]} to ${months[months.length - 1]}. Latest month ${months[last]}: in ${fmt(ins[last] ?? 0)}, out ${fmt(outs[last] ?? 0)}, cash position ${fmt(position[last] ?? 0)}.${forecastFrom < months.length ? ` ${months.length - forecastFrom} months forecast.` : ''}`
  return (
    <div className={className}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="wh-cashflow" style={{ height }} role="img" aria-label={alt}>
        {g.band && <rect x={g.band.x} y={0} width={g.band.width} height={height} fill="var(--wh-panel)" fillOpacity={0.8} />}
        {g.grid.map((y) => (
          <line key={y} x1={0} y1={y} x2={width} y2={y} stroke="var(--wh-rule)" strokeWidth={1.5} strokeDasharray="2 6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ))}
        {g.bars.map((b) => (
          <rect key={`${b.kind}${b.index}`} x={b.x} y={b.y} width={b.w} height={b.h} rx={5} fill={b.kind === 'in' ? 'var(--wh-gain)' : 'var(--wh-owed)'} fillOpacity={b.opacity} />
        ))}
        {g.actual && <path d={g.actual} fill="none" stroke="var(--wh-ultra)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
        {g.forecast && <path d={g.forecast} fill="none" stroke="var(--wh-ultra)" strokeWidth={2.5} strokeDasharray="5 6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
      </svg>
      {labels && (
        <div className="wh-cashflow-labels" aria-hidden="true">
          {months.map((m, i) => (
            <span key={`${m}${i}`} className={i === nowIndex ? 'now' : undefined}>
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** The legend the Cash flow screen puts above its chart. */
export function CashflowLegend({ forecast = true }: { forecast?: boolean }) {
  return (
    <div className="wh-cashflow-legend" aria-hidden="true">
      <span>
        <i style={{ background: 'var(--wh-gain)' }} />
        Money in
      </span>
      <span>
        <i style={{ background: 'var(--wh-owed)' }} />
        Money out
      </span>
      <span>
        <i style={{ background: 'var(--wh-ultra)' }} />
        Cash position
      </span>
      {forecast && (
        <span>
          <i style={{ background: 'var(--wh-panel)', boxShadow: 'inset 0 0 0 1px var(--wh-rule)' }} />
          Forecast
        </span>
      )}
    </div>
  )
}

/* ---------------- Creep bars ---------------- */

interface CreepBarsProps {
  values: number[]
  width?: number
  height?: number
  floor?: number | null
  label?: string
  className?: string
}

/** Tile stacks that deepen over time, the latest in gold. For a subscription total over twelve months. */
export function CreepBars({ values, width = 520, height = 110, floor = null, label, className }: CreepBarsProps) {
  const stacks = useMemo(() => creepGeometry(values, { width, height, floor }), [values, width, height, floor])
  if (!stacks.length) return null
  const alt = label ?? `${fmt(values[0])} to ${fmt(values[values.length - 1])} over ${values.length} months`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} shapeRendering="crispEdges" className={`wh-chart${className ? ` ${className}` : ''}`} role="img" aria-label={alt}>
      {stacks.map((s) => (
        <path key={s.index} d={s.d} fill={s.gold ? 'var(--wh-stone)' : 'var(--wh-ultra)'} fillOpacity={s.opacity} />
      ))}
    </svg>
  )
}
