import { describe, expect, it } from 'vitest'
import { BAYER8, areaGeometry, cashflowGeometry, creepGeometry, meterBars, pctChange, sparklineGeometry, sq, tesseraTiles } from './math'

const rising = Array.from({ length: 24 }, (_, i) => 1_200_000 + i * 3_500 + Math.sin(i / 2) * 9_000)

describe('BAYER8', () => {
  it('is an 8 x 8 matrix holding every threshold 0..63 once', () => {
    expect(BAYER8).toHaveLength(8)
    const all = BAYER8.flat().sort((a, b) => a - b)
    expect(all).toEqual(Array.from({ length: 64 }, (_, i) => i))
  })
})

describe('areaGeometry', () => {
  it('snaps the canvas to whole cells and samples the line every 3 px to the right edge', () => {
    const g = areaGeometry(rising, { width: 790, height: 170 })!
    expect(g.cell).toBe(6)
    expect(g.W % g.cell).toBe(0)
    expect(g.H % g.cell).toBe(0)
    expect(g.points[0][0]).toBe(0)
    expect(g.points[g.points.length - 1][0]).toBeLessThanOrEqual(g.W - 8)
    expect(g.line.startsWith('M0.0,')).toBe(true)
    expect(g.line.split(' L')).toHaveLength(g.points.length)
  })

  it('puts today at the top right for a rising series and keeps every dot below the line', () => {
    const g = areaGeometry(rising)!
    const [ex, ey] = g.end
    expect(ex).toBeGreaterThan(g.W * 0.9)
    expect(ey).toBeLessThan(g.H * 0.3)
    const ys = [...g.dots.matchAll(/M(\d+) (\d+)h/g)].map((m) => Number(m[2]))
    expect(ys.length).toBeGreaterThan(50)
    for (const y of ys) expect(y).toBeLessThan(g.H)
    expect(Math.min(...ys)).toBeGreaterThan(10)
  })

  it('uses smaller cells under 400 px and refuses fewer than two values', () => {
    expect(areaGeometry(rising, { width: 340, height: 120 })!.cell).toBe(5)
    expect(areaGeometry([1], {})).toBeNull()
  })

  it('handles a flat series without dividing by zero', () => {
    const g = areaGeometry([5, 5, 5, 5])!
    expect(g.line).not.toContain('NaN')
    // With no range the formula puts the whole line on the baseline, 8 px above the bottom.
    expect(g.end[1]).toBe(g.H - 8)
  })
})

describe('sparklineGeometry', () => {
  it('draws 21 columns on a 3 px grid and flags a series that ends lower', () => {
    const up = sparklineGeometry([1, 2, 3, 4, 5], { height: 28 })!
    expect(up.viewW).toBe(63)
    expect(up.viewH).toBe(27)
    expect(up.negative).toBe(false)
    const down = sparklineGeometry([5, 4, 3, 2, 1], { height: 28 })!
    expect(down.negative).toBe(true)
    expect((down.d.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(21)
  })
})

describe('meterBars', () => {
  it('lights bars in proportion, stretched by the scale, with one partial bar', () => {
    const bars = meterBars(24, { scale: 2.2, n: 20 })
    expect(bars).toHaveLength(20)
    expect(bars.filter((b) => b.on && b.opacity == null)).toHaveLength(10)
    const partial = bars.find((b) => b.opacity != null)!
    expect(partial.opacity).toBeCloseTo(0.56, 2)
  })
  it('never exceeds the meter and skips a partial under a quarter', () => {
    expect(meterBars(100).every((b) => b.on)).toBe(true)
    expect(meterBars(0).some((b) => b.on)).toBe(false)
    expect(meterBars(5.1, { scale: 1, n: 20 }).filter((b) => b.on)).toHaveLength(1)
  })
})

describe('tesseraTiles', () => {
  const parts = [
    { label: 'Property', percent: 44, color: 'a' },
    { label: 'Equities and funds', percent: 34, color: 'b' },
    { label: 'Pension', percent: 9, color: 'c' },
    { label: 'Cash', percent: 7, color: 'd' },
    { label: 'Crypto', percent: 6, color: 'e' },
  ]
  it('lays exactly one hundred tiles in order', () => {
    const tiles = tesseraTiles(parts)
    expect(tiles).toHaveLength(100)
    expect(tiles.slice(0, 44).every((t) => t.color === 'a')).toBe(true)
    expect(tiles[99].color).toBe('e')
  })
  it('rounds with the largest remainder so fractions still sum to the grid', () => {
    const tiles = tesseraTiles([
      { label: 'x', percent: 33.3, color: 'x' },
      { label: 'y', percent: 33.3, color: 'y' },
      { label: 'z', percent: 33.4, color: 'z' },
    ])
    expect(tiles).toHaveLength(100)
    expect(tiles.filter((t) => t.color === 'z')).toHaveLength(34)
  })
})

describe('cashflowGeometry', () => {
  const input = {
    months: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    ins: [9200, 9200, 11650, 9200, 9450, 9200, 9200, 9200, 12900],
    outs: [6840, 7120, 8300, 6590, 7480, 6910, 7000, 7050, 8400],
    position: [88200, 90280, 93630, 96240, 98210, 102100, 104300, 106450, 110950],
    forecastFrom: 6,
  }
  it('draws two bars a month, fades the forecast, and bands it in marble', () => {
    const g = cashflowGeometry(input, { width: 900, height: 240 })!
    expect(g.bars).toHaveLength(18)
    expect(g.slot).toBe(100)
    expect(g.band).toEqual({ x: 600, width: 300 })
    expect(g.bars.filter((b) => b.index >= 6 && b.kind === 'in').every((b) => b.opacity === 0.38)).toBe(true)
    // The tallest bar is the maximum over 1.08, so it never touches the top.
    expect(g.bars.find((b) => b.index === 8 && b.kind === 'in')!.h).toBeCloseTo(240 / 1.08, 5)
    expect(g.bars.every((b) => b.y + b.h <= 240 + 1e-9)).toBe(true)
  })
  it('splits the position line into a solid past and a dashed future that share a point', () => {
    const g = cashflowGeometry(input)!
    expect(g.actual.split(' L')).toHaveLength(6)
    expect(g.forecast.split(' L')).toHaveLength(4)
    expect(g.forecast.startsWith('M' + g.actual.split(' L')[5])).toBe(true)
  })
  it('has no band and no forecast line when every month happened', () => {
    const g = cashflowGeometry({ ...input, forecastFrom: 9 })!
    expect(g.band).toBeNull()
    expect(g.forecast).toBe('')
  })
})

describe('creepGeometry', () => {
  it('stacks two tiles wide, deepening in opacity, the latest in gold', () => {
    const stacks = creepGeometry([151, 151, 156, 156, 163, 163, 172, 172, 172, 185, 185, 187], { width: 330, height: 120 })
    expect(stacks).toHaveLength(12)
    expect(stacks[11].gold).toBe(true)
    expect(stacks[11].opacity).toBe(1)
    expect(stacks[0].opacity).toBe(0.35)
    expect(stacks[5].opacity).toBeGreaterThan(stacks[0].opacity)
    const tiles = (d: string) => (d.match(/M/g) ?? []).length
    expect(tiles(stacks[11].d)).toBeGreaterThan(tiles(stacks[0].d))
    expect(tiles(stacks[0].d) % 2).toBe(0)
  })
})

describe('helpers', () => {
  it('sq writes a closed square', () => {
    expect(sq(1, 2, 3)).toBe('M1 2h3v3h-3z')
  })
  it('pctChange reads the change from first to last', () => {
    expect(pctChange([100, 106.4])).toBeCloseTo(6.4)
    expect(pctChange([0, 5])).toBeNull()
  })
})
