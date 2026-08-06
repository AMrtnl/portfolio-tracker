import * as React from 'react'
import { ChevronDown, RefreshCw } from 'lucide-react'
import { cn, absoluteTime, freshness, relativeTime } from '@/lib/utils'

/* ------------------------------------------------------------------ *
 * SectionHead — heading on the left, the section's own total or count
 * on the right. Borrowed from Fidelity's account group headers, where
 * every group carries its own subtotal.
 * ------------------------------------------------------------------ */

interface SectionHeadProps {
  id: string
  title: string
  /** Right-aligned subtotal / count. */
  meta?: React.ReactNode
  /** Optional caption under the title. */
  caption?: string
  /** Controls rendered under the head (sort, filters). */
  children?: React.ReactNode
  level?: 2 | 3
  className?: string
}

export function SectionHead({
  id,
  title,
  meta,
  caption,
  children,
  level = 2,
  className,
}: SectionHeadProps) {
  const Heading = level === 2 ? 'h2' : 'h3'
  return (
    <div className={cn('mb-3', className)}>
      <div className="flex items-baseline justify-between gap-4">
        <Heading
          id={id}
          className={cn(
            'font-display tracking-tight',
            level === 2 ? 'text-lg sm:text-xl' : 'text-base',
          )}
        >
          {title}
        </Heading>
        {meta && <div className="shrink-0 text-sm text-muted-foreground">{meta}</div>}
      </div>
      {caption && <p className="t-meta mt-1">{caption}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * StatStrip — two to four figures on one line, separated by hairlines
 * and nothing else. Quicken's web investments header does exactly this
 * (Market value | Total gain | Today's change) and it's the calmest way
 * to state several totals without four boxes.
 *
 * On a phone the columns wrap into a two-up grid rather than shrinking
 * to unreadable widths.
 * ------------------------------------------------------------------ */

export interface Stat {
  label: string
  value: React.ReactNode
  /** Secondary line beneath the figure. */
  sub?: React.ReactNode
}

export function StatStrip({
  stats,
  className,
  animate = true,
}: {
  stats: Stat[]
  className?: string
  animate?: boolean
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-y-5 sm:flex sm:gap-0',
        // Vertical rules only once the columns sit on one line; on mobile
        // the grid gap does the separating.
        'sm:divide-rule',
        className,
      )}
    >
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={cn(
            'min-w-0 sm:flex-1 sm:px-5 sm:first:pl-0 sm:last:pr-0',
            animate && 'animate-rise',
            animate && `stagger-${Math.min(6, i + 1)}`,
          )}
        >
          <dt className="t-eyebrow mb-2">{stat.label}</dt>
          <dd className="truncate">{stat.value}</dd>
          {stat.sub && <p className="t-meta mt-1 truncate">{stat.sub}</p>}
        </div>
      ))}
    </dl>
  )
}

/* ------------------------------------------------------------------ *
 * DimensionPicker — a wide switch between named cuts of the same total.
 *
 * Public's portfolio tabs (Return / Allocation / Income / Account value)
 * and Monarch's "Group by type" both let one section answer several
 * questions without duplicating it. Segmented is right for two or three
 * choices; this handles five and still wraps on a phone.
 * ------------------------------------------------------------------ */

export function DimensionPicker<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string; disabled?: boolean }>
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        '-mx-1 flex gap-4 overflow-x-auto px-1 pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative shrink-0 whitespace-nowrap pb-2 text-sm font-medium transition-colors',
              'after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:transition-colors after:content-[""]',
              active
                ? 'text-foreground after:bg-primary'
                : 'text-muted-foreground after:bg-transparent hover:text-foreground hover:after:bg-border',
              opt.disabled && 'opacity-40 hover:text-muted-foreground',
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
 * DisclosureRow — a data row that expands in place into a key/value
 * detail block. This is Public's holding row: the summary stays put and
 * the breakdown slides in beneath it, so you never lose your place.
 * ------------------------------------------------------------------ */

interface DisclosureRowProps {
  /** Accessible name for the toggle. */
  label: string
  summary: React.ReactNode
  detail: React.ReactNode
  className?: string
}

export function DisclosureRow({
  label,
  summary,
  detail,
  className,
}: DisclosureRowProps) {
  const [open, setOpen] = React.useState(false)
  const id = React.useId()

  return (
    <li className={cn('border-b border-border/60 last:border-0', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`${id}-detail`}
        className={cn(
          'row-hover -mx-2 flex w-full items-center gap-3 rounded-md px-2 py-3 text-left',
          open && 'bg-accent/35',
        )}
      >
        <div className="min-w-0 flex-1">{summary}</div>
        <ChevronDown
          aria-hidden
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
        <span className="sr-only">
          {open ? `Hide details for ${label}` : `Show details for ${label}`}
        </span>
      </button>

      {open && (
        <div
          id={`${id}-detail`}
          className="animate-disclose surface-inset mb-3 rounded-md px-3 py-2.5"
        >
          {detail}
        </div>
      )}
    </li>
  )
}

/** Key/value pairs inside a disclosed row — Fidelity's "Details" block. */
export function DetailList({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>
}) {
  return (
    <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-1.5 last:border-0 sm:last:border-b sm:[&:nth-last-child(-n+2)]:border-0"
        >
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="num text-xs font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ------------------------------------------------------------------ *
 * Segmented — used for the holdings sort and the mobile account picker.
 * ------------------------------------------------------------------ */

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  className?: string
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-border/80 bg-background/60 p-0.5',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
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
 * SortHeader — a real sortable column header for the holdings grid.
 * ------------------------------------------------------------------ */

export type SortDirection = 'asc' | 'desc'

export function SortHeader<T extends string>({
  column,
  active,
  direction,
  onSort,
  align = 'right',
  children,
}: {
  column: T
  active: T
  direction: SortDirection
  onSort: (column: T) => void
  align?: 'left' | 'right'
  children: React.ReactNode
}) {
  const isActive = column === active
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      aria-label={`Sort by ${String(children)}${
        isActive ? `, currently ${direction === 'desc' ? 'descending' : 'ascending'}` : ''
      }`}
      className={cn(
        'group inline-flex w-full items-center gap-1 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors',
        align === 'right' ? 'justify-end' : 'justify-start',
        isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
      <ChevronDown
        aria-hidden
        className={cn(
          'h-3 w-3 transition-all duration-200',
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50',
          isActive && direction === 'asc' && 'rotate-180',
        )}
      />
    </button>
  )
}

/* ------------------------------------------------------------------ *
 * FreshnessNote + RefreshButton — every live surface states when it was
 * read and offers one way to read it again. Yahoo Finance puts the
 * "last refresh" line directly under the value; Rocket Money pairs the
 * timestamp with an inline "Sync now".
 * ------------------------------------------------------------------ */

export function FreshnessNote({
  iso,
  prefix = 'Updated',
  className,
}: {
  iso?: string | null
  prefix?: string
  className?: string
}) {
  if (!iso) return null
  const state = freshness(iso)
  return (
    <p className={cn('t-meta flex items-center gap-1.5', className)}>
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          state === 'fresh'
            ? 'bg-gain'
            : state === 'aging'
              ? 'bg-warn'
              : 'bg-muted-foreground/50',
        )}
      />
      <span>
        {prefix} <time dateTime={iso}>{relativeTime(iso)}</time>
        <span className="hidden sm:inline"> · {absoluteTime(iso)}</span>
      </span>
    </p>
  )
}

export function RefreshButton({
  onRefresh,
  busy,
  label = 'Refresh data',
  className,
}: {
  onRefresh: () => void
  busy?: boolean
  label?: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={busy}
      aria-label={label}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-md border border-border/80 bg-background/60 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/50 hover:text-foreground disabled:opacity-60',
        className,
      )}
    >
      <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} aria-hidden />
      <span className="hidden sm:inline">{busy ? 'Syncing' : 'Refresh'}</span>
    </button>
  )
}

/**
 * Transient "Updated" confirmation, the way Mercury acknowledges a sync.
 * Announced politely so a fetch is perceivable without sight.
 */
export function SyncToast({ visible }: { visible: boolean }) {
  return (
    <div aria-live="polite" className="pointer-events-none">
      {visible && (
        <span className="animate-toast surface inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gain" />
          Updated
        </span>
      )}
    </div>
  )
}
