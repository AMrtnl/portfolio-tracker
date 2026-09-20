import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { useGround } from '@/wh/ground'
import { useReducedMotion } from '@/wh/useMediaQuery'
import { mountDotField, type DotFieldHandle } from './dotField'
import './effects.css'

interface DotFieldProps {
  /** A same-origin picture the dots are read from: ink on paper, as the garden is. */
  image: string
  /** The still shown on a dark ground before the field has drawn, when the picture has a night cut. */
  darkImage?: string
  /** Object-position percentages for the crop. */
  position?: [number, number]
  spacing?: number
  /** What the picture shows, for readers. Empty when it is decoration beside a figure. */
  alt?: string
  className?: string
  style?: CSSProperties
  /** Anything laid over the field: a plate with the figure, a serif line. */
  children?: ReactNode
}

/**
 * The garden as a live screen of dots that answers the pointer. The static
 * picture shows until the first frame is drawn, so nothing flashes, and stays
 * as the fallback where canvas is not available.
 */
export function DotField({ image, darkImage, position = [50, 50], spacing, alt = '', className, style, children }: DotFieldProps) {
  const ground = useGround()
  const reduced = useReducedMotion()
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const handle = useRef<DotFieldHandle | null>(null)

  useEffect(() => {
    if (!host.current || !canvas.current) return
    handle.current = mountDotField(host.current, canvas.current, { image, position, spacing, reducedMotion: reduced })
    return () => {
      handle.current?.destroy()
      handle.current = null
    }
    // Ground and motion are pushed through the handle below; a new image or crop rebuilds the field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, position[0], position[1], spacing])

  useEffect(() => {
    handle.current?.retheme()
  }, [ground])

  useEffect(() => {
    handle.current?.setReducedMotion(reduced)
  }, [reduced])

  return (
    <div ref={host} className={`wh-dots${className ? ` ${className}` : ''}`} style={style}>
      <img className="wh-dots-still" src={ground === 'dark' && darkImage ? darkImage : image} alt={alt} style={{ objectPosition: `${position[0]}% ${position[1]}%` }} draggable={false} />
      <canvas ref={canvas} className="wh-dots-canvas" aria-hidden="true" />
      {children}
    </div>
  )
}
