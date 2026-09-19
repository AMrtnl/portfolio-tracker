import type { CSSProperties } from 'react'

/** Height is always width × 0.8. */
export const MARK_ASPECT = 0.8

export type MarkCut = 'l' | 'm' | 's' | 'xs'

/** The weight follows the width: 62 lines from 260 px, 46 down to 110, 24 down to 48, 15 heavy lines below. */
export function cutFor(width: number): MarkCut {
  if (width >= 260) return 'l'
  if (width >= 110) return 'm'
  if (width >= 48) return 's'
  return 'xs'
}

interface MarkProps {
  /** The only thing a caller decides. */
  width: number
  /** Hide from readers when the wordmark or a label beside it already says "Wealth Hub". */
  decorative?: boolean
  className?: string
  style?: CSSProperties
}

/**
 * The Wealth Hub mark. One component, one prop, no variant. It picks its
 * weight from its width and its cut from the ground it sits on: both cuts
 * render, and the surface's --wh-l / --wh-d switches show exactly one. On a
 * light ground the engraved lines are the shadows, in ultramarine. On a dark
 * ground the lines are the light, in marble. The roof is gold in both.
 */
export function Mark({ width, decorative = false, className, style }: MarkProps) {
  const cut = cutFor(width)
  const height = Math.round(width * MARK_ASPECT * 100) / 100
  const imgProps = { alt: '', width, height, decoding: 'async' as const, draggable: false }
  return (
    <span
      className={`wh-mark${className ? ` ${className}` : ''}`}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Wealth Hub'}
      aria-hidden={decorative || undefined}
      style={{ width, height, ...style }}
    >
      <img className="wh-mark-l" src={`/wh/logo/wh-l3-${cut}-light.svg`} {...imgProps} />
      <img className="wh-mark-d" src={`/wh/logo/wh-l3-${cut}-dark.svg`} {...imgProps} />
    </span>
  )
}

interface LockupProps {
  /** Wordmark font size in px. The mark's height matches it. */
  size?: number
  className?: string
}

/** Mark beside the wordmark: "Wealth Hub" in Instrument Serif, sentence case. */
export function Lockup({ size = 22, className }: LockupProps) {
  return (
    <span className={`wh-lockup${className ? ` ${className}` : ''}`} style={{ fontSize: size }}>
      <Mark width={Math.round(size / MARK_ASPECT)} decorative />
      <span className="wh-wordmark">Wealth Hub</span>
    </span>
  )
}
