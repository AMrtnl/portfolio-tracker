import * as React from 'react'
import { AlertTriangle, Info, XOctagon } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ *
 * Banner — one component for every "something needs your attention"
 * message, replacing the ad-hoc tinted divs each page grew on its own.
 * ------------------------------------------------------------------ */

type BannerTone = 'info' | 'warn' | 'error'

const TONE: Record<
  BannerTone,
  { wrap: string; icon: typeof Info; iconClass: string; role: 'status' | 'alert' }
> = {
  info: {
    wrap: 'border-border/80 bg-secondary/50',
    icon: Info,
    iconClass: 'text-muted-foreground',
    role: 'status',
  },
  warn: {
    // Keep the tint faint and carry the signal on the left edge + icon; a
    // heavier amber fill reads as a beige slab against the paper background.
    wrap: 'border-warn/25 border-l-[3px] border-l-warn bg-[hsl(38_72%_52%/0.06)]',
    icon: AlertTriangle,
    iconClass: 'text-warn',
    role: 'alert',
  },
  error: {
    wrap: 'border-destructive/30 bg-destructive/[0.05]',
    icon: XOctagon,
    iconClass: 'text-destructive',
    role: 'alert',
  },
}

interface BannerProps {
  tone?: BannerTone
  title?: string
  children?: React.ReactNode
  /** Right-aligned resolution action — banners should be actionable. */
  action?: React.ReactNode
  className?: string
}

export function Banner({
  tone = 'info',
  title,
  children,
  action,
  className,
}: BannerProps) {
  const { wrap, icon: Icon, iconClass, role } = TONE[tone]
  return (
    <div
      role={role}
      className={cn(
        'flex gap-3 rounded-md border px-3.5 py-3 text-sm',
        wrap,
        className,
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconClass)} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1 space-y-0.5">
          {title && <p className="font-semibold">{title}</p>}
          {children && (
            <div className="text-[0.8125rem] leading-relaxed text-muted-foreground">
              {children}
            </div>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * EmptyState — small line-art glyph, one heading, one sentence, one action.
 * Deliberately a muted mark rather than a large illustration, matching the
 * shape Cleo, Chime and Monarch converge on for "nothing here yet".
 * ------------------------------------------------------------------ */

type GlyphName = 'ledger' | 'holdings' | 'positions' | 'activity' | 'link'

/** Small hand-drawn marks in the Meridian line weight — no emoji, no clip-art. */
function Glyph({ name }: { name: GlyphName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.25,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  return (
    <svg
      aria-hidden
      viewBox="0 0 48 48"
      className="h-10 w-10 text-primary/45"
      {...common}
    >
      {name === 'ledger' && (
        <>
          <path d="M10 8h22l6 6v26H10z" />
          <path d="M32 8v6h6M16 22h16M16 28h16M16 34h10" />
        </>
      )}
      {name === 'holdings' && (
        <>
          <circle cx="24" cy="24" r="14" />
          <path d="M24 10v14l11 6" />
        </>
      )}
      {name === 'positions' && (
        <>
          <path d="M8 34l9-11 7 6 8-13 8 8" />
          <path d="M8 40h32" />
        </>
      )}
      {name === 'activity' && (
        <>
          <path d="M9 12h30M9 24h30M9 36h30" />
          <circle cx="17" cy="12" r="2.5" />
          <circle cx="29" cy="24" r="2.5" />
          <circle cx="21" cy="36" r="2.5" />
        </>
      )}
      {name === 'link' && (
        <>
          <path d="M20 28l8-8" />
          <path d="M26 14l3-3a7 7 0 0110 10l-3 3M22 34l-3 3a7 7 0 01-10-10l3-3" />
        </>
      )}
    </svg>
  )
}

interface EmptyStateProps {
  glyph?: GlyphName
  title: string
  description?: string
  action?: React.ReactNode
  /** `inline` sits inside a data section; `page` fills a route. */
  size?: 'inline' | 'page'
  className?: string
}

export function EmptyState({
  glyph = 'ledger',
  title,
  description,
  action,
  size = 'inline',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        size === 'page' ? 'gap-4 py-20' : 'gap-3 py-12',
        className,
      )}
    >
      <Glyph name={glyph} />
      <div className="space-y-1.5">
        <p
          className={cn(
            'font-display text-foreground',
            size === 'page' ? 'text-2xl' : 'text-base',
          )}
        >
          {title}
        </p>
        {description && (
          <p className="mx-auto max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PanelUnavailable — one analysis panel couldn't load.
 *
 * These endpoints are computed server-side and can fail on their own, so
 * a failure is scoped to its own section and says which figure is
 * missing. Never a blank space, and never a fabricated number.
 * ------------------------------------------------------------------ */

export function PanelUnavailable({
  what,
  onRetry,
  className,
}: {
  /** Names the missing figure, e.g. "Sector allocation". */
  what: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-y border-border/60 py-6 text-sm sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-muted-foreground">
        {what} isn’t available right now. Nothing is wrong with your accounts —
        this figure is calculated separately.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 text-left text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * HistoryBuilding — the "we don't have this yet, and here's exactly why"
 * state for the value and benchmark charts.
 *
 * Meridian records one snapshot a day, so on day one there is no curve to
 * draw and there is no honest way to invent one. Clue and Apple Health
 * keep the empty plot frame and put a sentence inside it, which reads as
 * "this chart is real, it just has nothing to show" rather than as a
 * broken component. Turo and Spotify for Creators supply the phrasing:
 * name the threshold and say when to come back.
 * ------------------------------------------------------------------ */

export function HistoryBuilding({
  title,
  detail,
  footnote,
  height = 'h-52 sm:h-64',
  className,
}: {
  title: string
  detail: string
  footnote?: React.ReactNode
  height?: string
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden',
          height,
        )}
      >
        {/* The frame the chart will use, drawn empty. */}
        <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-px w-full"
              style={{ background: `hsl(var(--ink) / ${i === 1 ? 0.06 : 0.1})` }}
            />
          ))}
        </div>
        <div className="relative max-w-sm px-4 text-center">
          <p className="font-display text-base">{title}</p>
          <p className="mt-1.5 text-pretty text-[0.8125rem] leading-relaxed text-muted-foreground">
            {detail}
          </p>
        </div>
      </div>
      {footnote && <p className="t-meta">{footnote}</p>}
    </div>
  )
}

/**
 * Quicken flags a section whose numbers can't be computed yet with a small
 * "Insufficient data" marker on the heading instead of hiding the section.
 * Same idea, in the Meridian weight.
 */
export function PartialBadge({
  children = 'Still building',
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'chip-warn inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6875rem] font-semibold',
        className,
      )}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden />
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Skeletons — deliberately mirror the real geometry of each layout so
 * nothing reflows when data lands.
 * ------------------------------------------------------------------ */

export function SkeletonBlock({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton', className)} {...props} />
}

/** Placeholder in the shape of a chart: plot block, range row, legend. */
export function SkeletonChart({
  height = 'h-52 sm:h-64',
  className,
}: {
  height?: string
  className?: string
}) {
  return (
    <div className={cn('space-y-3', className)} aria-hidden>
      <SkeletonBlock className={cn('w-full', height)} />
      <div className="flex justify-between">
        <SkeletonBlock className="h-2.5 w-14" />
        <SkeletonBlock className="h-2.5 w-14" />
      </div>
    </div>
  )
}

/** Placeholder for a data table: header rule + n rows at real row height. */
export function SkeletonRows({
  rows = 5,
  className,
}: {
  rows?: number
  className?: string
}) {
  return (
    <div
      className={cn('divide-y divide-border/60 border-y border-border/60', className)}
      aria-hidden
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3.5">
          <SkeletonBlock className="h-8 w-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <SkeletonBlock
              className="h-3.5"
              style={{ width: `${38 + ((i * 13) % 26)}%` }}
            />
            <SkeletonBlock
              className="h-2.5"
              style={{ width: `${22 + ((i * 9) % 18)}%` }}
            />
          </div>
          <div className="w-24 space-y-1.5 sm:w-32">
            <SkeletonBlock className="ml-auto h-3.5 w-full" />
            <SkeletonBlock className="ml-auto h-2.5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
