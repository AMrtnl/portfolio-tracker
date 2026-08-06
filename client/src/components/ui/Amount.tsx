import { cn, formatCurrency, formatPercent, splitMoney } from '@/lib/utils'

type AmountSize = 'hero' | 'lg' | 'md' | 'sm'

const SIZE: Record<AmountSize, string> = {
  hero: 'text-hero font-display',
  lg: 'text-hero-sm font-display',
  md: 'text-base font-medium',
  sm: 'text-sm',
}

const FRACTION: Record<AmountSize, string> = {
  hero: 'text-[0.42em] align-baseline',
  lg: 'text-[0.52em] align-baseline',
  md: '',
  sm: '',
}

interface AmountProps {
  value: number | string
  currency?: string
  compact?: boolean
  size?: AmountSize
  className?: string
  /** Hero and lg de-emphasise the cents; set false to keep one weight. */
  splitFraction?: boolean
}

/**
 * The single money renderer. Tabular figures everywhere, with the fraction
 * set smaller at display sizes so the magnitude reads first.
 */
export function Amount({
  value,
  currency,
  compact,
  size = 'md',
  className,
  splitFraction,
}: AmountProps) {
  const shouldSplit = splitFraction ?? (size === 'hero' || size === 'lg')

  if (!shouldSplit) {
    return (
      <span className={cn('num', SIZE[size], className)}>
        {formatCurrency(value, { currency, compact })}
      </span>
    )
  }

  const { lead, fraction } = splitMoney(value, { currency, compact })
  return (
    <span className={cn('num', SIZE[size], className)}>
      {lead}
      {fraction && (
        <span className={cn('text-muted-foreground/70', FRACTION[size])}>
          {fraction}
        </span>
      )}
    </span>
  )
}

interface DeltaProps {
  /** Percent change. */
  percent?: number | null
  /** Absolute change in currency. */
  amount?: number | null
  currency?: string
  /** `chip` tints a pill, `plain` colours the text only. */
  variant?: 'chip' | 'plain'
  size?: 'sm' | 'md' | 'lg'
  showArrow?: boolean
  className?: string
}

const DELTA_SIZE = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base sm:text-lg',
} as const

/**
 * Signed change. Mirrors the "$ move (percent)" pairing used by Yahoo
 * Finance and Quicken so a glance answers "how much" and "how fast".
 */
export function Delta({
  percent,
  amount,
  currency,
  variant = 'plain',
  size = 'md',
  showArrow = false,
  className,
}: DeltaProps) {
  const basis = amount ?? percent ?? 0
  const positive = basis >= 0

  const parts: string[] = []
  if (amount != null && Number.isFinite(amount)) {
    parts.push(formatCurrency(amount, { currency }))
  }
  if (percent != null && Number.isFinite(percent)) {
    parts.push(parts.length ? `(${formatPercent(percent)})` : formatPercent(percent))
  }
  if (parts.length === 0) return <span className="num text-muted-foreground">—</span>

  return (
    <span
      className={cn(
        'num inline-flex items-baseline gap-1 whitespace-nowrap font-medium',
        DELTA_SIZE[size],
        variant === 'chip'
          ? cn('rounded px-1.5 py-0.5', positive ? 'chip-gain' : 'chip-loss')
          : positive
            ? 'text-gain'
            : 'text-loss',
        className,
      )}
    >
      {showArrow && (
        <span aria-hidden className="text-[0.85em]">
          {positive ? '↗' : '↘'}
        </span>
      )}
      <span>{parts.join(' ')}</span>
      <span className="sr-only">{positive ? 'increase' : 'decrease'}</span>
    </span>
  )
}
