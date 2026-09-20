import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useGround } from '@/wh/ground'
import { useReducedMotion } from '@/wh/useMediaQuery'
import { mountGridLift, type GridLiftHandle } from './gridLift'
import './effects.css'

const LIGHTMAP_URL = '/wh/temple-lightmap.txt'
let lightMap: Promise<string> | null = null
function loadLightMap(): Promise<string> {
  if (!lightMap) {
    lightMap = fetch(LIGHTMAP_URL).then((r) => {
      if (!r.ok) throw new Error(`light map ${r.status}`)
      return r.text()
    })
    lightMap.catch(() => {
      lightMap = null
    })
  }
  return lightMap
}

interface GridLiftProps {
  height?: number
  spacing?: number
  className?: string
  style?: CSSProperties
  /** Anything laid over the grid. */
  children?: ReactNode
}

/**
 * A hairline grid with the temple inside it. Move across it and the temple's
 * cells rise out of the grid; tap or press Enter and a light sweeps across
 * once. Focusable, so the keyboard can reach it too.
 */
export function GridLift({ height = 320, spacing, className, style, children }: GridLiftProps) {
  const ground = useGround()
  const reduced = useReducedMotion()
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const handle = useRef<GridLiftHandle | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    loadLightMap()
      .then((map) => {
        if (!alive || !host.current || !canvas.current) return
        handle.current = mountGridLift(host.current, canvas.current, { lightMap: map, spacing, reducedMotion: reduced })
        setReady(true)
      })
      .catch(() => undefined)
    return () => {
      alive = false
      handle.current?.destroy()
      handle.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spacing])

  useEffect(() => {
    handle.current?.retheme()
  }, [ground])

  useEffect(() => {
    handle.current?.setReducedMotion(reduced)
  }, [reduced])

  return (
    <div
      ref={host}
      className={`wh-lift${ready ? ' ready' : ''}${className ? ` ${className}` : ''}`}
      style={{ height, ...style }}
      role="img"
      aria-label="The Wealth Hub temple drawn in a fine grid. Move across it and it rises."
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handle.current?.sweep()
        }
      }}
    >
      <canvas ref={canvas} className="wh-lift-canvas" aria-hidden="true" />
      {children}
    </div>
  )
}
