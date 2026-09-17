import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { curve, padDomain, scaleBand, scaleLinear, stack } from '@/wealth/math'
import { PAD } from '@/wealth/tokens'
import { useChartInk, type ChartInk } from '@/wealth/ThemeContext'

export function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function useScrub(
  resolve: (e: ReactPointerEvent<HTMLDivElement>) => number | null,
  onScrub?: (i: number | null) => void,
) {
  const [cur, setCur] = useState<number | null>(null)
  const move = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const i = resolve(e)
      if (i != null && i !== cur) {
        setCur(i)
        onScrub?.(i)
      }
    },
    [resolve, cur, onScrub],
  )
  const release = () => {
    setCur(null)
    onScrub?.(null)
  }
  return {
    cur,
    handlers: {
      onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        move(e)
      },
      onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
        if (e.buttons || e.pointerType === 'mouse') move(e)
      },
      onPointerUp: release,
      onPointerLeave: release,
      onPointerCancel: release,
    },
  }
}

/* ---------- axis helpers ---------- */

function trim(n: number): string {
  return n.toFixed(Math.abs(n) >= 10 ? 0 : 1).replace(/\.0$/, '')
}

/** Compact axis labels: 1.2M, 850K, 42. `decimals` pins the precision when ticks sit close together. */
export function tickLabel(v: number, decimals?: number): string {
  const a = Math.abs(v)
  const fmt = (n: number) =>
    decimals != null ? n.toFixed(decimals).replace(/\.?0+$/, '') : trim(n)
  if (a >= 1e9) return `${fmt(v / 1e9)}B`
  if (a >= 1e6) return `${fmt(v / 1e6)}M`
  if (a >= 1e3) return `${fmt(v / 1e3)}K`
  return `${Math.round(v)}`
}

/** Labels for a tick set, with just enough precision that no two read the same. */
function tickLabels(ticks: number[], convert?: Convert): string[] {
  const vals = convert ? ticks.map(convert) : ticks
  for (let d = 0; d <= 3; d++) {
    const labels = vals.map((t) => tickLabel(t, d))
    if (new Set(labels).size === labels.length) return labels
  }
  return vals.map((t) => tickLabel(t, 3))
}

/** Up to `count` round ticks inside [min, max]. */
export function niceTicks(min: number, max: number, count = 3): number[] {
  const span = max - min
  if (!(span > 0)) return []
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = (norm >= 5 ? 5 : norm >= 2.5 ? 2.5 : norm >= 2 ? 2 : 1) * mag
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) {
    out.push(Number(v.toFixed(10)))
  }
  return out
}

/** Converts a stored value (USD) into the display currency before it is labelled. */
type Convert = (v: number) => number

/** Horizontal room for a tick label such as "1.5K" before the first bar. */
const TICK_GUTTER = 30

/** Dotted hairlines with a mono label tucked above each, the way a terminal prints a grid. */
function Grid({
  ticks,
  y,
  iw,
  ink,
  convert,
  hideZero = true,
  layer = 'both',
}: {
  ticks: number[]
  y: (v: number) => number
  iw: number
  ink: ChartInk
  convert?: Convert
  hideZero?: boolean
  /** Lines sit behind the marks; labels go on top with a surface halo so fills never hide them. */
  layer?: 'lines' | 'labels' | 'both'
}) {
  const labels = tickLabels(ticks, convert)
  return (
    <g pointerEvents="none">
      {ticks.map((t, i) => (
        <g key={t}>
          {layer !== 'labels' && (
            <line
              x1={0}
              x2={iw}
              y1={y(t)}
              y2={y(t)}
              stroke={ink.grid}
              strokeDasharray="1 3"
              shapeRendering="crispEdges"
            />
          )}
          {layer !== 'lines' && (t !== 0 || !hideZero) && (
            <text
              x={0}
              y={y(t) - 4}
              className="a-axis"
              paintOrder="stroke"
              stroke={ink.bg}
              strokeWidth={3}
              strokeLinejoin="round"
            >
              {labels[i]}
            </text>
          )}
        </g>
      ))}
    </g>
  )
}

/* ---------- tooltip ---------- */

type Money = (v: number) => string
const plain: Money = (v) => v.toLocaleString('de-CH', { maximumFractionDigits: 2 }).replace(/’/g, "'")

/**
 * One readout for every series at the cursor. It's HTML over the plot, so it
 * wraps and clips like text, and flips sides near the right edge.
 */
function Tip({
  x,
  width,
  title,
  rows,
}: {
  x: number
  width: number
  title: string
  rows: Array<{ color?: string; name: string; value: string; strong?: boolean }>
}) {
  const flip = x > width * 0.6
  return (
    <div
      className="a-tip"
      style={{ left: x, transform: flip ? 'translateX(calc(-100% - 14px))' : 'translateX(14px)' }}
      role="status"
    >
      <em>{title}</em>
      {rows.map((r) => (
        <span key={r.name} className={r.strong ? 'strong' : ''}>
          <i style={{ background: r.color ?? 'var(--ink)' }} />
          {r.name}
          <b>{r.value}</b>
        </span>
      ))}
    </div>
  )
}

/* ---------- composition (the rainbow) ---------- */

export interface ChartSeries {
  id: string
  name: string
  color: string
  values: number[]
}

interface StackedChartProps {
  series: ChartSeries[]
  net: number[]
  len: number
  height: number
  dates: (i: number) => string
  onScrub?: (i: number | null) => void
  showDebt?: boolean
  convert?: Convert
  /** Formats tooltip values; defaults to a plain number. */
  money?: Money
}

export function StackedChart({
  series,
  net,
  len,
  height,
  dates,
  onScrub,
  showDebt = false,
  convert,
  money = plain,
}: StackedChartProps) {
  const [ref, width] = useWidth()
  const ink = useChartInk()

  const c = useMemo(() => {
    if (!width || !series.length || len < 2) return null
    const iw = width - PAD.left - PAD.right
    const ih = height - PAD.top - PAD.bottom
    const x = scaleLinear([0, len - 1], [0, iw])
    const st = stack(series, len)
    const top = st[st.length - 1].reduce((m, p) => Math.max(m, p.y1), 0)
    const yMax = Math.max(top, 1) * 1.06
    const y = scaleLinear([0, yMax], [ih, 0])
    const bands = series.map((s, k) => {
      const upper = st[k].map((p, i) => ({ px: x(i), py: y(p.y1) }))
      const lower = st[k]
        .map((p, i) => ({ px: x(i), py: y(p.y0) }))
        .reverse()
      return { ...s, line: curve(upper), area: `${curve(upper)} ${curve(lower, 'L')} Z` }
    })
    const netPts = net.map((v, i) => ({ px: x(i), py: y(v) }))
    const grossPts = st[st.length - 1].map((p, i) => ({ px: x(i), py: y(p.y1) }))
    return {
      iw,
      ih,
      x,
      y,
      bands,
      st,
      netPts,
      ticks: niceTicks(0, yMax, 3),
      netLine: curve(netPts),
      debtWedge: `${curve(grossPts)} ${curve([...netPts].reverse(), 'L')} Z`,
    }
  }, [width, height, series, net, len])

  const resolve = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!c || !ref.current) return null
      const r = ref.current.getBoundingClientRect()
      return Math.max(
        0,
        Math.min(len - 1, Math.round(c.x.invert(e.clientX - r.left - PAD.left))),
      )
    },
    [c, len, ref],
  )

  const { cur, handlers } = useScrub(resolve, onScrub)
  const cx = c && cur != null ? c.x(cur) : null

  return (
    <div ref={ref} className="a-plot" style={{ height }} {...handlers}>
      {c && (
        <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <filter id="a-glow" x="-25%" y="-60%" width="150%" height="220%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
            <pattern
              id="a-hatch"
              width="6"
              height="6"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <line x1="0" y1="0" x2="0" y2="6" stroke={ink.ink} strokeWidth="1" opacity=".16" />
            </pattern>
          </defs>
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            <Grid ticks={c.ticks} y={c.y} iw={c.iw} ink={ink} convert={convert} layer="lines" />
            {c.bands.map((b, k) => (
              <g key={b.id} className="a-enter" style={{ animationDelay: `${k * 60}ms` }}>
                <path d={b.area} fill={b.color} opacity={ink.glow ? 0.17 : 0.09} />
                <path
                  d={b.line}
                  fill="none"
                  stroke={b.color}
                  strokeWidth={ink.glow ? 2.25 : 1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            ))}
            {showDebt && (
              <path
                d={c.debtWedge}
                fill="url(#a-hatch)"
                className="a-enter"
                style={{ animationDelay: '380ms' }}
              />
            )}
            <g className="a-enter" style={{ animationDelay: '420ms' }}>
              {ink.glow && (
                <g filter="url(#a-glow)" opacity=".5">
                  <path d={c.netLine} fill="none" stroke={ink.ink} strokeWidth="3" />
                </g>
              )}
              <path
                d={c.netLine}
                fill="none"
                stroke={ink.ink}
                strokeWidth={ink.glow ? 2.25 : 1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
            <Grid ticks={c.ticks} y={c.y} iw={c.iw} ink={ink} convert={convert} layer="labels" />
            <g transform={`translate(0,${c.ih + 6})`}>
              <text x={0} className="a-axis" textAnchor="start">
                {dates(0)}
              </text>
              <text x={c.iw} className="a-axis" textAnchor="end">
                {dates(len - 1)}
              </text>
            </g>
            {cx != null && cur != null && (
              <g pointerEvents="none">
                <line
                  x1={cx}
                  x2={cx}
                  y1={-8}
                  y2={c.ih}
                  stroke={ink.cursor}
                  strokeDasharray="2 4"
                />
                {c.bands.map((b, k) => (
                  <circle
                    key={b.id}
                    cx={cx}
                    cy={c.y(c.st[k][cur].y1)}
                    r="3.5"
                    fill={ink.bg}
                    stroke={b.color}
                    strokeWidth="2"
                  />
                ))}
                <circle cx={cx} cy={c.netPts[cur].py} r="11" fill={ink.ink} opacity=".16" />
                <circle cx={cx} cy={c.netPts[cur].py} r="4.5" fill={ink.ink} />
              </g>
            )}
          </g>
        </svg>
      )}
      {c && cx != null && cur != null && (
        <Tip
          x={cx + PAD.left}
          width={width}
          title={dates(cur)}
          rows={[
            { name: showDebt ? 'Net worth' : 'Total', value: money(net[cur] ?? 0), strong: true },
            ...[...series].reverse().map((b) => ({
              color: b.color,
              name: b.name,
              value: money(b.values[cur] ?? 0),
            })),
          ]}
        />
      )}
    </div>
  )
}

/* ---------- candles ---------- */

export interface Candle {
  o: number
  h: number
  l: number
  c: number
}

export function CandleChart({
  data,
  height,
  dates,
  onScrub,
  convert,
}: {
  data: Candle[]
  height: number
  dates: (i: number) => string
  onScrub?: (i: number | null) => void
  convert?: Convert
}) {
  const [ref, width] = useWidth()
  const ink = useChartInk()

  const c = useMemo(() => {
    if (!width || !data.length) return null
    const iw = width - PAD.left - PAD.right
    const ih = height - PAD.top - PAD.bottom
    const lows = data.map((d) => d.l)
    const highs = data.map((d) => d.h)
    const dom = padDomain([Math.min(...lows), Math.max(...highs)], 0.05)
    return {
      iw,
      ih,
      x: scaleBand(data.length, [0, iw]),
      y: scaleLinear(dom, [ih, 0]),
      ticks: niceTicks(dom[0], dom[1], 3),
    }
  }, [width, height, data])

  const resolve = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!c || !ref.current) return null
      return c.x.invert(e.clientX - ref.current.getBoundingClientRect().left - PAD.left)
    },
    [c, ref],
  )

  const { cur, handlers } = useScrub(resolve, onScrub)

  return (
    <div ref={ref} className="a-plot" style={{ height }} {...handlers}>
      {c && (
        <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            <Grid ticks={c.ticks} y={c.y} iw={c.iw} ink={ink} convert={convert} hideZero={false} />
            {data.map((d, i) => {
              const up = d.c >= d.o
              const col = up ? ink.gain : ink.loss
              const mid = c.x.center(i)
              const bh = Math.max(1.5, Math.abs(c.y(d.o) - c.y(d.c)))
              return (
                <g
                  key={i}
                  opacity={cur != null && cur !== i ? 0.3 : 1}
                  className="a-candle"
                  style={{ animationDelay: `${Math.min(i * 5, 300)}ms` }}
                >
                  <line
                    x1={mid}
                    x2={mid}
                    y1={c.y(d.h)}
                    y2={c.y(d.l)}
                    stroke={col}
                    strokeWidth="1.25"
                    strokeLinecap="round"
                  />
                  <rect
                    x={c.x(i)}
                    y={c.y(Math.max(d.o, d.c))}
                    width={c.x.bandwidth}
                    height={bh}
                    rx={Math.min(2, c.x.bandwidth / 2)}
                    fill={col}
                  />
                </g>
              )
            })}
            <g transform={`translate(0,${c.ih + 6})`}>
              <text x={0} className="a-axis" textAnchor="start">
                {dates(0)}
              </text>
              <text x={c.iw} className="a-axis" textAnchor="end">
                {dates(data.length - 1)}
              </text>
            </g>
            {cur != null && (
              <line
                x1={c.x.center(cur)}
                x2={c.x.center(cur)}
                y1={-8}
                y2={c.ih}
                stroke={ink.cursor}
                strokeDasharray="2 4"
                pointerEvents="none"
              />
            )}
          </g>
        </svg>
      )}
    </div>
  )
}

/* ---------- sparkline ---------- */

export function Sparkline({
  values,
  color,
  w = 44,
  h = 20,
  fill = false,
  stretch = false,
}: {
  values?: number[] | null
  color: string
  w?: number
  h?: number
  /** Soft area under the line, for tiles. */
  fill?: boolean
  /** Fill the container's width instead of a fixed pixel width. */
  stretch?: boolean
}) {
  const d = useMemo(() => {
    if (!values || values.length < 2) return null
    const x = scaleLinear([0, values.length - 1], [1, w - 1])
    const y = scaleLinear(padDomain([Math.min(...values), Math.max(...values)], 0.15), [h - 2, 2])
    const pts = values.map((v, i) => ({ px: x(i), py: y(v) }))
    const line = curve(pts)
    return { line, area: `${line} L${pts[pts.length - 1].px} ${h} L${pts[0].px} ${h} Z` }
  }, [values, w, h])
  if (!d) return <span className="a-spark" />
  return (
    <svg
      className={`a-spark ${stretch ? 'stretch' : ''}`}
      width={stretch ? '100%' : w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio={stretch ? 'none' : 'xMidYMid meet'}
      aria-hidden="true"
    >
      {fill && <path d={d.area} fill={color} opacity=".12" />}
      <path
        d={d.line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        opacity=".9"
      />
    </svg>
  )
}

/* ---------- single line ---------- */

export function DetailChart({
  values,
  height = 168,
  color,
  dates,
  onScrub,
  convert,
  money = plain,
}: {
  values: number[]
  height?: number
  /** Defaults to ink; pass a class colour for a class view. */
  color?: string
  dates: (i: number) => string
  onScrub?: (i: number | null) => void
  convert?: Convert
  money?: Money
}) {
  const [ref, width] = useWidth()
  const ink = useChartInk()
  const stroke = color ?? ink.ink
  const c = useMemo(() => {
    if (!width || values.length < 2) return null
    const iw = width - PAD.left - PAD.right
    const ih = height - PAD.top - PAD.bottom
    const x = scaleLinear([0, values.length - 1], [0, iw])
    const dom = padDomain([Math.min(...values), Math.max(...values)])
    const y = scaleLinear(dom, [ih, 0])
    const pts = values.map((v, i) => ({ px: x(i), py: y(v) }))
    const line = curve(pts)
    return {
      iw,
      ih,
      x,
      y,
      pts,
      line,
      ticks: niceTicks(dom[0], dom[1], 3),
      area: `${line} L${pts[pts.length - 1].px} ${ih} L${pts[0].px} ${ih} Z`,
    }
  }, [width, height, values])

  const resolve = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!c || !ref.current) return null
      const r = ref.current.getBoundingClientRect()
      return Math.max(
        0,
        Math.min(values.length - 1, Math.round(c.x.invert(e.clientX - r.left - PAD.left))),
      )
    },
    [c, values.length, ref],
  )

  const { cur, handlers } = useScrub(resolve, onScrub)
  const a = c && cur != null ? c.pts[cur] : null

  return (
    <div ref={ref} className="a-plot" style={{ height }} {...handlers}>
      {c && (
        <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id="a-detfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={ink.glow ? 0.26 : 0.16} />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
            <filter id="a-detglow" x="-25%" y="-60%" width="150%" height="220%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            <Grid ticks={c.ticks} y={c.y} iw={c.iw} ink={ink} convert={convert} hideZero={false} layer="lines" />
            <path d={c.area} fill="url(#a-detfill)" />
            {ink.glow && (
              <g filter="url(#a-detglow)" opacity=".5">
                <path d={c.line} fill="none" stroke={stroke} strokeWidth="3" />
              </g>
            )}
            <path
              d={c.line}
              fill="none"
              stroke={stroke}
              strokeWidth={ink.glow ? 2.25 : 1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="a-enter"
            />
            <Grid ticks={c.ticks} y={c.y} iw={c.iw} ink={ink} convert={convert} hideZero={false} layer="labels" />
            <g transform={`translate(0,${c.ih + 6})`}>
              <text x={0} className="a-axis" textAnchor="start">
                {dates(0)}
              </text>
              <text x={c.iw} className="a-axis" textAnchor="end">
                {dates(values.length - 1)}
              </text>
            </g>
            {a && (
              <g pointerEvents="none">
                <line
                  x1={a.px}
                  x2={a.px}
                  y1={-8}
                  y2={c.ih}
                  stroke={ink.cursor}
                  strokeDasharray="2 4"
                />
                <circle cx={a.px} cy={a.py} r="11" fill={stroke} opacity=".18" />
                <circle cx={a.px} cy={a.py} r="4.5" fill={ink.bg} stroke={stroke} strokeWidth="2" />
              </g>
            )}
          </g>
        </svg>
      )}
      {a && cur != null && (
        <Tip
          x={a.px + PAD.left}
          width={width}
          title={dates(cur)}
          rows={[{ color: stroke, name: 'Value', value: money(values[cur]), strong: true }]}
        />
      )}
    </div>
  )
}

/* ---------- two rebased lines ---------- */

/** Portfolio (solid ink) against a benchmark (dashed grey), both rebased. */
export function CompareChart({
  a,
  b,
  height = 190,
  dates,
  aColor,
  bColor,
  convert,
}: {
  a: number[]
  b: number[]
  height?: number
  dates: (i: number) => string
  aColor?: string
  bColor?: string
  convert?: Convert
}) {
  const [ref, width] = useWidth()
  const ink = useChartInk()
  const ca = aColor ?? ink.ink
  const cb = bColor ?? ink.inkFaint

  const c = useMemo(() => {
    if (!width || a.length < 2) return null
    const iw = width - PAD.left - PAD.right
    const ih = height - PAD.top - PAD.bottom
    const all = [...a, ...b]
    const x = scaleLinear([0, a.length - 1], [0, iw])
    const dom = padDomain([Math.min(...all), Math.max(...all)])
    const y = scaleLinear(dom, [ih, 0])
    const line = (vals: number[]) =>
      curve(vals.map((v, i) => ({ px: x(Math.min(i, a.length - 1)), py: y(v) })))
    return { iw, ih, y, x, aLine: line(a), bLine: line(b), ticks: niceTicks(dom[0], dom[1], 3) }
  }, [width, height, a, b])

  return (
    <div ref={ref} className="a-plot static" style={{ height }}>
      {c && (
        <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <filter id="a-cmpglow" x="-25%" y="-60%" width="150%" height="220%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            <Grid ticks={c.ticks} y={c.y} iw={c.iw} ink={ink} convert={convert} hideZero={false} />
            <path
              d={c.bLine}
              fill="none"
              stroke={cb}
              strokeWidth="1.5"
              strokeDasharray="3 4"
              strokeLinecap="round"
              className="a-enter"
            />
            {ink.glow && (
              <g filter="url(#a-cmpglow)" opacity=".4">
                <path d={c.aLine} fill="none" stroke={ca} strokeWidth="3" />
              </g>
            )}
            <path
              d={c.aLine}
              fill="none"
              stroke={ca}
              strokeWidth={ink.glow ? 2.25 : 1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="a-enter"
            />
            <g transform={`translate(0,${c.ih + 6})`}>
              <text x={0} className="a-axis" textAnchor="start">
                {dates(0)}
              </text>
              <text x={c.iw} className="a-axis" textAnchor="end">
                {dates(a.length - 1)}
              </text>
            </g>
          </g>
        </svg>
      )}
    </div>
  )
}

/* ---------- bars ---------- */

/** Single-series month bars (income, deposits …). */
export function MiniBars({
  data,
  color,
  height = 150,
  convert,
}: {
  data: Array<{ label: string; value: number }>
  color?: string
  height?: number
  convert?: Convert
}) {
  const [ref, width] = useWidth()
  const ink = useChartInk()
  const fill = color ?? ink.inkSoft

  const c = useMemo(() => {
    if (!width || !data.length) return null
    const iw = width - 8
    const ih = height - 24
    const max = Math.max(...data.map((d) => d.value), 1) * 1.08
    // Bars start past the tick labels so the first one never sits under a number.
    return {
      iw,
      ih,
      x: scaleBand(data.length, [TICK_GUTTER, iw], 0.34),
      y: scaleLinear([0, max], [ih, 0]),
      ticks: niceTicks(0, max, 2),
    }
  }, [width, height, data])

  return (
    <div ref={ref} className="a-plot flow static" style={{ height }}>
      {c && (
        <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
          <g transform="translate(4,0)">
            <Grid ticks={c.ticks} y={c.y} iw={c.iw} ink={ink} convert={convert} layer="lines" />
            <line
              x1={0}
              x2={c.iw}
              y1={c.ih}
              y2={c.ih}
              stroke={ink.gridStrong}
              shapeRendering="crispEdges"
            />
            {data.map((d, i) => (
              <g key={`${d.label}-${i}`}>
                <rect
                  x={c.x(i)}
                  y={c.y(d.value)}
                  width={c.x.bandwidth}
                  height={Math.max(c.ih - c.y(d.value), d.value > 0 ? 2 : 0)}
                  rx={Math.min(2, c.x.bandwidth / 2)}
                  fill={fill}
                  className="a-bargrow"
                  style={{ animationDelay: `${i * 30}ms` }}
                />
                {(data.length <= 6 || i % 2 === 0) && (
                  <text x={c.x.center(i)} y={c.ih + 16} textAnchor="middle" className="a-axis">
                    {d.label}
                  </text>
                )}
              </g>
            ))}
            <Grid ticks={c.ticks} y={c.y} iw={c.iw} ink={ink} convert={convert} layer="labels" />
          </g>
        </svg>
      )}
    </div>
  )
}

/** Income (ink) beside spending (grey); spending past the budget turns red. */
export function FlowBars({
  data,
  height = 176,
  onScrub,
  budget,
  convert,
  money = plain,
}: {
  data: Array<{ label: string; income: number; spend: number }>
  height?: number
  onScrub?: (i: number | null) => void
  /** Monthly spending ceiling, drawn as a dashed reference line. */
  budget?: number
  convert?: Convert
  money?: Money
}) {
  const [ref, width] = useWidth()
  const ink = useChartInk()

  const c = useMemo(() => {
    if (!width || !data.length) return null
    const iw = width - 8
    const ih = height - 26
    const max =
      Math.max(...data.map((d) => Math.max(d.income, d.spend)), budget ?? 0, 1) * 1.08
    return {
      iw,
      ih,
      x: scaleBand(data.length, [TICK_GUTTER, iw], 0.28),
      y: scaleLinear([0, max], [ih, 0]),
      ticks: niceTicks(0, max, 3),
    }
  }, [width, height, data, budget])

  const resolve = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!c || !ref.current) return null
      return c.x.invert(e.clientX - ref.current.getBoundingClientRect().left - 4)
    },
    [c, ref],
  )

  const { cur, handlers } = useScrub(resolve, onScrub)

  return (
    <div ref={ref} className="a-plot flow" style={{ height }} {...handlers}>
      {c && (
        <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
          <g transform="translate(4,0)">
            <Grid ticks={c.ticks} y={c.y} iw={c.iw} ink={ink} convert={convert} layer="lines" />
            <line
              x1={0}
              x2={c.iw}
              y1={c.ih}
              y2={c.ih}
              stroke={ink.gridStrong}
              shapeRendering="crispEdges"
            />
            {data.map((d, i) => {
              const bw = c.x.bandwidth / 2 - 2
              const on = cur === i
              const dim = cur != null && !on
              const over = budget != null && d.spend > budget
              return (
                <g key={d.label} opacity={dim ? 0.34 : 1} className="a-flowgroup">
                  {on && (
                    <rect
                      x={c.x(i) - 5}
                      y={-6}
                      width={c.x.bandwidth + 10}
                      height={c.ih + 6}
                      rx="10"
                      fill={ink.band}
                    />
                  )}
                  <rect
                    x={c.x(i)}
                    y={c.y(d.income)}
                    width={bw}
                    height={c.ih - c.y(d.income)}
                    rx={Math.min(2, bw / 2)}
                    fill={ink.ink}
                    className="a-bargrow"
                  />
                  <rect
                    x={c.x(i) + bw + 4}
                    y={c.y(d.spend)}
                    width={bw}
                    height={c.ih - c.y(d.spend)}
                    rx={Math.min(2, bw / 2)}
                    fill={over ? ink.loss : ink.inkFaint}
                    className="a-bargrow"
                  />
                  <text
                    x={c.x.center(i)}
                    y={c.ih + 17}
                    textAnchor="middle"
                    className={`a-axis ${on ? 'on' : ''}`}
                  >
                    {d.label}
                  </text>
                </g>
              )
            })}
            <Grid ticks={c.ticks} y={c.y} iw={c.iw} ink={ink} convert={convert} layer="labels" />
            {budget != null && budget > 0 && (
              <g pointerEvents="none">
                <line
                  x1={0}
                  x2={c.iw}
                  y1={c.y(budget)}
                  y2={c.y(budget)}
                  stroke={ink.loss}
                  strokeDasharray="4 4"
                  shapeRendering="crispEdges"
                />
                <text x={c.iw} y={c.y(budget) - 4} textAnchor="end" className="a-axis loss">
                  Budget
                </text>
              </g>
            )}
          </g>
        </svg>
      )}
      {c && cur != null && data[cur] && (
        <Tip
          x={c.x.center(cur) + 4}
          width={width}
          title={data[cur].label}
          rows={[
            { color: ink.ink, name: 'Income', value: money(data[cur].income) },
            { color: ink.inkFaint, name: 'Spending', value: money(data[cur].spend) },
            {
              color: data[cur].income - data[cur].spend >= 0 ? ink.gain : ink.loss,
              name: 'Saved',
              value: money(data[cur].income - data[cur].spend),
              strong: true,
            },
          ]}
        />
      )}
    </div>
  )
}

/* ---------- ring & split ---------- */

export function Ring({
  pct,
  color,
  size = 58,
  stroke = 6.5,
  label,
}: {
  pct: number
  color: string
  size?: number
  stroke?: number
  label: string
}) {
  const ink = useChartInk()
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="a-ring" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ink.grid} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${(circ * Math.min(Math.max(pct, 0), 100)) / 100} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="a-ringarc"
      />
      <text x={size / 2} y={size / 2} dy="0.36em" textAnchor="middle" className="a-ringtxt">
        {label}
      </text>
    </svg>
  )
}

export interface SplitRow {
  key: string
  name: string
  color: string
  amount: number
  pct: number
  /** Optional emoji (e.g. a country flag) shown instead of the color dot. */
  icon?: string
}

export function SplitBar({
  rows,
  money,
  compactMode,
}: {
  rows: SplitRow[]
  money: (n: number) => string
  compactMode?: boolean
}) {
  if (!rows.length) {
    return <p className="a-insnote">No classification data yet.</p>
  }
  return (
    <>
      <div className={`a-split ${compactMode ? 'sm' : ''}`}>
        {rows.map((r) => (
          <i key={r.key} style={{ flex: Math.max(r.amount, 0.01), background: r.color }} title={r.name} />
        ))}
      </div>
      <div className="a-splitlegend">
        {rows.map((r) => (
          <span key={r.key}>
            {r.icon ? (
              <span className="a-flag" aria-hidden>
                {r.icon}
              </span>
            ) : (
              <i style={{ background: r.color }} />
            )}
            <em>{r.name}</em>
            <b>{r.pct.toFixed(1)}%</b>
            {!compactMode && <u>{money(r.amount)}</u>}
          </span>
        ))}
      </div>
    </>
  )
}

/* ---------- slope: then → now ---------- */

export interface SlopeRow {
  key: string
  name: string
  from: number
  to: number
  color?: string
}

/** Labels don't overlap: sorted by position, each pushed down to keep a line of clearance. */
function spread(ys: number[], min = 14): number[] {
  const order = ys.map((y, i) => ({ i, y })).sort((a, b) => a.y - b.y)
  let last = -Infinity
  for (const p of order) {
    if (p.y - last < min) p.y = last + min
    last = p.y
  }
  const out = new Array<number>(ys.length)
  for (const p of order) out[p.i] = p.y
  return out
}

/** Two dated columns joined by a line per row; drops read in red. */
export function SlopeChart({
  rows,
  money,
  fromLabel,
  toLabel,
  height,
}: {
  rows: SlopeRow[]
  money: (n: number) => string
  fromLabel: string
  toLabel: string
  height?: number
}) {
  const [ref, width] = useWidth()
  const ink = useChartInk()
  const h = height ?? Math.max(150, rows.length * 32 + 44)

  const c = useMemo(() => {
    if (!width || !rows.length) return null
    const gutter = Math.min(180, Math.max(120, width * 0.3))
    const x0 = gutter
    const x1 = width - gutter
    const top = 30
    const bottom = h - 14
    const all = rows.flatMap((r) => [r.from, r.to])
    const y = scaleLinear(padDomain([Math.min(...all), Math.max(...all)], 0.1), [bottom, top])
    return {
      x0,
      x1,
      y,
      top,
      bottom,
      ly: spread(rows.map((r) => y(r.from))),
      ry: spread(rows.map((r) => y(r.to))),
    }
  }, [width, rows, h])

  return (
    <div ref={ref} className="a-plot static" style={{ height: h }}>
      {c && (
        <svg width={width} height={h} style={{ display: 'block', overflow: 'visible' }}>
          <text x={c.x0} y={12} className="a-axis" textAnchor="middle">
            {fromLabel}
          </text>
          <text x={c.x1} y={12} className="a-axis" textAnchor="middle">
            {toLabel}
          </text>
          <line x1={c.x0} x2={c.x0} y1={c.top - 8} y2={c.bottom + 6} stroke={ink.grid} strokeDasharray="1 3" />
          <line x1={c.x1} x2={c.x1} y1={c.top - 8} y2={c.bottom + 6} stroke={ink.grid} strokeDasharray="1 3" />
          {rows.map((r, i) => {
            const down = r.to < r.from
            const col = down ? ink.loss : (r.color ?? ink.inkSoft)
            return (
              <g key={r.key} className="a-enter" style={{ animationDelay: `${i * 40}ms` }}>
                <line x1={c.x0} y1={c.y(r.from)} x2={c.x1} y2={c.y(r.to)} stroke={col} strokeWidth="1.5" />
                <circle cx={c.x0} cy={c.y(r.from)} r="3.5" fill={ink.bg} stroke={col} strokeWidth="1.5" />
                <circle cx={c.x1} cy={c.y(r.to)} r="3.5" fill={col} />
                <text x={c.x0 - 10} y={c.ly[i]} dy=".35em" textAnchor="end" className="a-axis">
                  {r.name}{' '}
                  <tspan style={{ fill: ink.ink, fontWeight: 700 }}>{money(r.from)}</tspan>
                </text>
                <text x={c.x1 + 10} y={c.ry[i]} dy=".35em" className={`a-axis ${down ? 'loss' : ''}`}>
                  <tspan style={{ fill: down ? ink.loss : ink.ink, fontWeight: 700 }}>{money(r.to)}</tspan>{' '}
                  {r.name}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

/* ---------- dumbbells: before → after ---------- */

export interface DumbbellRow {
  key: string
  name: string
  before: number
  after: number
}

/** One row per item: hollow dot for the reference, solid dot for now, delta at the right. */
export function Dumbbells({
  rows,
  money,
  beforeLabel = 'Average',
  afterLabel = 'This month',
  higherIsWorse = true,
}: {
  rows: DumbbellRow[]
  money: (n: number) => string
  beforeLabel?: string
  afterLabel?: string
  /** Spending reads a rise as bad; income would flip this. */
  higherIsWorse?: boolean
}) {
  const [ref, width] = useWidth()
  const ink = useChartInk()
  const rowH = 30
  const labelW = 108
  const deltaW = 76
  const top = 6
  const h = rows.length * rowH + top + 24

  const c = useMemo(() => {
    if (!width || !rows.length) return null
    const max = Math.max(...rows.flatMap((r) => [r.before, r.after]), 1)
    return { x: scaleLinear([0, max * 1.05], [labelW, width - deltaW]), x0: labelW, x1: width - deltaW }
  }, [width, rows])

  return (
    <div ref={ref} className="a-plot static" style={{ height: h }}>
      {c && (
        <svg width={width} height={h} style={{ display: 'block', overflow: 'visible' }}>
          {rows.map((r, i) => {
            const cy = top + i * rowH + rowH / 2
            const delta = r.after - r.before
            const bad = higherIsWorse ? delta > 0 : delta < 0
            const col = bad ? ink.loss : ink.ink
            return (
              <g key={r.key} className="a-enter" style={{ animationDelay: `${i * 40}ms` }}>
                <line x1={c.x0} x2={c.x1} y1={cy} y2={cy} stroke={ink.grid} strokeDasharray="1 3" />
                <text x={0} y={cy} dy=".35em" className="a-axis">
                  {r.name}
                </text>
                <line x1={c.x(r.before)} x2={c.x(r.after)} y1={cy} y2={cy} stroke={col} strokeWidth="1.5" />
                <circle cx={c.x(r.before)} cy={cy} r="3.5" fill={ink.bg} stroke={col} strokeWidth="1.5" />
                <circle cx={c.x(r.after)} cy={cy} r="3.5" fill={col} />
                <text x={width} y={cy} dy=".35em" textAnchor="end" className={`a-axis ${bad ? 'loss' : 'strong'}`}>
                  {delta >= 0 ? '+' : '−'}
                  {money(Math.abs(delta))}
                </text>
              </g>
            )
          })}
          <g transform={`translate(${labelW},${h - 6})`}>
            <circle cx={4} cy={-3} r="3" fill={ink.bg} stroke={ink.inkSoft} strokeWidth="1.5" />
            <text x={12} y={0} className="a-axis">
              {beforeLabel}
            </text>
            <circle cx={104} cy={-3} r="3" fill={ink.ink} />
            <text x={112} y={0} className="a-axis">
              {afterLabel}
            </text>
          </g>
        </svg>
      )}
    </div>
  )
}

/* ---------- flow: one source, many destinations ---------- */

export interface FlowTarget {
  key: string
  name: string
  value: number
  tone?: 'ink' | 'soft' | 'loss'
}

/** Ribbons from one bar on the left to a stack of destinations on the right. */
export function FlowChart({
  source,
  targets,
  money,
  height = 230,
}: {
  source: { name: string; value: number }
  targets: FlowTarget[]
  money: (n: number) => string
  height?: number
}) {
  const [ref, width] = useWidth()
  const ink = useChartInk()

  const c = useMemo(() => {
    if (!width || !targets.length) return null
    const labelW = Math.min(170, width * 0.36)
    const nodeW = 6
    const gap = 6
    const x0 = 2
    const x1 = width - labelW - nodeW
    const top = 24
    const ih = height - top - 8
    const sum = targets.reduce((s, t) => s + t.value, 0)
    const total = Math.max(source.value, sum, 1)
    const scale = (ih - gap * (targets.length - 1)) / total
    let ly = top
    let ry = top
    const ribbons = targets.map((t) => {
      const hgt = Math.max(t.value * scale, 1.5)
      const r = { ...t, y0: ly, y1: ly + hgt, ry0: ry, ry1: ry + hgt }
      ly += hgt
      ry += hgt + gap
      return r
    })
    return { x0, x1, nodeW, top, ribbons, srcH: Math.max(source.value * scale, 1.5) }
  }, [width, height, targets, source])

  // Nodes carry the tone; ribbons stay light so the labels do the talking.
  const fillFor = (tone: FlowTarget['tone']) =>
    tone === 'ink' ? ink.ink : tone === 'loss' ? ink.loss : ink.inkFaint
  const ribbonFor = (tone: FlowTarget['tone']) => (tone === 'loss' ? ink.loss : ink.ink)
  const alphaFor = (tone: FlowTarget['tone']) => (tone === 'ink' ? 0.18 : tone === 'loss' ? 0.3 : 0.08)

  return (
    <div ref={ref} className="a-plot static" style={{ height }}>
      {c && (
        <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
          <text x={c.x0} y={c.top - 9} className="a-axis">
            {source.name}{' '}
            <tspan style={{ fill: ink.ink, fontWeight: 700 }}>{money(source.value)}</tspan>
          </text>
          <rect x={c.x0} y={c.top} width={c.nodeW} height={c.srcH} fill={ink.ink} />
          {c.ribbons.map((r, i) => {
            const xa = c.x0 + c.nodeW
            const xb = c.x1
            const m = (xa + xb) / 2
            const d = `M${xa} ${r.y0} C${m} ${r.y0} ${m} ${r.ry0} ${xb} ${r.ry0} L${xb} ${r.ry1} C${m} ${r.ry1} ${m} ${r.y1} ${xa} ${r.y1} Z`
            const col = fillFor(r.tone)
            return (
              <g key={r.key} className="a-enter" style={{ animationDelay: `${i * 50}ms` }}>
                <path d={d} fill={ribbonFor(r.tone)} opacity={alphaFor(r.tone)} />
                <rect x={xb} y={r.ry0} width={c.nodeW} height={r.ry1 - r.ry0} fill={col} />
                <text
                  x={xb + c.nodeW + 8}
                  y={(r.ry0 + r.ry1) / 2}
                  dy=".35em"
                  className={`a-axis ${r.tone === 'loss' ? 'loss' : ''}`}
                >
                  {r.name}{' '}
                  <tspan style={{ fill: r.tone === 'loss' ? ink.loss : ink.ink, fontWeight: 700 }}>
                    {money(r.value)}
                  </tspan>
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
