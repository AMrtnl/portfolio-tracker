import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Dashboard } from '@/pages/Dashboard'
import { Wallet } from 'lucide-react'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="flex h-16 items-center px-8">
            <div className="flex items-center gap-2">
              <Wallet className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Portfolio Tracker</h1>
            </div>
            <nav className="ml-auto flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Hyperliquid • DeFi • NFTs
              </span>
            </nav>
          </div>
        </header>
        <main>
          <Dashboard />
        </main>
      </div>
    </QueryClientProvider>
  )
}

export default App
