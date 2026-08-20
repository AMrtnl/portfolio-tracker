import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface PrivacyValue {
  hidden: boolean;
  toggle: () => void;
}

const PrivacyContext = createContext<PrivacyValue>({
  hidden: false,
  toggle: () => {},
});

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const value = useMemo(
    () => ({ hidden, toggle: () => setHidden((v) => !v) }),
    [hidden],
  );
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
