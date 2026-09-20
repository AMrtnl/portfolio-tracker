/**
 * Wealth Hub chart geometry. No dependencies, no DOM: every function turns
 * numbers into path strings and rectangles that the components draw.
 * Ported from the handoff's reference/code/charts.js and kept to the same
 * arithmetic so the picture matches the design to the pixel.
 *
 * Two registers: big charts are smooth and rounded; mini charts are pixel.
 */

/** 8 x 8 ordered-dither matrix. Thresholds run 0..63. */
export const BAYER8: number[][] = (() => {
  let m: number[][] = [[0]]
  for (let n = 1; n < 8; n *= 2) {
    const s = m.length
    const o: number[][] = Array.from({ length: s * 2 }, () => Array<number>(s * 2).fill(0))
    for (let i = 0; i < s; i++) {
      for (let j = 0; j < s; j++) {
        const v = m[i][j] * 4
        o[i][j] = v
        o[i][j + s] = v + 2
        o[i + s][j] = v + 3
        o[i + s][j + s] = v + 1
      }
    }
    m = o
  }
  return m
})()

/** One square tile as a path command. */
export const sq = (x: number, y: number, d: number): string => `M${x} ${y}h${d}v${d}h-${d}z`

const extent = (values: number[]): [number, number] => {
  let lo = Infinity
  let hi = -Infinity
  for (const v of values) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  return [lo, hi]
}

/* ---------------- Big chart: position over time ---------------- */

export interface AreaOptions {
  width?: number
  height?: number
}

export interface AreaGeometry {
  /** Snapped canvas, a whole number of cells. */
  W: number
  H: number
  cell: number
  /** The smooth line. */
  line: string
  /** The dot screen under it, one path. */
  dots: string
  /** Today: the last point on the line. */
  end: [number, number]
  /** y of each dotted grid line. */
  grid: number[]
  /** Sample points along the line, every 3 px. */
  points: Array<[number, number]>
}

/**
 * A smooth line over a dot-screen fill that thins downward. The line is
 * sampled every 3 px from a linear interpolation of the values, which is
 * what makes it read as one calm curve at any density of data.
 */
export function areaGeometry(values: number[], { width = 790, height = 170 }: AreaOptions = {}): AreaGeometry | null {
  if (values.length < 2 || width < 40 || height < 40) return null
  const c = width < 400 ? 5 : 6
  const cols = Math.floor(width / c)
  const rows = Math.floor(height / c)
  const W = cols * c
  const H = rows * c
  const top = 10
  const span = H - top - 8
  const [lo, hi] = extent(values)
  const n = values.length
  const at = (x: number): number => {
    const t = (x / (W - 8)) * (n - 1)
    const i = Math.min(n - 2, Math.max(0, Math.floor(t)))
    const f = t - i
    const v = values[i] + (values[i + 1] - values[i]) * f
    return top + (1 - (v - lo) / (hi - lo || 1)) * span
  }
  const points: Array<[number, number]> = []
  for (let x = 0; x <= W - 8; x += 3) points.push([x, at(x)])
  const line = 'M' + points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L')
  let dots = ''
  for (let i = 0; i < cols; i++) {
    if (i * c + c > W - 8) continue
    const j0 = Math.floor(at(i * c + c / 2) / c) + 1
    for (let j = j0; j < rows; j++) {
      const dens = 0.62 * Math.pow(1 - (j - j0) / Math.max(1, rows - j0), 1.2)
      if (BAYER8[j % 8][i % 8] / 64 < dens) dots += sq(i * c + 1, j * c + 1, c - 3)
    }
  }
  const end = points[points.length - 1]
  return { W, H, cell: c, line, dots, end, grid: [0.25, 0.5, 0.75].map((g) => H * g), points }
}

/* ---------------- Mini chart: stepped pixel sparkline ---------------- */

export interface SparkGeometry {
  d: string
  /** Red only when the series ends lower than it started. */
  negative: boolean
  viewW: number
  viewH: number
}

export function sparklineGeometry(values: number[], { height = 28 }: { width?: number; height?: number } = {}): SparkGeometry | null {
  if (values.length < 2) return null
  const c = 3
  const n = 21
  const rows = Math.floor(height / c)
  const [lo, hi] = extent(values)
  const ys = Array.from({ length: n }, (_, i) => {
    const v = values[Math.round((i / (n - 1)) * (values.length - 1))]
    return Math.round((1 - (v - lo) / (hi - lo || 1)) * (rows - 2))
  })
  let d = ''
  ys.forEach((y, i) => {
    const y1 = ys[i + 1] ?? y
    for (let yy = Math.min(y, y1); yy <= Math.max(y, y1); yy++) d += sq(i * c, yy * c, c - 1)
  })
  return { d, negative: values[values.length - 1] < values[0], viewW: n * c, viewH: rows * c }
}

/* ---------------- Percent: a meter of twenty slim upright bars ---------------- */

export interface MeterBar {
  on: boolean
  /** Set on the partial bar only. */
  opacity?: number
}

/** scale stretches small shares so they stay readable: 2.2 means 45% fills the meter. */
export function meterBars(pct: number, { scale = 2.2, n = 20 }: { scale?: number; n?: number } = {}): MeterBar[] {
  const f = Math.max(0, Math.min(n, ((pct * scale) / 100) * n))
  const full = Math.floor(f)
  const frac = f - full
  return Array.from({ length: n }, (_, k) => {
    if (k < full) return { on: true }
    if (k === full && frac > 0.25) return { on: true, opacity: Math.max(0.4, Number(frac.toFixed(2))) }
    return { on: false }
  })
}

/* ---------------- Allocation: one hundred bevelled tesserae ---------------- */

export type TesseraPart = { label: string; percent: number; color: string }

export interface Tessera {
  label: string
  color: string
}

/**
 * Tiles filled column by column. Percentages are rounded with the largest
 * remainder so the tiles always add up to exactly cols x rows.
 */
export function tesseraTiles(parts: TesseraPart[], { cols = 20, rows = 5 }: { cols?: number; rows?: number } = {}): Tessera[] {
  const total = cols * rows
  const sum = parts.reduce((s, p) => s + Math.max(0, p.percent), 0) || 1
  const raw = parts.map((p) => (Math.max(0, p.percent) / sum) * total)
  const counts = raw.map((r) => Math.floor(r))
  let left = total - counts.reduce((s, c) => s + c, 0)
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac)
  for (const { i } of order) {
    if (left <= 0) break
    counts[i]++
    left--
  }
  const tiles: Tessera[] = []
  parts.forEach((p, i) => {
    for (let k = 0; k < counts[i]; k++) tiles.push({ label: p.label, color: p.color })
  })
  return tiles
}

/* ---------------- Cash flow: paired bars, a position line, a forecast band ---------------- */

export interface CashflowInput {
  months: string[]
  ins: number[]
  outs: number[]
  position: number[]
  /** Index of the first forecast month. Equal to months.length when nothing is forecast. */
  forecastFrom: number
}

export interface CashflowBar {
  x: number
  y: number
  w: number
  h: number
  kind: 'in' | 'out'
  opacity: number
  index: number
}

export interface CashflowGeometry {
  width: number
  height: number
  slot: number
  band: { x: number; width: number } | null
  bars: CashflowBar[]
  /** Solid position line through the months that happened. */
  actual: string
  /** Dashed line from the last real month through the forecast. */
  forecast: string
  points: Array<[number, number]>
  grid: number[]
}

export function cashflowGeometry(input: CashflowInput, { width = 900, height = 240 }: { width?: number; height?: number } = {}): CashflowGeometry | null {
  const n = input.months.length
  if (n === 0) return null
  const from = Math.max(0, Math.min(n, input.forecastFrom))
  const slot = width / n
  const mx = Math.max(...input.ins, ...input.outs, 1) * 1.08
  const [pl, ph] = extent(input.position.length ? input.position : [0])
  const bars: CashflowBar[] = []
  for (let i = 0; i < n; i++) {
    const op = i >= from ? 0.38 : 1
    const x = i * slot + slot * 0.18
    const bw = slot * 0.28
    const hi = ((input.ins[i] ?? 0) / mx) * height
    const ho = ((input.outs[i] ?? 0) / mx) * height
    bars.push({ x, y: height - hi, w: bw, h: hi, kind: 'in', opacity: op, index: i })
    bars.push({ x: x + bw + slot * 0.06, y: height - ho, w: bw, h: ho, kind: 'out', opacity: op * 0.85, index: i })
  }
  const points: Array<[number, number]> = input.position.map((v, i) => [i * slot + slot / 2, height - 20 - ((v - pl) / (ph - pl || 1)) * (height - 70)])
  const path = (a: Array<[number, number]>) => (a.length ? 'M' + a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L') : '')
  return {
    width,
    height,
    slot,
    band: from < n ? { x: from * slot, width: width - from * slot } : null,
    bars,
    actual: path(points.slice(0, from)),
    forecast: from < n && from > 0 ? path(points.slice(from - 1)) : from === 0 ? path(points) : '',
    points,
    grid: [0.25, 0.5, 0.75].map((g) => height * g),
  }
}

/* ---------------- Creep: tile stacks that deepen over time, the latest in gold ---------------- */

export interface CreepStack {
  d: string
  gold: boolean
  opacity: number
  index: number
}

export function creepGeometry(values: number[], { width = 520, height = 110, floor = null }: { width?: number; height?: number; floor?: number | null } = {}): CreepStack[] {
  const n = values.length
  if (!n) return []
  const slot = width / n
  const t = Math.max(4, Math.floor(slot * 0.34))
  const [mn, mx] = extent(values)
  const lo = floor ?? mn * 0.8
  const hi = mx
  const rowsMax = Math.floor(height / t)
  return values.map((v, i) => {
    const r = Math.max(1, Math.round(((v - lo) / (hi - lo || 1)) * rowsMax))
    const x = i * slot + (slot - 2 * t - 1) / 2
    let d = ''
    for (let k = 0; k < r; k++) for (const cx of [0, 1]) d += sq(Math.round(x + cx * t), height - (k + 1) * t, t - 1)
    const last = i === n - 1
    return { d, gold: last, opacity: last ? 1 : Number((0.35 + (0.55 * i) / n).toFixed(2)), index: i }
  })
}

/* ---------------- Text alternatives ---------------- */

export function pctChange(values: number[]): number | null {
  if (values.length < 2 || !values[0]) return null
  return ((values[values.length - 1] - values[0]) / Math.abs(values[0])) * 100
}
