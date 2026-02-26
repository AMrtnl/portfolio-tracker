import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
})

function AppShell() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark'
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar
          theme={theme}
          onThemeToggle={toggleTheme}
          onMenuToggle={() => setMobileMenuOpen(o => !o)}
        />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/crypto" element={<Crypto />} />
            <Route path="/tradfi" element={<TradFi />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/ai" element={<AIAdvisor />} />
            <Route path="/market" element={<MarketData />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
