import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * A ground is what a surface declares: light or dark. Nothing chooses it by
 * hand. The root follows the system, and any surface that needs the other
 * ground says so in markup with data-ground="dark" (or "light"). Every token,
 * chart and logo inside follows.
 */
export type Ground = 'light' | 'dark'

const QUERY = '(prefers-color-scheme: dark)'

function systemGround(): Ground {
  return typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches ? 'dark' : 'light'
}

const Ctx = createContext<Ground>('light')

/** Sets data-ground on the root from the system preference and keeps it in step when the system changes. */
export function GroundProvider({ children }: { children: ReactNode }) {
  const [ground, setGround] = useState<Ground>(systemGround)

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const sync = () => setGround(mq.matches ? 'dark' : 'light')
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.ground = ground
  }, [ground])

  return <Ctx.Provider value={ground}>{children}</Ctx.Provider>
}

/** The ground of the root. Surfaces that declare their own ground do so in markup, not through this hook. */
export function useGround(): Ground {
  return useContext(Ctx)
}

/** Colours the SVG charts need as literal values (where a CSS variable cannot be read). */
export interface ChartInk {
  ink: string
  inkSoft: string
  inkFaint: string
  grid: string
  gridStrong: string
  band: string
  cursor: string
  bg: string
  /** Neon halo behind lines. Off on both grounds; hover glow belongs to the chart kit. */
  glow: boolean
  gain: string
  loss: string
  warn: string
}

export const CHART_INK: Record<Ground, ChartInk> = {
  light: {
    ink: '#0C1230',
    inkSoft: 'rgba(12,18,48,.62)',
    inkFaint: 'rgba(12,18,48,.38)',
    grid: '#E9E0CB',
    gridStrong: 'rgba(12,18,48,.24)',
    band: 'rgba(12,18,48,.05)',
    cursor: 'rgba(12,18,48,.45)',
    bg: '#FBF6EA',
    glow: false,
    gain: '#157A52',
    loss: '#B5301B',
    warn: '#8A5F0A',
  },
  dark: {
    ink: '#EEF1FF',
    inkSoft: 'rgba(238,241,255,.62)',
    inkFaint: 'rgba(238,241,255,.38)',
    grid: '#232B55',
    gridStrong: 'rgba(238,241,255,.22)',
    band: 'rgba(238,241,255,.06)',
    cursor: 'rgba(238,241,255,.4)',
    bg: '#080C22',
    glow: false,
    gain: '#4ADE9A',
    loss: '#FF8A6B',
    warn: '#F0CB6A',
  },
}

export function useChartInk(): ChartInk {
  return CHART_INK[useGround()]
}
