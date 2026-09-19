import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import { PrivacyProvider } from '@/wealth/PrivacyContext'
import { QuickLookProvider } from '@/wealth/QuickLook'
import { DemoProvider } from '@/wealth/DemoContext'
import { GroundProvider } from '@/wh/ground'
import { AppShell } from '@/wealth/Shell'

/* VITE_PREVIEW builds run as a standalone page with no server and a sandbox
   that blocks history API calls — keep routing in memory there. */
const Router = import.meta.env.VITE_PREVIEW ? MemoryRouter : BrowserRouter

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Loaded once, kept warm: pages open from cache and refresh quietly.
      staleTime: 5 * 60_000,
      gcTime: 60 * 60_000,
      placeholderData: keepPreviousData,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GroundProvider>
      <PrivacyProvider>
        <DemoProvider>
          <Router>
            <QuickLookProvider>
              <AppShell />
            </QuickLookProvider>
          </Router>
        </DemoProvider>
      </PrivacyProvider>
      </GroundProvider>
    </QueryClientProvider>
  )
}

export default App
