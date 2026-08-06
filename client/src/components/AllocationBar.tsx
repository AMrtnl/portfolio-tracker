import { chartColor, cn, formatPercent } from '@/lib/utils'

export interface AllocationSlice {
  label: string
  value: number
}

interface AllocationBarProps {
  slices: AllocationSlice[]
  /** How many labels to name inline before collapsing to "+N more". */
  namedCount?: number
  /** Off when a full table beneath the bar already names every segment. */
  showLegend?: boolean
  className?: string
}

/**
 * The composition of the portfolio as a single segmented rule — the hero's
 * one graphic. Unlike a sparkline this is real data, and it earns its place
 * by answering "what is this made of" without a second section.
 *
 * Segment gaps and the swatch legend follow Origin's and Acorns' allocation
 * treatments; the ramp is one colour family so a long tail never turns into
 * a rainbow.
 */
export function AllocationBar({
  slices,
  namedCount = 4,
  showLegend = true,
  className,
}: AllocationBarProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0)

  if (total <= 0 || slices.length === 0) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="h-2.5 w-full rounded-full bg-ink/[0.06]" />
        <p className="t-meta">Composition appears once holdings have value.</p>
      </div>
    )
  }

  const sorted = [...slices].sort((a, b) => b.value - a.value)
  const shown = sorted.filter((s) => (s.value / total) * 100 >= 0.4)
  const named = shown.slice(0, namedCount)
  const restCount = sorted.length - named.length

  return (
    <div className={cn('space-y-3', className)}>
      <div
        className="flex h-2.5 w-full gap-[2px] overflow-hidden"
        role="img"
        aria-label={`Portfolio composition: ${sorted
          .slice(0, Math.max(namedCount, 4))
          .map((s) => `${s.label} ${formatPercent((s.value / total) * 100).replace('+', '')}`)
          .join(', ')}`}
      >
        {shown.map((slice, i) => {
          const pct = (slice.value / total) * 100
          return (
            <span
              key={slice.label}
              title={`${slice.label} · ${formatPercent(pct).replace('+', '')}`}
              className="animate-seg h-full rounded-full first:rounded-l-full last:rounded-r-full"
              style={{
                flexGrow: pct,
                flexBasis: 0,
                background: chartColor(i),
                animationDelay: `${120 + i * 70}ms`,
              }}
            />
          )
        })}
      </div>

      {showLegend && (
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {named.map((slice, i) => (
          <li key={slice.label} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: chartColor(i) }}
            />
            <span className="font-medium">{slice.label}</span>
            <span className="num text-muted-foreground">
              {formatPercent((slice.value / total) * 100).replace('+', '')}
            </span>
          </li>
        ))}
        {restCount > 0 && (
          <li className="num text-xs text-muted-foreground">
            +{restCount} more
          </li>
        )}
      </ul>
      )}
    </div>
  )
}
