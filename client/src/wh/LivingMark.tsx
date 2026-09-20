import { useEffect, useRef, type CSSProperties } from 'react'
import { useGround } from '@/wh/ground'
import { MARK_ASPECT } from '@/wh/Mark'

export type LivingEffect = 'pivot' | 'dots' | 'bloom' | 'follow'

interface LivingModule {
  setLightMap(text: string): void
  mount(el: HTMLElement, options?: { effect?: LivingEffect; dark?: boolean; coarse?: boolean }): { setDark(v: boolean): void; setEffect(v: LivingEffect): void }
}

const MODULE_URL = '/wh/living-mark.js'
const LIGHTMAP_URL = '/wh/temple-lightmap.txt'

let ready: Promise<LivingModule> | null = null

/** The engraving module and its light map, fetched once and shared by every living mark on the page. */
function load(): Promise<LivingModule> {
  if (!ready) {
    ready = Promise.all([
      import(/* @vite-ignore */ MODULE_URL) as Promise<LivingModule>,
      fetch(LIGHTMAP_URL).then((r) => {
        if (!r.ok) throw new Error(`light map ${r.status}`)
        return r.text()
      }),
    ]).then(([mod, text]) => {
      mod.setLightMap(text)
      return mod
    })
    ready.catch(() => {
      ready = null
    })
  }
  return ready
}

interface LivingMarkProps {
  /** At least 64. Below that the static mark is the right one. */
  width: number
  effect?: LivingEffect
  /** Hide from readers when a wordmark or a label beside it already says "Wealth Hub". */
  decorative?: boolean
  className?: string
  style?: CSSProperties
}

/**
 * The mark engraved live from the light map, so its lines can swing. Hover
 * pivots the lines from horizontal to vertical and back; tap toggles on touch,
 * Enter toggles on the keyboard; reduced motion snaps. It follows the ground
 * like the static mark: on a dark ground the lines are the light. Until the
 * module has loaded the static mark shows, so nothing flashes.
 */
export function LivingMark({ width, effect = 'pivot', decorative = false, className, style }: LivingMarkProps) {
  const ground = useGround()
  const ref = useRef<HTMLSpanElement>(null)
  const handle = useRef<ReturnType<LivingModule['mount']> | null>(null)
  const height = Math.round(width * MARK_ASPECT * 100) / 100

  useEffect(() => {
    let alive = true
    const el = ref.current
    if (!el) return
    load()
      .then((mod) => {
        if (!alive || !el) return
        handle.current = mod.mount(el, { effect, dark: ground === 'dark', coarse: width < 120 })
        el.classList.add('live')
      })
      .catch(() => undefined)
    return () => {
      alive = false
      handle.current = null
      el.classList.remove('live')
    }
    // The ground is pushed through setDark below; the effect and width fix the engraving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effect, width])

  useEffect(() => {
    handle.current?.setDark(ground === 'dark')
  }, [ground])

  return (
    <span
      ref={ref}
      className={`wh-living${className ? ` ${className}` : ''}`}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Wealth Hub'}
      aria-hidden={decorative || undefined}
      tabIndex={decorative ? -1 : 0}
      onKeyDown={(e) => {
        // Enter and Space toggle the swing, as a tap does; a span gets no click from the keyboard by itself.
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.currentTarget.click()
        }
      }}
      style={{ width, height, ...style }}
    >
      <img className="wh-living-static" src={`/wh/logo/wh-l3-${width >= 260 ? 'l' : width >= 110 ? 'm' : 's'}-${ground === 'dark' ? 'dark' : 'light'}.svg`} alt="" width={width} height={height} decoding="async" draggable={false} />
      <svg viewBox="0 8 100 84" width={width} height={height} aria-hidden="true" focusable="false">
        <g className="fg" fill="none" stroke="currentColor" strokeLinecap="round" />
        <g className="rf" fill="none" stroke="#E2B23C" strokeLinecap="round" />
      </svg>
    </span>
  )
}
