import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Eases a number toward its target so a refreshed balance visibly settles
 * rather than snapping. Returns the target immediately when the user has
 * asked for reduced motion.
 */
export function useCountUp(value: number, durationMs = 850): number {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(0)
  const rafRef = useRef<number>()

  useEffect(() => {
    if (prefersReducedMotion()) {
      fromRef.current = value
      setDisplay(value)
      return
    }

    const from = fromRef.current
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (value - from) * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = value
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, durationMs])

  return display
}

interface AnimatedNumberProps {
  value: number
  format: (n: number) => string
  className?: string
  durationMs?: number
}

export function AnimatedNumber({
  value,
  format,
  className,
  durationMs = 850,
}: AnimatedNumberProps) {
  const display = useCountUp(value, durationMs)
  return <span className={cn('num', className)}>{format(display)}</span>
}
