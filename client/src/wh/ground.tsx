import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * A ground is what a surface declares: light or dark. The root follows the
 * system unless the person picks one in Settings; any surface that needs
 * the other ground says so in markup with data-ground. Every token inside
 * follows.
 */
export type Ground = 'light' | 'dark'
export type Appearance = 'system' | Ground

const QUERY = '(prefers-color-scheme: dark)'
const KEY = 'wh.appearance'

function systemGround(): Ground {
  return typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches ? 'dark' : 'light'
}

function readAppearance(): Appearance {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* private mode */
  }
  return 'system'
}

interface GroundValue {
  ground: Ground
  appearance: Appearance
  setAppearance: (a: Appearance) => void
}

const Ctx = createContext<GroundValue>({ ground: 'light', appearance: 'system', setAppearance: () => {} })

/** Sets data-ground on the root and keeps it in step with the system and the preference. */
export function GroundProvider({ children }: { children: ReactNode }) {
  const [system, setSystem] = useState<Ground>(systemGround)
  const [appearance, setAppearanceState] = useState<Appearance>(readAppearance)

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const sync = () => setSystem(mq.matches ? 'dark' : 'light')
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const ground: Ground = appearance === 'system' ? system : appearance

  useEffect(() => {
    document.documentElement.dataset.ground = ground
  }, [ground])

  const setAppearance = useCallback((a: Appearance) => {
    setAppearanceState(a)
    try {
      if (a === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, a)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(() => ({ ground, appearance, setAppearance }), [ground, appearance, setAppearance])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** The ground of the root. */
export function useGround(): Ground {
  return useContext(Ctx).ground
}

export function useAppearance(): { appearance: Appearance; setAppearance: (a: Appearance) => void } {
  const { appearance, setAppearance } = useContext(Ctx)
  return { appearance, setAppearance }
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
  glow: boolean
  gain: string
  loss: string
  warn: string
}

export const CHART_INK: Record<Ground, ChartInk> = {
  light: {
    ink: '#1D1D1F',
    inkSoft: 'rgba(29,29,31,.62)',
    inkFaint: 'rgba(29,29,31,.38)',
    grid: 'rgba(0,0,0,.08)',
    gridStrong: 'rgba(0,0,0,.24)',
    band: 'rgba(0,0,0,.04)',
    cursor: 'rgba(0,0,0,.4)',
    bg: '#FFFFFF',
    glow: false,
    gain: '#1B7F43',
    loss: '#D70015',
    warn: '#B25000',
  },
  dark: {
    ink: '#F5F5F7',
    inkSoft: 'rgba(245,245,247,.62)',
    inkFaint: 'rgba(245,245,247,.38)',
    grid: 'rgba(255,255,255,.09)',
    gridStrong: 'rgba(255,255,255,.24)',
    band: 'rgba(255,255,255,.05)',
    cursor: 'rgba(255,255,255,.4)',
    bg: '#16171C',
    glow: false,
    gain: '#30D158',
    loss: '#FF453A',
    warn: '#FFB340',
  },
}

export function useChartInk(): ChartInk {
  return CHART_INK[useGround()]
}
