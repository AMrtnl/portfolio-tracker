import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/** Paper is the light, institutional theme; Night keeps the black shell. */
export type Theme = 'paper' | 'night'

const KEY = 'meridian.theme'

interface ThemeCtx {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
}

const Ctx = createContext<ThemeCtx | null>(null)

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === 'night' ? 'night' : 'paper'
  } catch {
    return 'paper'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(read)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'paper' ? '#E7E7E4' : '#000000')
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* private mode */
    }
  }, [theme])

  const value = useMemo<ThemeCtx>(
    () => ({
      theme,
      setTheme,
      toggle: () => setTheme((t) => (t === 'paper' ? 'night' : 'paper')),
    }),
    [theme],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTheme must be used inside ThemeProvider')
  return v
}

/** Colours the SVG charts need as literal values (filters and gradients can't read CSS variables). */
export interface ChartInk {
  ink: string
  inkSoft: string
  inkFaint: string
  grid: string
  gridStrong: string
  band: string
  cursor: string
  bg: string
  /** Neon halo behind lines — only reads well on black. */
  glow: boolean
  gain: string
  loss: string
  warn: string
}

export const CHART_INK: Record<Theme, ChartInk> = {
  night: {
    ink: '#fff',
    inkSoft: 'rgba(235,235,245,.62)',
    inkFaint: 'rgba(235,235,245,.38)',
    grid: 'rgba(255,255,255,.1)',
    gridStrong: 'rgba(255,255,255,.22)',
    band: 'rgba(255,255,255,.07)',
    cursor: 'rgba(255,255,255,.4)',
    bg: '#000',
    glow: true,
    gain: '#30D158',
    loss: '#F0544C',
    warn: '#FF9F45',
  },
  paper: {
    ink: '#141416',
    inkSoft: 'rgba(20,20,22,.62)',
    inkFaint: 'rgba(20,20,22,.38)',
    grid: 'rgba(0,0,0,.12)',
    gridStrong: 'rgba(0,0,0,.24)',
    band: 'rgba(0,0,0,.06)',
    cursor: 'rgba(0,0,0,.45)',
    bg: '#E7E7E4',
    glow: false,
    gain: '#2B7A4B',
    loss: '#C8524E',
    warn: '#B8742B',
  },
}

export function useChartInk(): ChartInk {
  return CHART_INK[useTheme().theme]
}
