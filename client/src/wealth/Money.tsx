import NumberFlow from '@number-flow/react'
import { HIDDEN, moneyDigits, useMoney } from '@/wealth/format'

/**
 * An amount whose digits roll when the value changes — the Finary /
 * Robinhood odometer feel. Converted into the display currency and masked
 * under the privacy toggle like every other figure. Pass `animated={false}`
 * while scrubbing a chart so the number tracks the cursor instantly.
 */
export function Money({
  value,
  currency = 'USD',
  sign = false,
  animated = true,
  className,
}: {
  value: number
  currency?: string
  sign?: boolean
  animated?: boolean
  className?: string
}) {
  const { hidden, toDisplay } = useMoney()
  if (hidden) return <span className={className}>{HIDDEN}</span>
  const v = toDisplay(Number.isFinite(value) ? value : 0, currency)
  const digits = moneyDigits(Math.abs(v) < 100 ? Math.round(v * 10) / 10 : Math.round(v))
  const factor = 10 ** digits
  return (
    <NumberFlow
      className={className}
      value={Math.round(v * factor) / factor}
      locales="de-CH"
      format={{
        maximumFractionDigits: digits,
        minimumFractionDigits: 0,
        signDisplay: sign ? 'exceptZero' : 'auto',
        useGrouping: true,
      }}
      animated={animated}
      respectMotionPreference
    />
  )
}
