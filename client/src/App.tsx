import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query'
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PrivacyProvider } from '@/wealth/PrivacyContext'
import { QuickLookProvider } from '@/wealth/QuickLook'
import { DemoProvider } from '@/wealth/DemoContext'
import { GroundProvider } from '@/wh/ground'
import { AuthProvider, useAuth } from '@/auth/AuthContext'
import { AppShell } from '@/wh/Shell'
import { SiteLayout } from '@/site/SiteLayout'
import { Landing } from '@/site/Landing'
import { Pricing } from '@/site/Pricing'
import { Security } from '@/site/Security'
import { Legal } from '@/site/Legal'
import { NotFound } from '@/site/NotFound'
import { SignIn, SignUp } from '@/site/Auth'
import { R } from '@/routes'

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

/** The product needs a person. Nobody signed in goes to sign-in with a way back. */
function Protected() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <div className="wh-splash">Opening your ledger</div>
  if (status === 'out') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`${R.login}?next=${next}`} replace />
  }
  return (
    <DemoProvider>
      <QuickLookProvider>
        <AppShell />
      </QuickLookProvider>
    </DemoProvider>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GroundProvider>
        <PrivacyProvider>
          <AuthProvider>
            <Router>
              <Routes>
                <Route path="/app/*" element={<Protected />} />
                <Route path={R.login} element={<SignIn />} />
                <Route path={R.signup} element={<SignUp />} />
                <Route element={<SiteLayout />}>
                  <Route path={R.home} element={<Landing />} />
                  <Route path={R.pricing} element={<Pricing />} />
                  <Route path={R.security} element={<Security />} />
                  <Route path={R.privacy} element={<Legal kind="privacy" />} />
                  <Route path={R.terms} element={<Legal kind="terms" />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Router>
          </AuthProvider>
        </PrivacyProvider>
      </GroundProvider>
    </QueryClientProvider>
  )
}

export default App
