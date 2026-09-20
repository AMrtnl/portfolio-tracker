/**
 * The grid lift: a fine hairline grid over the ground, and inside it the
 * temple, read from its light map. Near the pointer the temple's cells rise
 * out of the grid, drawn as a stack of ghost edges that gives them depth, in
 * the blue of the ground with the roof in gold. Leave, and they settle back.
 *
 * After ObsidianUI's Grid Lift (MIT), rebuilt for Wealth Hub: the mask is the
 * mark's own light map rather than a wordmark, the colours are tokens, a tap
 * on a touch screen sweeps a light across once, and reduced motion snaps.
 */
import { clamp01, lerp, readInk, type EffectInk } from './colors'

export interface GridLiftOptions {
  /** The light map text: 140 × 140 cells, one character each, space for empty. */
  lightMap: string
  /** Grid pitch in CSS px. */
  spacing?: number
  reducedMotion?: boolean
}

export interface GridLiftHandle {
  retheme(): void
  setReducedMotion(v: boolean): void
  /** Sweep a light across the temple once, as a tap or Enter does. */
  sweep(): void
  destroy(): void
}

interface Cell {
  x: number
  y: number
  cx: number
  cy: number
  roof: boolean
  /** How dark the light map is here, 0 to 1. Deep cells lift a little less. */
  depth: number
  lift: number
  target: number
  top: boolean
  left: boolean
  right: boolean
  bottom: boolean
}

const GW = 140
const GH = 140
const ALPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const LUT: Record<number, number> = {}
for (let q = 0; q < 64; q++) LUT[ALPH.charCodeAt(q)] = q

const HOVER_RADIUS = 420
const HOVER_FALLOFF = 1.5
const REACH = 140
const LIFT_HEIGHT = 46
const LIFT_ANGLE = (-86 * Math.PI) / 180
const SMOOTH = 0.09
const LAYERS = 14

export function mountGridLift(host: HTMLElement, canvas: HTMLCanvasElement, opts: GridLiftOptions): GridLiftHandle {
  const ctx = canvas.getContext('2d', { alpha: false })
  const spacing = opts.spacing ?? 12
  const map = opts.lightMap
  let reduced = Boolean(opts.reducedMotion)
  let ink: EffectInk = readInk(host)
  let width = 0
  let height = 0
  let dpr = 1
  let cells: Cell[] = []
  let raf = 0
  let running = false
  let destroyed = false
  // Where the mark sits in the field: centred, as tall as the field allows.
  let mx = 0
  let my = 0
  let ms = 1
  const pointer = { x: -1e4, y: -1e4, active: false }
  const sweepState = { on: false, start: 0 }
  const lightAt = { x: NaN, y: NaN, near: Infinity }

  if (!ctx) return { retheme() {}, setReducedMotion() {}, sweep() {}, destroy() {} }

  /** The light map value under a field point, or -1 outside the temple. */
  function cellAt(px: number, py: number): number {
    const u = ((px - mx) / ms) * GW
    const v = ((py - my) / ms) * GH
    const i = Math.floor(u)
    const j = Math.floor(v)
    if (i < 0 || j < 0 || i >= GW || j >= GH) return -1
    const c = map.charCodeAt(j * GW + i)
    if (Number.isNaN(c) || c === 32) return -1
    return LUT[c] ?? -1
  }

  function build() {
    // The map's drawn area is rows 8 to 92 of 100 in the mark's viewBox; fit the whole square so the temple
    // sits centred with breathing room on either side.
    ms = Math.min(width * 0.72, height * 1.1)
    mx = (width - ms) / 2
    my = (height - ms) / 2
    cells = []
    for (let x = 0; x <= width; x += spacing) {
      for (let y = 0; y <= height; y += spacing) {
        const cx = x + spacing / 2
        const cy = y + spacing / 2
        const v = cellAt(cx, cy)
        if (v < 0) continue
        cells.push({
          x,
          y,
          cx,
          cy,
          roof: (v >> 5) === 1,
          depth: (v & 31) / 31,
          lift: 0,
          target: 0,
          top: cellAt(cx, y) >= 0,
          left: cellAt(x, cy) >= 0,
          right: cellAt(x + spacing, cy) >= 0,
          bottom: cellAt(cx, y + spacing) >= 0,
        })
      }
    }
  }

  function resize() {
    const rect = host.getBoundingClientRect()
    width = Math.max(1, Math.round(rect.width))
    height = Math.max(1, Math.round(rect.height))
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    build()
    lightAt.x = NaN
    frame(performance.now(), true)
  }

  function nearest(x: number, y: number): number {
    let best = Infinity
    for (const c of cells) {
      const dx = c.cx - x
      const dy = c.cy - y
      const d = dx * dx + dy * dy
      if (d < best) best = d
    }
    return Math.sqrt(best)
  }

  function influence(cx: number, cy: number, px: number, py: number): number {
    const dx = cx - px
    const dy = cy - py
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > HOVER_RADIUS) return 0
    return Math.pow(1 - dist / HOVER_RADIUS, HOVER_FALLOFF)
  }

  function edges(c: Cell, ox: number, oy: number, alpha: number, lw: number, color: string) {
    const x1 = c.x + ox
    const y1 = c.y + oy
    const x2 = c.x + spacing + ox
    const y2 = c.y + spacing + oy
    ctx!.globalAlpha = alpha
    ctx!.strokeStyle = color
    ctx!.lineWidth = lw
    ctx!.beginPath()
    if (c.top) {
      ctx!.moveTo(x1, y1)
      ctx!.lineTo(x2, y1)
    }
    if (c.left) {
      ctx!.moveTo(x1, y1)
      ctx!.lineTo(x1, y2)
    }
    if (c.right) {
      ctx!.moveTo(x2, y1)
      ctx!.lineTo(x2, y2)
    }
    if (c.bottom) {
      ctx!.moveTo(x1, y2)
      ctx!.lineTo(x2, y2)
    }
    ctx!.stroke()
  }

  function frame(now: number, still = false) {
    const live = !reduced && !still
    // The light: the pointer, or the sweep travelling across.
    let px = pointer.x
    let py = pointer.y
    let lit = pointer.active
    if (sweepState.on) {
      const t = clamp01((now - sweepState.start) / 1700)
      const e = t * t * (3 - 2 * t)
      px = mx - ms * 0.15 + (ms * 1.3) * e
      py = my + ms * 0.5
      lit = true
      if (t >= 1) sweepState.on = false
    }
    // The nearest temple cell is only looked up again when the light has moved.
    if (lit && (px !== lightAt.x || py !== lightAt.y)) {
      lightAt.x = px
      lightAt.y = py
      lightAt.near = nearest(px, py)
    }
    const inReach = lit && lightAt.near <= REACH
    let busy = false
    for (const c of cells) {
      c.target = inReach ? influence(c.cx, c.cy, px, py) * (0.75 + 0.25 * (1 - c.depth)) : 0
      c.lift = reduced ? c.target : lerp(c.lift, c.target, SMOOTH)
      if (c.lift < 0.001) c.lift = 0
      if (Math.abs(c.lift - c.target) > 0.002) busy = true
    }

    ctx!.globalAlpha = 1
    ctx!.fillStyle = ink.ground
    ctx!.fillRect(0, 0, width, height)

    // The hairline grid.
    ctx!.strokeStyle = ink.rule
    ctx!.lineWidth = 1
    ctx!.beginPath()
    for (let x = 0.5; x <= width; x += spacing) {
      ctx!.moveTo(x, 0)
      ctx!.lineTo(x, height)
    }
    for (let y = 0.5; y <= height; y += spacing) {
      ctx!.moveTo(0, y)
      ctx!.lineTo(width, y)
    }
    ctx!.stroke()

    // The temple at rest: its cells drawn a shade deeper than the grid, so it is there before the light finds it.
    ctx!.lineCap = 'square'
    ctx!.lineJoin = 'miter'
    for (const c of cells) {
      const rest = 0.12 + 0.2 * c.depth
      edges(c, 0, 0, rest * (1 - c.lift * 0.6), 1, c.roof ? ink.stone : ink.ultra)
    }

    // The lift.
    const lx = Math.cos(LIFT_ANGLE) * LIFT_HEIGHT
    const ly = Math.sin(LIFT_ANGLE) * LIFT_HEIGHT
    for (const c of cells) {
      const k = c.lift
      if (k <= 0.001) continue
      const ox = lx * k
      const oy = ly * k
      const color = c.roof ? ink.stone : ink.ultra
      const alpha = 0.7 * k
      const layers = Math.max(3, Math.round(LAYERS * k))
      for (let i = 0; i < layers; i++) {
        const t = i / layers
        edges(c, ox * t, oy * t, alpha * (0.03 + t * 0.08), 0.8, color)
      }
      // The risers, from the grid up to the lifted face.
      ctx!.globalAlpha = alpha * 0.3
      ctx!.strokeStyle = color
      ctx!.lineWidth = 0.7
      ctx!.beginPath()
      const x1 = c.x
      const y1 = c.y
      const x2 = c.x + spacing
      const y2 = c.y + spacing
      if (c.top || c.left) {
        ctx!.moveTo(x1, y1)
        ctx!.lineTo(x1 + ox, y1 + oy)
      }
      if (c.top || c.right) {
        ctx!.moveTo(x2, y1)
        ctx!.lineTo(x2 + ox, y1 + oy)
      }
      if (c.bottom || c.left) {
        ctx!.moveTo(x1, y2)
        ctx!.lineTo(x1 + ox, y2 + oy)
      }
      if (c.bottom || c.right) {
        ctx!.moveTo(x2, y2)
        ctx!.lineTo(x2 + ox, y2 + oy)
      }
      ctx!.stroke()
      edges(c, ox, oy, alpha, 1 + k * 0.8, color)
    }
    ctx!.globalAlpha = 1

    if (!live) return
    if (busy || sweepState.on || pointer.active) raf = requestAnimationFrame((n) => frame(n))
    else {
      running = false
      raf = 0
    }
  }

  function wake() {
    if (running || destroyed) return
    if (reduced) {
      frame(performance.now(), false)
      return
    }
    running = true
    raf = requestAnimationFrame((n) => frame(n))
  }

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const rect = canvas.getBoundingClientRect()
    pointer.x = e.clientX - rect.left
    pointer.y = e.clientY - rect.top
    pointer.active = true
    wake()
  }
  const onLeave = () => {
    pointer.active = false
    wake()
  }
  const sweep = () => {
    if (destroyed) return
    sweepState.on = true
    sweepState.start = performance.now()
    if (reduced) {
      // No travel: the temple rises under a light at its centre for a moment, then rests.
      sweepState.on = false
      pointer.x = mx + ms / 2
      pointer.y = my + ms / 2
      pointer.active = true
      frame(performance.now(), false)
      window.setTimeout(() => {
        pointer.active = false
        frame(performance.now(), false)
      }, 900)
      return
    }
    wake()
  }
  const onTap = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return
    sweep()
  }

  host.addEventListener('pointermove', onMove)
  host.addEventListener('pointerleave', onLeave)
  host.addEventListener('pointerdown', onTap)
  const observer = new ResizeObserver(() => resize())
  observer.observe(host)
  resize()
  canvas.classList.add('live')

  return {
    retheme() {
      ink = readInk(host)
      frame(performance.now(), true)
      wake()
    },
    setReducedMotion(v) {
      reduced = v
      if (reduced && raf) {
        cancelAnimationFrame(raf)
        raf = 0
        running = false
      }
      frame(performance.now(), true)
    },
    sweep,
    destroy() {
      destroyed = true
      if (raf) cancelAnimationFrame(raf)
      observer.disconnect()
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
      host.removeEventListener('pointerdown', onTap)
    },
  }
}
