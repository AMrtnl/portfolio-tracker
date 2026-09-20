import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { ACCOUNTS_KEY, fetchAccounts } from '@/hooks/accountsQuery'
import { isDemoId } from '@/wealth/demo'

const KEY = 'meridian.sampleBook'

type Preference = 'on' | 'off' | null

function readPreference(): Preference {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === 'off') return 'off'
    if (raw === 'on') return 'on'
  } catch {
    /* private mode */
  }
  return null
}

interface DemoContextValue {
  /** Whether the sample household is shown right now. */
  enabled: boolean
  /** True when the person chose, false when the app decided from the ledger. */
  chosen: boolean
  toggle: () => void
}

const DemoContext = createContext<DemoContextValue>({
  enabled: false,
  chosen: false,
  toggle: () => {},
})

/**
 * The sample household shows itself only while the ledger is empty, so a
 * person who has connected their own accounts sees their own figures and
 * nothing invented. A choice from the account menu overrides that either way
 * and is remembered.
 */
export function DemoProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<Preference>(readPreference)
  const { data: accounts } = useQuery({ queryKey: ACCOUNTS_KEY, queryFn: fetchAccounts })
  const hasLive = (accounts ?? []).some((a) => !isDemoId(a.id))
  // While the ledger is still loading nothing is shown, so the sample never flashes over real figures.
  const auto = accounts !== undefined && !hasLive
  const enabled = preference === 'on' ? true : preference === 'off' ? false : auto

  const toggle = useCallback(() => {
    const next: Preference = enabled ? 'off' : 'on'
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* ignore */
    }
    setPreference(next)
  }, [enabled])

  const value = useMemo(() => ({ enabled, chosen: preference !== null, toggle }), [enabled, preference, toggle])
  return createElement(DemoContext.Provider, { value }, children)
}

export function useDemo() {
  return useContext(DemoContext)
}
