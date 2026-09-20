import type { CSSProperties } from 'react'
import './mark.css'

interface MarkProps {
  /** Pixel size. The mark is square. */
  size?: number
  /** Kept for callers that still size the mark by width. */
  width?: number
  /** On a tile: the glyph in white on the accent, as an app icon. Bare: the glyph in the accent on the ground. */
  tile?: boolean
  /** Hide from readers when the wordmark or a label beside it already says "Wealth Hub". */
  decorative?: boolean
  className?: string
  style?: CSSProperties
}

/**
 * The Wealth Hub mark: an open ring with its point, the hub everything
 * connects to. One shape at every size; the tile variant is the app icon.
 */
export function Mark({ size, width, tile = false, decorative = false, className, style }: MarkProps) {
  const px = size ?? width ?? 24
  const label = decorative ? undefined : 'Wealth Hub'
  return (
    <span
      className={`wh-mark${tile ? ' tile' : ''}${className ? ` ${className}` : ''}`}
      role={decorative ? undefined : 'img'}
      aria-label={label}
      aria-hidden={decorative || undefined}
      style={{ width: px, height: px, ...style }}
    >
      <svg viewBox="0 0 48 48" width={px} height={px} aria-hidden="true" focusable="false">
        {tile && <rect x="0" y="0" width="48" height="48" rx="11" className="wh-mark-tile" />}
        <circle cx="24" cy="24" r="13.5" fill="none" strokeWidth="5" strokeLinecap="round" pathLength="100" strokeDasharray="78 22" transform="rotate(-54 24 24)" className="wh-mark-ring" />
        <circle cx="35.2" cy="14.8" r="3.6" className="wh-mark-dot" />
      </svg>
    </span>
  )
}

interface LockupProps {
  /** Wordmark font size in px. The mark's height matches it. */
  size?: number
  tile?: boolean
  className?: string
}

/** Mark beside the wordmark: "Wealth Hub", set in the text face, tight. */
export function Lockup({ size = 18, tile = true, className }: LockupProps) {
  return (
    <span className={`wh-lockup${className ? ` ${className}` : ''}`} style={{ fontSize: size }}>
      <Mark size={Math.round(size * 1.35)} tile={tile} decorative />
      <span className="wh-wordmark">Wealth Hub</span>
    </span>
  )
}

/** Kept for callers that computed heights from the old aspect. */
export const MARK_ASPECT = 1
