import { createContext, createElement, useCallback, useContext, useState, type ReactNode } from 'react'

interface PrivacyContextValue {
  hidden: boolean
  toggle: () => void
}

const PrivacyContext = createContext<PrivacyContextValue>({
  hidden: false,
  toggle: () => {},
})

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false)
  const toggle = useCallback(() => setHidden((h) => !h), [])
  return createElement(PrivacyContext.Provider, { value: { hidden, toggle } }, children)
}

export function usePrivacy() {
  return useContext(PrivacyContext)
}
