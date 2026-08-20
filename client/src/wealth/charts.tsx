import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { curve, padDomain, scaleBand, scaleLinear, stack } from '@/wealth/math'
import { GAIN, LOSS, PAD } from '@/wealth/tokens'

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
}

export function StackedChart({
  series,
  net,
  len,
  height,
  dates,
  onScrub,
  showDebt = false,
}: StackedChartProps) {
  const [ref, width] = useWidth()

  const c = useMemo(() => {
    if (!width || !series.length || len < 2) return null
    const iw = width - PAD.left - PAD.right
    const ih = height - PAD.top - PAD.bottom
    const x = scaleLinear([0, len - 1], [0, iw])
    const st = stack(series, len)
    const top = st[st.length - 1].reduce((m, p) => Math.max(m, p.y1), 0)
    const y = scaleLinear([0, Math.max(top, 1) * 1.06], [ih, 0])
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
              <line x1="0" y1="0" x2="0" y2="6" stroke="#fff" strokeWidth="1" opacity=".14" />
            </pattern>
          </defs>
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {c.bands.map((b, k) => (
              <g key={b.id} className="a-enter" style={{ animationDelay: `${k * 60}ms` }}>
                <path d={b.area} fill={b.color} opacity=".17" />
                <g filter="url(#a-glow)" opacity=".45">
                  <path d={b.line} fill="none" stroke={b.color} strokeWidth="3" />
                </g>
                <path
                  d={b.line}
                  fill="none"
                  stroke={b.color}
                  strokeWidth="2.25"
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
              <g filter="url(#a-glow)" opacity=".5">
                <path d={c.netLine} fill="none" stroke="#fff" strokeWidth="3" />
              </g>
              <path
                d={c.netLine}
                fill="none"
                stroke="#fff"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
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
                  stroke="rgba(255,255,255,.35)"
                  strokeDasharray="2 4"
                />
                {c.bands.map((b, k) => (
                  <circle
                    key={b.id}
                    cx={cx}
                    cy={c.y(c.st[k][cur].y1)}
                    r="3.5"
                    fill="#000"
                    stroke={b.color}
                    strokeWidth="2.5"
                  />
                ))}
                <circle cx={cx} cy={c.netPts[cur].py} r="12" fill="#fff" opacity=".18" />
                <circle cx={cx} cy={c.netPts[cur].py} r="5" fill="#fff" />
              </g>
            )}
          </g>
        </svg>
      )}
    </div>
  )
}

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
}: {
  data: Candle[]
  height: number
  dates: (i: number) => string
  onScrub?: (i: number | null) => void
}) {
  const [ref, width] = useWidth()

  const c = useMemo(() => {
    if (!width || !data.length) return null
    const iw = width - PAD.left - PAD.right
    const ih = height - PAD.top - PAD.bottom
    const lows = data.map((d) => d.l)
    const highs = data.map((d) => d.h)
    const dom = padDomain([Math.min(...lows), Math.max(...highs)], 0.05)
    return { iw, ih, x: scaleBand(data.length, [0, iw]), y: scaleLinear(dom, [ih, 0]) }
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
            {data.map((d, i) => {
              const up = d.c >= d.o
              const col = up ? GAIN : LOSS
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
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <rect
                    x={c.x(i)}
                    y={c.y(Math.max(d.o, d.c))}
                    width={c.x.bandwidth}
                    height={bh}
                    rx={Math.min(3, c.x.bandwidth / 2)}
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
                stroke="rgba(255,255,255,.35)"
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

export function Sparkline({
  values,
  color,
  w = 44,
  h = 20,
}: {
  values?: number[] | null
  color: string
  w?: number
  h?: number
}) {
  const d = useMemo(() => {
    if (!values || values.length < 2) return null
    const x = scaleLinear([0, values.length - 1], [1, w - 1])
    const y = scaleLinear(padDomain([Math.min(...values), Math.max(...values)], 0.15), [h - 2, 2])
    return curve(values.map((v, i) => ({ px: x(i), py: y(v) })))
  }, [values, w, h])
  if (!d) return <span className="a-spark" />
  return (
    <svg className="a-spark" width={w} height={h} aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".85"
      />
    </svg>
  )
}

export function DetailChart({
  values,
  height = 168,
  color,
  dates,
  onScrub,
}: {
  values: number[]
  height?: number
  color: string
  dates: (i: number) => string
  onScrub?: (i: number | null) => void
}) {
  const [ref, width] = useWidth()
  const c = useMemo(() => {
    if (!width || values.length < 2) return null
    const iw = width - PAD.left - PAD.right
    const ih = height - PAD.top - PAD.bottom
    const x = scaleLinear([0, values.length - 1], [0, iw])
    const y = scaleLinear(padDomain([Math.min(...values), Math.max(...values)]), [ih, 0])
    const pts = values.map((v, i) => ({ px: x(i), py: y(v) }))
    const line = curve(pts)
    return {
      iw,
      ih,
      x,
      pts,
      line,
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
              <stop offset="0%" stopColor={color} stopOpacity=".26" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
            <filter id="a-detglow" x="-25%" y="-60%" width="150%" height="220%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            <path d={c.area} fill="url(#a-detfill)" />
            <g filter="url(#a-detglow)" opacity=".5">
              <path d={c.line} fill="none" stroke={color} strokeWidth="3" />
            </g>
            <path
              d={c.line}
              fill="none"
              stroke={color}
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="a-enter"
            />
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
                  stroke="rgba(255,255,255,.35)"
                  strokeDasharray="2 4"
                />
                <circle cx={a.px} cy={a.py} r="11" fill={color} opacity=".22" />
                <circle cx={a.px} cy={a.py} r="4.5" fill="#fff" />
              </g>
            )}
          </g>
        </svg>
      )}
    </div>
  )
}

export function FlowBars({
  data,
  height = 176,
  onScrub,
}: {
  data: Array<{ label: string; income: number; spend: number }>
  height?: number
  onScrub?: (i: number | null) => void
}) {
  const [ref, width] = useWidth()

  const c = useMemo(() => {
    if (!width || !data.length) return null
    const iw = width - 8
    const ih = height - 26
    const max = Math.max(...data.map((d) => Math.max(d.income, d.spend)), 1)
    return {
      iw,
      ih,
      x: scaleBand(data.length, [0, iw], 0.28),
      y: scaleLinear([0, max * 1.08], [ih, 0]),
    }
  }, [width, height, data])

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
            <line
              x1={0}
              x2={c.iw}
              y1={c.ih}
              y2={c.ih}
              stroke="rgba(255,255,255,.1)"
              shapeRendering="crispEdges"
            />
            {data.map((d, i) => {
              const bw = c.x.bandwidth / 2 - 2
              const on = cur === i
              const dim = cur != null && !on
              return (
                <g key={d.label} opacity={dim ? 0.34 : 1} className="a-flowgroup">
                  {on && (
                    <rect
                      x={c.x(i) - 5}
                      y={-6}
                      width={c.x.bandwidth + 10}
                      height={c.ih + 6}
                      rx="12"
                      fill="rgba(255,255,255,.07)"
                    />
                  )}
                  <rect
                    x={c.x(i)}
                    y={c.y(d.income)}
                    width={bw}
                    height={c.ih - c.y(d.income)}
                    rx={Math.min(4, bw / 2)}
                    fill={GAIN}
                    className="a-bargrow"
                  />
                  <rect
                    x={c.x(i) + bw + 4}
                    y={c.y(d.spend)}
                    width={bw}
                    height={c.ih - c.y(d.spend)}
                    rx={Math.min(4, bw / 2)}
                    fill={LOSS}
                    opacity=".9"
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
          </g>
        </svg>
      )}
    </div>
  )
}

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
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="a-ring" aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,.1)"
        strokeWidth={stroke}
      />
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
      <text
        x={size / 2}
        y={size / 2}
        dy="0.36em"
        textAnchor="middle"
        className="a-ringtxt"
      >
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
