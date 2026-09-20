import type { CSSProperties } from 'react'
import type { IconName } from './icons'

interface IconProps {
  name: IconName
  /** Pixel size on the 24 px grid. Never under 16. */
  size?: number
  /** Filled when active or inside a token; outlined at rest. */
  filled?: boolean
  /** Required on an icon that stands alone. Decorative icons beside text leave it out and are hidden from readers. */
  label?: string
  className?: string
  style?: CSSProperties
}

/** A Material Symbols Rounded glyph. Weight 400, colour inherits from the text around it. */
export function Icon({ name, size = 24, filled = false, label, className, style }: IconProps) {
  const px = Math.max(16, size)
  const opsz = Math.min(48, Math.max(20, px))
  return (
    <span
      className={`wh-icon${filled ? ' fill' : ''}${className ? ` ${className}` : ''}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ fontSize: px, '--wh-opsz': opsz, ...style } as CSSProperties}
    >
      {name}
    </span>
  )
}
