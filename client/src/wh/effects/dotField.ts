/**
 * The dot field: the garden drawn live as a screen of dots, so it can answer
 * the pointer. Each dot's size comes from the picture's density at that point,
 * the field breathes very slowly, and the pointer leaves a trail where the dots
 * draw in and take the blue more deeply before they settle back.
 *
 * After ObsidianUI's Dotted Grid (MIT), rebuilt for Wealth Hub: no shapes, no
 * black, no library. The picture is the shape, the colours are the tokens of
 * the ground it sits on, and reduced motion gets a still screen.
 */
import { clamp01, lerp, readInk, rgb, smoothstep, type EffectInk } from './colors'

export interface DotFieldOptions {
  /** A same-origin picture. Dots take their size from how dark it is at each point. */
  image: string
  /** Where the picture is anchored when it is cropped to cover, as CSS object-position percentages. */
  position?: [number, number]
  /** Distance between dot centres in CSS px. */
  spacing?: number
  reducedMotion?: boolean
}

export interface DotFieldHandle {
  /** Re-read the tokens after the ground changed. */
  retheme(): void
  /** Update motion preference. */
  setReducedMotion(v: boolean): void
  destroy(): void
}

interface Dot {
  x: number
  y: number
  /** Picture density at the dot, 0 (paper) to 1 (ink). */
  d: number
  phase: number
  head: number
  trail: number
}

interface TrailPoint {
  x: number
  y: number
  t: number
}

const HEAD_RADIUS = 150
const TRAIL_RADIUS = 110
const TRAIL_FADE_MS = 1100
const TRAIL_MAX = 40
const SETTLE = 0.1

export function mountDotField(host: HTMLElement, canvas: HTMLCanvasElement, opts: DotFieldOptions): DotFieldHandle {
  const ctx = canvas.getContext('2d', { alpha: false })
  const spacing = opts.spacing ?? 6
  const position = opts.position ?? [50, 50]
  let reduced = Boolean(opts.reducedMotion)
  let ink: EffectInk = readInk(host)
  let ground = rgb(ink.ground)
  let blue = rgb(ink.ultra)
  let width = 0
  let height = 0
  let dpr = 1
  let dots: Dot[] = []
  let cols = 0
  let rows = 0
  let raf = 0
  let running = false
  let idleSince = 0
  let image: HTMLImageElement | null = null
  let destroyed = false
  const pointer = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, active: false }
  let trail: TrailPoint[] = []
  const sampler = document.createElement('canvas')
  const sctx = sampler.getContext('2d', { willReadFrequently: true })

  if (!ctx || !sctx) {
    return { retheme() {}, setReducedMotion() {}, destroy() {} }
  }

  /** Draw the picture cropped to cover the field, one pixel per dot, and read its darkness. */
  function sample() {
    if (!image || !cols || !rows) return
    sampler.width = cols
    sampler.height = rows
    const iw = image.naturalWidth || 1
    const ih = image.naturalHeight || 1
    const scale = Math.max(width / iw, height / ih)
    const dw = iw * scale
    const dh = ih * scale
    const ox = (width - dw) * (position[0] / 100)
    const oy = (height - dh) * (position[1] / 100)
    sctx!.imageSmoothingEnabled = true
    sctx!.imageSmoothingQuality = 'high'
    sctx!.clearRect(0, 0, cols, rows)
    // Map the field (width × height) onto the sampler (cols × rows).
    sctx!.setTransform(cols / width, 0, 0, rows / height, 0, 0)
    sctx!.drawImage(image, ox, oy, dw, dh)
    sctx!.setTransform(1, 0, 0, 1, 0, 0)
    let data: Uint8ClampedArray
    try {
      data = sctx!.getImageData(0, 0, cols, rows).data
    } catch {
      return
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = (j * cols + i) * 4
        const lum = (0.2126 * data[k] + 0.7152 * data[k + 1] + 0.0722 * data[k + 2]) / 255
        // The garden is ink on paper: darkness is presence. A gentle curve keeps the paper clear.
        const d = clamp01((1 - lum - 0.08) / 0.84)
        dots[j * cols + i].d = d * d * (3 - 2 * d)
      }
    }
  }

  function build() {
    cols = Math.max(1, Math.floor(width / spacing))
    rows = Math.max(1, Math.floor(height / spacing))
    const gx = (width - (cols - 1) * spacing) / 2
    const gy = (height - (rows - 1) * spacing) / 2
    dots = []
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        dots.push({ x: gx + i * spacing, y: gy + j * spacing, d: 0, phase: ((i * 7 + j * 13) % 17) / 17, head: 0, trail: 0 })
      }
    }
    sample()
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
    frame(performance.now(), true)
  }

  function frame(now: number, still = false) {
    const t = now * 0.001
    trail = trail.filter((p) => now - p.t < TRAIL_FADE_MS)
    if (!still) {
      pointer.x = lerp(pointer.x, pointer.tx, 0.18)
      pointer.y = lerp(pointer.y, pointer.ty, 0.18)
    }
    ctx!.fillStyle = ink.ground
    ctx!.fillRect(0, 0, width, height)
    const live = !reduced && !still
    const baseR = spacing * 0.5
    let busy = false
    for (const dot of dots) {
      if (dot.d <= 0.02 && dot.head <= 0.001 && dot.trail <= 0.001) continue
      // The pointer's head: dots near it draw in.
      let head = 0
      if (live && pointer.active) {
        const dx = dot.x - pointer.x
        const dy = dot.y - pointer.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < HEAD_RADIUS) {
          const n = 1 - dist / HEAD_RADIUS
          head = n * n * n
        }
      }
      // The trail: where the pointer has been, fading with age.
      let tr = 0
      if (live) {
        for (let i = 0; i < trail.length; i++) {
          const p = trail[i]
          const dx = dot.x - p.x
          if (dx > TRAIL_RADIUS || dx < -TRAIL_RADIUS) continue
          const dy = dot.y - p.y
          if (dy > TRAIL_RADIUS || dy < -TRAIL_RADIUS) continue
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist >= TRAIL_RADIUS) continue
          const age = (now - p.t) / TRAIL_FADE_MS
          const fade = (1 - age) * (1 - age) * ((i + 1) / trail.length)
          const prox = 1 - smoothstep(0, 1, dist / TRAIL_RADIUS)
          tr = Math.max(tr, prox * prox * fade)
        }
      }
      dot.head = live ? lerp(dot.head, head, SETTLE) : 0
      dot.trail = live ? lerp(dot.trail, tr, SETTLE * 0.8) : 0
      if (dot.head > 0.002 || dot.trail > 0.002) busy = true
      // Breathing: a slow, almost invisible swell, paper dots only.
      const breath = live ? 1 + 0.05 * Math.sin(t * 0.9 + dot.phase * Math.PI * 2 + dot.x * 0.01) : 1
      const shrink = 1 - dot.head * 0.55 - dot.trail * 0.35
      const r = baseR * (0.18 + 0.82 * dot.d) * breath * shrink
      if (r < 0.25) continue
      // Depth of blue: the picture's density, deepened along the trail.
      const a = clamp01(0.42 + 0.58 * dot.d + dot.trail * 0.5 + dot.head * 0.2)
      const c0 = ground
      const c1 = blue
      const rr = Math.round(lerp(c0[0], c1[0], a))
      const gg = Math.round(lerp(c0[1], c1[1], a))
      const bb = Math.round(lerp(c0[2], c1[2], a))
      ctx!.fillStyle = `rgb(${rr},${gg},${bb})`
      ctx!.beginPath()
      ctx!.arc(dot.x, dot.y, r, 0, Math.PI * 2)
      ctx!.fill()
    }
    if (!live) return
    // Keep drawing while something moves; rest a moment after, then stop until the pointer returns.
    if (busy || pointer.active || trail.length) idleSince = 0
    else if (!idleSince) idleSince = now
    if (idleSince && now - idleSince > 1600) {
      running = false
      raf = 0
      return
    }
    raf = requestAnimationFrame((n) => frame(n))
  }

  function wake() {
    if (reduced || running || destroyed) return
    running = true
    idleSince = 0
    raf = requestAnimationFrame((n) => frame(n))
  }

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (!pointer.active) {
      pointer.x = x
      pointer.y = y
    }
    pointer.tx = x
    pointer.ty = y
    pointer.active = true
    trail.push({ x, y, t: performance.now() })
    if (trail.length > TRAIL_MAX) trail.shift()
    wake()
  }
  const onLeave = () => {
    pointer.active = false
    wake()
  }
  // A tap on a touch screen drops a ring where the finger was, and lets it fade.
  const onTap = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const now = performance.now()
    for (let k = 0; k < 8; k++) trail.push({ x: x + Math.cos((k / 8) * Math.PI * 2) * 22, y: y + Math.sin((k / 8) * Math.PI * 2) * 22, t: now })
    wake()
  }

  host.addEventListener('pointermove', onMove)
  host.addEventListener('pointerleave', onLeave)
  host.addEventListener('pointerdown', onTap)
  const observer = new ResizeObserver(() => resize())
  observer.observe(host)

  // The breathing runs only while the field is on screen.
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries) => {
    if (entries.some((en) => en.isIntersecting)) wake()
    else if (raf) {
      cancelAnimationFrame(raf)
      raf = 0
      running = false
    }
  }) : null
  io?.observe(host)

  image = new Image()
  image.decoding = 'async'
  image.onload = () => {
    if (destroyed) return
    sample()
    frame(performance.now(), true)
    canvas.classList.add('live')
    wake()
  }
  image.src = opts.image
  resize()

  return {
    retheme() {
      ink = readInk(host)
      ground = rgb(ink.ground)
      blue = rgb(ink.ultra)
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
      wake()
    },
    destroy() {
      destroyed = true
      if (raf) cancelAnimationFrame(raf)
      observer.disconnect()
      io?.disconnect()
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
      host.removeEventListener('pointerdown', onTap)
      if (image) image.onload = null
    },
  }
}
