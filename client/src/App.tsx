import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  Link,
} from 'react-router-dom'
import { Dashboard } from '@/pages/Dashboard'
import { Accounts } from '@/pages/Accounts'
import { Brokerage } from '@/pages/Brokerage'
import { Analysis } from '@/pages/Analysis'
import { HoldingDetail } from '@/pages/HoldingDetail'
import { useWalletStatus } from '@/hooks/useWalletStatus'
import { useAccounts, useProviders } from '@/hooks/useAccounts'
import { cn } from '@/lib/utils'
import { Building2, LineChart, PieChart, Wallet } from 'lucide-react'
import { SkeletonBlock, SkeletonRows } from '@/components/ui/states'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

/** The mark: a globe crossed by its meridian. */
function MeridianMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3.4 9h17.2M3.4 15h17.2" strokeWidth="1.1" opacity="0.55" />
    </svg>
  )
}

function BrandMark() {
  return (
    <Link
      to="/"
      className="group flex items-center gap-2.5 rounded-md"
      aria-label="Meridian — portfolio home"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition-transform duration-300 group-hover:rotate-[18deg]">
        <MeridianMark className="h-[19px] w-[19px]" />
      </span>
      <span className="font-display text-[1.0625rem] leading-none tracking-tight">
        Meridian
      </span>
    </Link>
  )
}

interface NavItem {
  to: string
  label: string
  icon: typeof LineChart
  end?: boolean
}

/** Desktop: underline tabs. Reads as app chrome, not a row of buttons. */
function DesktopNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="hidden sm:block" aria-label="Primary">
      <ul className="flex items-stretch gap-1">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'relative flex h-14 items-center px-3 text-sm font-medium transition-colors',
                  'after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:rounded-t-full after:transition-all after:duration-200 after:content-[""]',
                  isActive
                    ? 'text-foreground after:bg-primary'
                    : 'text-muted-foreground after:bg-transparent hover:text-foreground hover:after:bg-border',
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Mobile: a real bottom tab bar, the convention in every app we studied. */
function MobileNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Primary"
      className="surface-chrome fixed inset-x-0 bottom-0 z-40 border-t border-border/70 pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="flex items-stretch">
        {items.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      'h-[18px] w-[18px] transition-transform duration-200',
                      isActive && 'scale-110',
                    )}
                    aria-hidden
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Boot skeleton in the shape of the portfolio route, so nothing jumps. */
function BootSkeleton() {
  return (
    <div className="measure px-5 pb-16 pt-10 sm:px-8 sm:pt-14" aria-hidden>
      <SkeletonBlock className="h-3 w-28" />
      <SkeletonBlock className="mt-4 h-14 w-72 max-w-full sm:h-20 sm:w-96" />
      <SkeletonBlock className="mt-5 h-4 w-52" />
      <SkeletonBlock className="mt-9 h-2.5 w-full rounded-full" />
      <div className="mt-12">
        <SkeletonRows rows={6} />
      </div>
    </div>
  )
}

function AppShell() {
  const { data: walletStatus, isLoading: statusLoading } = useWalletStatus()
  const { data: accounts } = useAccounts()
  const { data: providers } = useProviders()

  const accountCount = walletStatus?.accountCount ?? accounts?.length ?? 0
  const hasAccounts = Boolean(walletStatus?.initialized && accountCount > 0)
  const snapConfigured = Boolean(
    providers?.find((p) => p.id === 'snaptrade')?.configured,
  )

  const navItems: NavItem[] = [
    ...(hasAccounts
      ? [
          { to: '/', label: 'Portfolio', icon: LineChart, end: true },
          { to: '/analysis', label: 'Analysis', icon: PieChart },
        ]
      : []),
    { to: '/accounts', label: 'Accounts', icon: Wallet },
    ...(hasAccounts && snapConfigured
      ? [{ to: '/brokerage', label: 'Brokerage', icon: Building2 }]
      : []),
  ]

  const showNav = navItems.length > 1

  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <header className="surface-chrome sticky top-0 z-40 border-b border-border/60">
        <div className="measure flex h-14 items-center gap-4 px-5 sm:px-8">
          <BrandMark />
          {showNav && <DesktopNav items={navItems} />}

          <p className="ml-auto text-xs text-muted-foreground">
            {statusLoading ? (
              <span className="sr-only">Loading account status</span>
            ) : hasAccounts ? (
              <>
                <span className="num tabular-nums text-foreground">
                  {accountCount}
                </span>{' '}
                {accountCount === 1 ? 'account' : 'accounts'}
                <span className="hidden md:inline"> connected</span>
              </>
            ) : (
              'Not connected'
            )}
          </p>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className={cn(showNav && 'pb-[4.5rem] sm:pb-0')}
      >
        {statusLoading ? (
          <>
            <p role="status" aria-live="polite" className="sr-only">
              Loading your portfolio
            </p>
            <BootSkeleton />
          </>
        ) : (
          <Routes>
            <Route
              path="/"
              element={
                hasAccounts ? <Dashboard /> : <Navigate to="/accounts" replace />
              }
            />
            <Route
              path="/analysis"
              element={
                hasAccounts ? <Analysis /> : <Navigate to="/accounts" replace />
              }
            />
            <Route
              path="/holdings/:symbol"
              element={
                hasAccounts ? (
                  <HoldingDetail />
                ) : (
                  <Navigate to="/accounts" replace />
                )
              }
            />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/brokerage" element={<Brokerage />} />
            <Route path="/wallets" element={<Navigate to="/accounts" replace />} />
            <Route
              path="*"
              element={<Navigate to={hasAccounts ? '/' : '/accounts'} replace />}
            />
          </Routes>
        )}
      </main>

      {showNav && <MobileNav items={navItems} />}
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
