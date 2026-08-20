import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const KEY = 'meridian.sampleBook'

function readEnabled(): boolean {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === 'off') return false
    if (raw === 'on') return true
  } catch {
    /* private mode */
  }
  return true
}

interface DemoContextValue {
  enabled: boolean
  toggle: () => void
}

const DemoContext = createContext<DemoContextValue>({
  enabled: true,
  toggle: () => {},
})

export function DemoProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(readEnabled)
  const toggle = useCallback(() => {
    setEnabled((on) => {
      const next = !on
      try {
        localStorage.setItem(KEY, next ? 'on' : 'off')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])
  const value = useMemo(() => ({ enabled, toggle }), [enabled, toggle])
  return createElement(DemoContext.Provider, { value }, children)
}

export function useDemo() {
  return useContext(DemoContext)
}
