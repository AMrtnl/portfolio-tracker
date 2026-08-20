import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { PrivacyProvider } from '@/wealth/PrivacyContext'
import { DemoProvider } from '@/wealth/DemoContext'
import { AppShell } from '@/wealth/Shell'

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
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </DemoProvider>
      </PrivacyProvider>
    </QueryClientProvider>
  )
}

export default App
