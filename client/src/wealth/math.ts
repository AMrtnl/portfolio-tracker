export type Point = { px: number; py: number }

export function scaleLinear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0 || 1
  const fn = (v: number) => r0 + ((v - d0) / span) * (r1 - r0)
  fn.invert = (p: number) => d0 + ((p - r0) / (r1 - r0 || 1)) * span
  fn.domain = domain
  return fn
}

export function scaleBand(count: number, [r0, r1]: [number, number], paddingInner = 0.34) {
  const step = (r1 - r0) / Math.max(count, 1)
  const bw = Math.max(1, step * (1 - paddingInner))
  const fn = (i: number) => r0 + i * step + (step - bw) / 2
  fn.bandwidth = bw
  fn.center = (i: number) => fn(i) + bw / 2
  fn.invert = (px: number) =>
    Math.max(0, Math.min(count - 1, Math.floor((px - r0) / step)))
  return fn
}

export function padDomain([min, max]: [number, number], pad = 0.08): [number, number] {
  if (min === max) return [min - 1, max + 1]
  const p = (max - min) * pad
  return [min - p, max + p]
}

/** Monotone cubic (Fritsch–Carlson): smooth, never invents a peak. */
export function curve(pts: Point[], lead = 'M'): string {
  const n = pts.length
  if (n < 3) return pts.map((p, i) => `${i ? 'L' : lead}${p.px} ${p.py}`).join(' ')
  const x = pts.map((p) => p.px)
  const y = pts.map((p) => p.py)
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) d[i] = (y[i + 1] - y[i]) / (x[i + 1] - x[i] || 1)
  const m = [d[0]]
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2
  m[n - 1] = d[n - 2]
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i] / d[i]
    const b = m[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = (3 / Math.sqrt(s)) * d[i]
      m[i] = t * a
      m[i + 1] = t * b
    }
  }
  let p = `${lead}${x[0]} ${y[0]}`
  for (let i = 0; i < n - 1; i++) {
    const dx = (x[i + 1] - x[i]) / 3
    p += ` C${x[i] + dx} ${y[i] + m[i] * dx} ${x[i + 1] - dx} ${y[i + 1] - m[i + 1] * dx} ${x[i + 1]} ${y[i + 1]}`
  }
  return p
}

export function stack(
  series: Array<{ values: number[] }>,
  len: number,
): Array<Array<{ y0: number; y1: number }>> {
  const out = series.map(() => [] as Array<{ y0: number; y1: number }>)
  for (let i = 0; i < len; i++) {
    let acc = 0
    for (let k = 0; k < series.length; k++) {
      const v = series[k].values[i] ?? 0
      out[k][i] = { y0: acc, y1: acc + v }
      acc += v
    }
  }
  return out
}
