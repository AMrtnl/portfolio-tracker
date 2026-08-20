import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import { PrivacyProvider } from '@/wealth/PrivacyContext'
import { QuickLookProvider } from '@/wealth/QuickLook'
import { DemoProvider } from '@/wealth/DemoContext'
import { AppShell } from '@/wealth/Shell'

/* VITE_PREVIEW builds run as a standalone page with no server and a sandbox
   that blocks history API calls — keep routing in memory there. */
const Router = import.meta.env.VITE_PREVIEW ? MemoryRouter : BrowserRouter

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PrivacyProvider>
        <DemoProvider>
          <Router>
            <QuickLookProvider>
              <AppShell />
            </QuickLookProvider>
          </Router>
        </DemoProvider>
      </PrivacyProvider>
    </QueryClientProvider>
  )
}

export default App
