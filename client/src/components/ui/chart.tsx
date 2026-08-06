import * as React from 'react'
import { cn, formatCurrency } from '@/lib/utils'

/* ==================================================================== *
 * Charts, hand-rolled.
 *
 * No chart library. Every glyph here is either an SVG <path> or a plain
 * div, which buys three things the aesthetic depends on:
 *
 *   1. All text is HTML, so it inherits our three families and the .num
 *      tabular figures. A charting library would set its own <text>.
 *   2. Hairlines stay hairlines. Paths carry vector-effect
 *      non-scaling-stroke, so a stretched viewBox never thickens a rule.
 *   3. Nothing ships a second copy of a layout engine.
 *
 * The plot area is a stretched viewBox (preserveAspectRatio="none"), so
 * only geometry lives in the SVG; labels and hover dots are absolutely
 * positioned HTML on top of it.
 * ==================================================================== */

const VB_W = 1000
const VB_H = 320

export interface Series {
  id: string
  label: string
  /** One entry per x tick. `null` breaks the line rather than faking a value. */
  values: Array<number | null>
  color: string
  dashed?: boolean
  /** Soft wash beneath the line. Only ever used on the primary series. */
  fill?: boolean
}

function extent(series: Series[]): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const s of series) {
    for (const v of s.values) {
      if (v == null || !Number.isFinite(v)) continue
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  if (min === max) return [min - Math.abs(min || 1) * 0.05, max + Math.abs(max || 1) * 0.05]
  return [min, max]
}

/** Fraction of the plot height for a value, 0 at the bottom. */
function normalise(value: number, min: number, max: number): number {
  return (value - min) / (max - min)
}

function xAt(index: number, count: number): number {
  if (count <= 1) return VB_W / 2
  return (index / (count - 1)) * VB_W
}

function yAt(value: number, min: number, max: number): number {
  // Inset by 6% top and bottom so peaks never sit on the frame.
  const t = normalise(value, min, max)
  return VB_H - (0.06 + t * 0.88) * VB_H
}

/** Splits on nulls so a gap in the data reads as a gap, not a straight line. */
function buildPath(values: Array<number | null>, min: number, max: number): string {
  const runs: string[] = []
  let open = false
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      open = false
      return
    }
    const cmd = open ? 'L' : 'M'
    runs.push(`${cmd}${xAt(i, values.length).toFixed(2)} ${yAt(v, min, max).toFixed(2)}`)
    open = true
  })
  return runs.join(' ')
}

function buildAreaPath(
  values: Array<number | null>,
  min: number,
  max: number,
): string {
  const defined = values
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v != null && Number.isFinite(p.v))
  if (defined.length < 2) return ''
  const first = defined[0]
  const last = defined[defined.length - 1]
  const line = defined
    .map(
      (p, idx) =>
        `${idx === 0 ? 'M' : 'L'}${xAt(p.i, values.length).toFixed(2)} ${yAt(
          p.v,
          min,
          max,
        ).toFixed(2)}`,
    )
    .join(' ')
  return `${line} L${xAt(last.i, values.length).toFixed(2)} ${VB_H} L${xAt(
    first.i,
    values.length,
  ).toFixed(2)} ${VB_H} Z`
}

/* ------------------------------------------------------------------ *
 * LinePlot
 * ------------------------------------------------------------------ */

interface LinePlotProps {
  series: Series[]
  /** X tick labels, one per value index. */
  labels: string[]
  /** Renders a y-axis tick. */
  formatValue: (value: number) => string
  /** Draws a dashed rule at this value — the 0% line on indexed charts. */
  baseline?: number
  /** Called as the pointer moves across the plot; null when it leaves. */
  onHover?: (index: number | null) => void
  hoverIndex?: number | null
  height?: string
  className?: string
  /** Accessible summary, since the graphic itself carries no text. */
  ariaLabel: string
}

export function LinePlot({
  series,
  labels,
  formatValue,
  baseline,
  onHover,
  hoverIndex,
  height = 'h-52 sm:h-64',
  className,
  ariaLabel,
}: LinePlotProps) {
  const count = labels.length
  const [min, max] = extent(series)
  const ticks = [max, min + (max - min) / 2, min]
  const gradientId = React.useId()

  function pointerIndex(event: React.PointerEvent<HTMLDivElement>): number {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / Math.max(1, rect.width)
    return Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))))
  }

  const active = hoverIndex != null && hoverIndex >= 0 && hoverIndex < count

  return (
    <div className={cn('relative', className)}>
      {/* Y ticks sit outside the plot so the plot itself stays edge to edge. */}
      <div className={cn('relative', height)}>
        <div
          className="absolute inset-0"
          onPointerMove={onHover ? (e) => onHover(pointerIndex(e)) : undefined}
          onPointerLeave={onHover ? () => onHover(null) : undefined}
          role="img"
          aria-label={ariaLabel}
        >
          <svg
            className="h-full w-full overflow-visible"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity="0.16" />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid: three hairlines, the middle one faintest. */}
            {[0, 1, 2].map((i) => {
              const y = yAt(ticks[i], min, max)
              return (
                <line
                  key={i}
                  x1="0"
                  x2={VB_W}
                  y1={y}
                  y2={y}
                  stroke="hsl(var(--ink))"
                  strokeOpacity={i === 1 ? 0.06 : 0.1}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}

            {baseline != null && baseline >= min && baseline <= max && (
              <line
                x1="0"
                x2={VB_W}
                y1={yAt(baseline, min, max)}
                y2={yAt(baseline, min, max)}
                stroke="hsl(var(--ink))"
                strokeOpacity="0.3"
                strokeWidth="1"
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {series.map((s) =>
              s.fill ? (
                <path
                  key={`${s.id}-fill`}
                  d={buildAreaPath(s.values, min, max)}
                  fill={`url(#${gradientId})`}
                  className="animate-fade-in"
                />
              ) : null,
            )}

            {series.map((s, i) =>
              // The solid line draws itself on; a dashed benchmark can't
              // (its dasharray is already spoken for), so it fades in.
              s.dashed ? (
                <path
                  key={s.id}
                  d={buildPath(s.values, min, max)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="1.4"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className="animate-fade-in"
                  style={{ animationDelay: `${240 + i * 60}ms` }}
                />
              ) : (
                <path
                  key={s.id}
                  d={buildPath(s.values, min, max)}
                  pathLength={1}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  className="animate-draw"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ),
            )}

            {active && (
              <line
                x1={xAt(hoverIndex!, count)}
                x2={xAt(hoverIndex!, count)}
                y1="0"
                y2={VB_H}
                stroke="hsl(var(--ink))"
                strokeOpacity="0.24"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/* Hover dots are HTML so a stretched viewBox can't turn them into
           * ellipses. */}
          {active &&
            series.map((s) => {
              const v = s.values[hoverIndex!]
              if (v == null || !Number.isFinite(v)) return null
              return (
                <span
                  key={`${s.id}-dot`}
                  aria-hidden
                  className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background"
                  style={{
                    background: s.color,
                    left: `${(hoverIndex! / Math.max(1, count - 1)) * 100}%`,
                    top: `${(yAt(v, min, max) / VB_H) * 100}%`,
                  }}
                />
              )
            })}
        </div>

        {/* Y labels ride the right edge, out of the way of the line's start. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex flex-col justify-between py-[calc(6%-0.4rem)]">
          {ticks.map((t, i) => (
            <span
              key={i}
              className="num bg-background/70 px-1 text-[0.6875rem] leading-none text-muted-foreground"
            >
              {formatValue(t)}
            </span>
          ))}
        </div>
      </div>

      {/* X ticks: first, middle, last. More than three crowds a phone. */}
      {count > 1 && (
        <div className="mt-2 flex justify-between text-[0.6875rem] text-muted-foreground">
          <span className="num">{labels[0]}</span>
          {count > 2 && (
            <span className="num hidden sm:inline">
              {labels[Math.floor((count - 1) / 2)]}
            </span>
          )}
          <span className="num">{labels[count - 1]}</span>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * MonthBars — income and net flows.
 *
 * Plain divs: a bar chart of twelve months needs no SVG, and HTML bars
 * can't be distorted by a stretched viewBox. Bars are square-cornered,
 * which sits better against the hairline rules than rounded caps.
 * ------------------------------------------------------------------ */

export interface MonthBar {
  /** ISO-ish month key, e.g. "2026-03". */
  month: string
  /** Stacked upward segments. Rendered bottom-up in array order. */
  segments: Array<{ id: string; value: number; color: string; label: string }>
  /** Signed total; negative bars hang below the axis. */
  total: number
}

export function MonthBars({
  bars,
  currency,
  className,
  ariaLabel,
}: {
  bars: MonthBar[]
  currency?: string
  className?: string
  ariaLabel: string
}) {
  const peak = Math.max(
    ...bars.map((b) => Math.abs(b.total)),
    ...bars.map((b) => b.segments.reduce((s, seg) => s + Math.abs(seg.value), 0)),
    0,
  )
  const hasNegative = bars.some((b) => b.total < 0)

  if (peak <= 0) {
    return (
      <div className={cn('space-y-2', className)}>
        {/* Keep the month axis visible so the shape of the empty period is
         * still legible — Kakao Pay's zero-income year. */}
        <div className="flex h-28 items-end gap-1.5 border-b border-border/70">
          {bars.map((b) => (
            <span key={b.month} className="flex-1 bg-ink/[0.045]" style={{ height: 2 }} />
          ))}
        </div>
        <MonthAxis bars={bars} />
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className={cn('flex gap-1.5', hasNegative ? 'h-32' : 'h-28')}
        role="img"
        aria-label={ariaLabel}
      >
        {bars.map((bar, i) => {
          const positive = bar.segments.filter((s) => s.value > 0)
          const negative = bar.segments.filter((s) => s.value < 0)
          const title = `${monthLabel(bar.month, true)} · ${formatCurrency(bar.total, {
            currency,
          })}`
          return (
            <div
              key={bar.month}
              className="flex flex-1 flex-col justify-end"
              title={title}
            >
              <div
                className="flex flex-col justify-end"
                style={{ flex: hasNegative ? '2 1 0%' : '1 1 0%' }}
              >
                {/* Stack top-down in the DOM so the first segment lands at
                 * the bottom of the bar. */}
                {[...positive].reverse().map((seg) => (
                  <span
                    key={seg.id}
                    className="animate-bar block w-full"
                    style={{
                      height: `${(Math.abs(seg.value) / peak) * 100}%`,
                      background: seg.color,
                      animationDelay: `${80 + i * 35}ms`,
                    }}
                  />
                ))}
              </div>

              {hasNegative && (
                <>
                  <span aria-hidden className="h-px w-full bg-ink/20" />
                  <div className="flex flex-1 flex-col justify-start">
                    {negative.map((seg) => (
                      <span
                        key={seg.id}
                        className="animate-bar-down block w-full"
                        style={{
                          height: `${(Math.abs(seg.value) / peak) * 100}%`,
                          background: seg.color,
                          animationDelay: `${80 + i * 35}ms`,
                        }}
                      />
                    ))}
                  </div>
                </>
              )}

              {!hasNegative && <span aria-hidden className="h-px w-full bg-ink/20" />}
            </div>
          )
        })}
      </div>
      <MonthAxis bars={bars} />
    </div>
  )
}

function MonthAxis({ bars }: { bars: MonthBar[] }) {
  return (
    <div className="flex gap-1.5" aria-hidden>
      {bars.map((bar, i) => (
        <span
          key={bar.month}
          className={cn(
            'num flex-1 truncate text-center text-[0.625rem] leading-none text-muted-foreground',
            // On a phone, name every third month so labels never collide.
            i % 3 === 0 ? 'opacity-100' : 'opacity-0 sm:opacity-100',
          )}
        >
          {monthLabel(bar.month)}
        </span>
      ))}
    </div>
  )
}

/** "2026-03" → "Mar" (or "Mar 2026" when long). */
export function monthLabel(month: string, long = false): string {
  const [y, m] = month.split('-')
  const date = new Date(Number(y), Number(m) - 1, 1)
  if (!Number.isFinite(date.getTime())) return month
  return date.toLocaleDateString('en-US', {
    month: 'short',
    ...(long ? { year: 'numeric' } : {}),
  })
}

/* ------------------------------------------------------------------ *
 * RangeTabs — the range selector under a chart.
 *
 * Origin sets these as plain text with a ring on the active one rather
 * than a row of filled pills; it keeps the chart the loudest thing on
 * the screen. Ranges the data can't fill yet are disabled, not hidden,
 * so the limit is legible.
 * ------------------------------------------------------------------ */

export function RangeTabs<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string; disabled?: boolean; hint?: string }>
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex gap-0.5', className)}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={opt.disabled}
            title={opt.hint}
            onClick={() => onChange(opt.value)}
            className={cn(
              'num rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-ink/[0.07] text-foreground ring-1 ring-inset ring-ink/15'
                : 'text-muted-foreground hover:text-foreground',
              opt.disabled && 'cursor-not-allowed opacity-35 hover:text-muted-foreground',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Meter — the inline weight bar on an allocation or concentration row.
 * Public's allocation table: a label, a share, and a bar that makes the
 * share comparable down the column without a second chart.
 * ------------------------------------------------------------------ */

export function Meter({
  percent,
  color,
  className,
  delayMs = 0,
}: {
  percent: number
  color?: string
  className?: string
  delayMs?: number
}) {
  return (
    <span
      aria-hidden
      className={cn('block h-1 w-full overflow-hidden bg-ink/[0.06]', className)}
    >
      <span
        className="animate-seg block h-full"
        style={{
          width: `${Math.max(0, Math.min(100, percent))}%`,
          background: color ?? 'hsl(var(--chart-1))',
          animationDelay: `${delayMs}ms`,
        }}
      />
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * MarkerScale — a value placed on a named scale.
 *
 * Nutmeg puts its risk score on a labelled track with a marker above it
 * rather than printing the raw number; Binance does the same with its
 * portfolio score. That's the right treatment for diversification: the
 * index itself means nothing to most people, but "where you sit between
 * concentrated and spread out" does.
 * ------------------------------------------------------------------ */

export function MarkerScale({
  fraction,
  stops,
  valueLabel,
  className,
}: {
  /** 0–1 position along the track. */
  fraction: number
  /** Names beneath the track, left to right. */
  stops: string[]
  valueLabel: string
  className?: string
}) {
  const clamped = Math.max(0, Math.min(1, fraction))
  return (
    <div className={cn('w-full', className)}>
      <div className="relative h-5">
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap text-[0.6875rem] font-semibold"
          style={{ left: `${clamped * 100}%` }}
        >
          {valueLabel}
        </span>
      </div>
      <div className="relative">
        <span
          aria-hidden
          className="block h-1.5 w-full"
          style={{
            background:
              'linear-gradient(90deg, hsl(var(--loss)/0.55) 0%, hsl(var(--warn)/0.5) 42%, hsl(var(--chart-2)) 78%, hsl(var(--gain)) 100%)',
          }}
        />
        <span
          aria-hidden
          className="absolute top-1/2 h-3.5 w-[3px] -translate-x-1/2 -translate-y-1/2 bg-foreground"
          style={{ left: `${clamped * 100}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between">
        {stops.map((stop) => (
          <span key={stop} className="text-[0.625rem] text-muted-foreground">
            {stop}
          </span>
        ))}
      </div>
    </div>
  )
}
