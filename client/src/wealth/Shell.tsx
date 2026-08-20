import { useState } from 'react'
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import {
  ArrowLeftRight,
  CalendarDays,
  Eye,
  EyeOff,
  Layers,
  PieChart,
  RotateCw,
  Wallet,
} from 'lucide-react'
import { Dashboard } from '@/pages/Dashboard'
import { Accounts } from '@/pages/Accounts'
import { Brokerage } from '@/pages/Brokerage'
import { Analysis } from '@/pages/Analysis'
import { HoldingDetail } from '@/pages/HoldingDetail'
import { Cashflow } from '@/pages/Cashflow'
import { Subscriptions } from '@/pages/Subscriptions'
import { useWalletStatus } from '@/hooks/useWalletStatus'
import { useAccounts } from '@/hooks/useAccounts'
import { useSubscriptions } from '@/hooks/useMoneyLedger'
import { usePrivacy } from '@/wealth/PrivacyContext'
import { useDemo } from '@/wealth/DemoContext'
import { isDemoId } from '@/wealth/demo'
import { SyncSheet } from '@/wealth/SyncSheet'
import { freshness } from '@/lib/utils'

interface TabItem {
  to: string
  label: string
  Icon: typeof Wallet
  end?: boolean
}

function titleFor(pathname: string): string {
  if (pathname.startsWith('/holdings/')) return 'Holding'
  if (pathname.startsWith('/analysis')) return 'Analysis'
  if (pathname.startsWith('/accounts')) return 'Accounts'
  if (pathname.startsWith('/brokerage')) return 'Brokerage'
  if (pathname.startsWith('/cashflow')) return 'Cash flow'
  if (pathname.startsWith('/subscriptions')) return 'Subscriptions'
  return 'Wealth'
}

const TABS: TabItem[] = [
  { to: '/', label: 'Wealth', Icon: Wallet, end: true },
  { to: '/analysis', label: 'Analysis', Icon: PieChart },
  { to: '/cashflow', label: 'Cash flow', Icon: ArrowLeftRight },
  { to: '/subscriptions', label: 'Subscriptions', Icon: CalendarDays },
  { to: '/accounts', label: 'Accounts', Icon: Layers },
]

function NavTabs({ className }: { className: string }) {
  return (
    <nav className={className} aria-label="Primary">
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `a-tab ${isActive ? 'on' : ''}`}
        >
          {({ isActive }) => (
            <>
              <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppShell() {
  const location = useLocation()
  const { hidden, toggle } = usePrivacy()
  const { enabled: sampleOn, toggle: toggleSample } = useDemo()
  const [syncOpen, setSyncOpen] = useState(false)
  const { data: walletStatus, isLoading: statusLoading } = useWalletStatus()
  const { data: accounts } = useAccounts()
  const { data: subData } = useSubscriptions()

  const accountCount = accounts?.length ?? walletStatus?.accountCount ?? 0
  const hasAccounts = accountCount > 0
  const sampleCount = accounts?.filter((a) => isDemoId(a.id)).length ?? 0
  const subCount = subData?.subscriptions.length ?? 0
  const needsAttention = Boolean(
    accounts?.some(
      (a) =>
        !isDemoId(a.id) &&
        (a.status === 'error' || freshness(a.lastSyncedAt) === 'stale'),
    ),
  )

  const title = titleFor(location.pathname)
  const subtitle = statusLoading
    ? 'Loading…'
    : location.pathname.startsWith('/analysis')
      ? 'Allocation, income, and how you got here'
      : location.pathname.startsWith('/accounts')
        ? accountCount
          ? `${accountCount} ${accountCount === 1 ? 'account' : 'accounts'}`
          : 'Cash, brokers, property, and loans'
        : location.pathname.startsWith('/brokerage')
          ? 'Orders, activity, and SnapTrade accounts'
          : location.pathname.startsWith('/cashflow')
            ? 'Income versus what you spend'
            : location.pathname.startsWith('/subscriptions')
              ? subCount
                ? `${subCount} recurring ${subCount === 1 ? 'charge' : 'charges'} tracked`
                : 'Recurring charges on a calendar'
              : needsAttention
                ? `${accountCount} accounts · needs attention`
                : accountCount
                  ? `${accountCount} ${accountCount === 1 ? 'account' : 'accounts'}`
                  : 'Add what you own and what you owe'

  return (
    <div className="a-root">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <aside className="a-rail" aria-label="Workspace">
        <div className="a-brand">
          <span className="a-brandmark">M</span>
          <div>
            <b>Meridian</b>
            <em>Your money, one book</em>
          </div>
        </div>
        <NavTabs className="a-railnav" />
        <p className="a-railnote">
          {sampleOn
            ? sampleCount
              ? `Sample household on · ${sampleCount} example accounts`
              : 'Sample cash flow is filling empty months'
            : 'Live book only'}
        </p>
      </aside>

      <div className="a-shell">
        <header className="a-nav">
          <h1 className="a-large">{title}</h1>
          <div className="a-navbtns">
            <button
              type="button"
              className={`a-sample ${sampleOn ? 'on' : ''}`}
              onClick={toggleSample}
              aria-pressed={sampleOn}
            >
              Sample
            </button>
            <button
              type="button"
              className="a-navbtn"
              onClick={toggle}
              aria-label={hidden ? 'Show balances' : 'Hide balances'}
            >
              {hidden ? (
                <EyeOff size={17} strokeWidth={2} />
              ) : (
                <Eye size={17} strokeWidth={2} />
              )}
            </button>
            <button
              type="button"
              className="a-navbtn"
              onClick={() => setSyncOpen(true)}
              aria-label="Connections"
            >
              <RotateCw size={17} strokeWidth={2} />
              {needsAttention && <i className="a-navbadge" />}
            </button>
          </div>
        </header>
        <p className="a-navsub">{subtitle}</p>

        <main id="main-content" tabIndex={-1} className="a-page" key={location.pathname}>
          {statusLoading ? (
            <>
              <p role="status" aria-live="polite" className="sr-only">
                Loading your accounts
              </p>
              <section className="a-card" aria-hidden>
                <div className="a-hero">
                  <span className="ui-skel" style={{ width: 72, height: 14, borderRadius: 7 }} />
                  <span className="ui-skel" style={{ width: 180, height: 36, borderRadius: 10, marginTop: 12 }} />
                </div>
              </section>
            </>
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route
                path="/analysis"
                element={hasAccounts ? <Analysis /> : <Navigate to="/accounts" replace />}
              />
              <Route
                path="/holdings/:symbol"
                element={
                  hasAccounts ? <HoldingDetail /> : <Navigate to="/accounts" replace />
                }
              />
              <Route path="/cashflow" element={<Cashflow />} />
              <Route path="/subscriptions" element={<Subscriptions />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/brokerage" element={<Brokerage />} />
              <Route path="/wallets" element={<Navigate to="/accounts" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </main>

        <p className="a-footnote">
          {sampleOn
            ? 'Sample figures sit next to anything you connect. Turn Sample off to see the live book alone.'
            : 'Balances refresh when your connections sync.'}
        </p>
      </div>

      <SyncSheet open={syncOpen} onClose={() => setSyncOpen(false)} />

      <NavTabs className="a-tabbar" />
    </div>
  )
}
