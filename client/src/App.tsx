import '@rainbow-me/rainbowkit/styles.css'
import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn, useUser } from '@clerk/clerk-react'
import { wagmiConfig } from '@/lib/wagmi'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { Dashboard } from '@/pages/Dashboard'
import { Crypto } from '@/pages/Crypto'
import { TradFi } from '@/pages/TradFi'
import { Predictions } from '@/pages/Predictions'
import { Analytics } from '@/pages/Analytics'
import { AIAdvisor } from '@/pages/AIAdvisor'
import { MarketData } from '@/pages/MarketData'
import { Budget } from '@/pages/Budget'
import { Accounts } from '@/pages/Accounts'
import { Settings } from '@/pages/Settings'
import { Swap } from '@/pages/Swap'
import { Pricing } from '@/pages/Pricing'

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? ''

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

const rkTheme = darkTheme({
  accentColor: '#C9A84C',
  accentColorForeground: '#07090E',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
})

function AuthWall({ children }: { children: React.ReactNode }) {
  if (!CLERK_KEY) return <>{children}</>
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut><RedirectToSignIn /></SignedOut>
    </>
  )
}

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar sidebarOpen={sidebarOpen} onMenuToggle={() => setSidebarOpen(o => !o)} />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/crypto"     element={<Crypto />} />
            <Route path="/tradfi"     element={<TradFi />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/analytics"  element={<Analytics />} />
            <Route path="/ai"         element={<AIAdvisor />} />
            <Route path="/market"     element={<MarketData />} />
            <Route path="/budget"     element={<Budget />} />
            <Route path="/swap"       element={<Swap />} />
            <Route path="/accounts"   element={<Accounts />} />
            <Route path="/settings"   element={<Settings />} />
            <Route path="/pricing"    element={<Pricing />} />
            <Route path="*"           element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function App() {
  const inner = (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rkTheme}>
          <BrowserRouter>
            <AuthWall>
              <AppShell />
            </AuthWall>
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )

  if (!CLERK_KEY) return inner

  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      {inner}
    </ClerkProvider>
  )
}

export default App
