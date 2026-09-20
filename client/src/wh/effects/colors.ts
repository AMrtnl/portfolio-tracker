/**
 * Effects read their colours from the tokens on the element they sit in, so a
 * surface that declares data-ground="dark" restyles them by itself. Nothing in
 * an effect names a colour.
 */
export interface EffectInk {
  /** The ground the effect sits on: marble by day, night after dark. */
  ground: string
  /** The hairline colour, for grids that only whisper. */
  rule: string
  /** The blue. Dots and lifted lines by day. */
  ultra: string
  /** The ink of the ground: near-black by day, marble after dark. */
  ink: string
  /** Gold, for the roof and nothing else. */
  stone: string
  muted: string
}

const FALLBACK: EffectInk = { ground: '#FBF6EA', rule: '#E9E0CB', ultra: '#1F3FD0', ink: '#0C1230', stone: '#E2B23C', muted: '#5B6076' }

export function readInk(el: Element): EffectInk {
  const cs = getComputedStyle(el)
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  return {
    ground: v('--wh-marble', FALLBACK.ground),
    rule: v('--wh-rule', FALLBACK.rule),
    ultra: v('--wh-ultra', FALLBACK.ultra),
    ink: v('--wh-ink', FALLBACK.ink),
    stone: v('--wh-stone', FALLBACK.stone),
    muted: v('--wh-muted', FALLBACK.muted),
  }
}

/** Parses #rgb, #rrggbb or rgb(a)() into channels, for blending on a canvas. */
export function rgb(color: string): [number, number, number] {
  const c = color.trim()
  if (c[0] === '#') {
    const h = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1, 7)
    const n = parseInt(h, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const m = c.match(/[\d.]+/g)
  if (m && m.length >= 3) return [Number(m[0]), Number(m[1]), Number(m[2])]
  return [0, 0, 0]
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
export const smoothstep = (e0: number, e1: number, v: number) => {
  const t = clamp01((v - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}
