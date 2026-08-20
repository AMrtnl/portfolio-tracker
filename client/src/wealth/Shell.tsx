import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import {
  ArrowLeftRight,
  Briefcase,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
  Layers,
  PieChart,
  RotateCw,
  Search,
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
  /* extra lowercase terms the top-bar search matches against */
  keys?: string
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
  { to: '/', label: 'Wealth', Icon: Wallet, end: true, keys: 'home dashboard net worth overview' },
  { to: '/analysis', label: 'Analysis', Icon: PieChart, keys: 'allocation income benchmark concentration' },
  { to: '/cashflow', label: 'Cash flow', Icon: ArrowLeftRight, keys: 'cashflow transactions spending income' },
  { to: '/subscriptions', label: 'Subscriptions', Icon: CalendarDays, keys: 'recurring charges calendar' },
  { to: '/accounts', label: 'Accounts', Icon: Layers, keys: 'banks wallets connections property loans' },
]

const BROKERAGE_TAB: TabItem = {
  to: '/brokerage',
  label: 'Brokerage',
  Icon: Briefcase,
  keys: 'orders activity snaptrade broker trading',
}

interface NavGroup {
  label: string
  tabs: TabItem[]
}

const NAV_GROUPS: NavGroup[] = [
  { label: 'Overview', tabs: [TABS[0], TABS[1]] },
  { label: 'Money', tabs: [TABS[2], TABS[3]] },
  { label: 'Setup', tabs: [TABS[4], BROKERAGE_TAB] },
]

const SEARCH_TARGETS: TabItem[] = [...TABS, BROKERAGE_TAB]

function RailTab({ tab }: { tab: TabItem }) {
  const { to, label, Icon, end } = tab
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      className={({ isActive }) => `a-tab ${isActive ? 'on' : ''}`}
    >
      {({ isActive }) => (
        <>
          <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}

function RailNav() {
  return (
    <nav className="a-railnav" aria-label="Primary">
      {NAV_GROUPS.map(({ label, tabs }) => (
        <div key={label} className="a-navgroup">
          <p className="a-navlabel">{label}</p>
          {tabs.map((tab) => (
            <RailTab key={tab.to} tab={tab} />
          ))}
        </div>
      ))}
    </nav>
  )
}

function TabBar() {
  return (
    <nav className="a-tabbar" aria-label="Primary">
      {TABS.map((tab) => (
        <RailTab key={tab.to} tab={tab} />
      ))}
    </nav>
  )
}

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { hidden, toggle } = usePrivacy()
  const { enabled: sampleOn, toggle: toggleSample } = useDemo()
  const [syncOpen, setSyncOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [railMin, setRailMin] = useState(
    () => localStorage.getItem('meridian.railMin') === '1',
  )
  const searchRef = useRef<HTMLInputElement>(null)
  const { data: walletStatus, isLoading: statusLoading } = useWalletStatus()
  const { data: accounts } = useAccounts()
  const { data: subData } = useSubscriptions()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggleRail = () =>
    setRailMin((v) => {
      localStorage.setItem('meridian.railMin', v ? '0' : '1')
      return !v
    })

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim().toLowerCase()
    if (!q) return
    const hit = SEARCH_TARGETS.find(
      (t) => t.label.toLowerCase().includes(q) || t.keys?.includes(q),
    )
    if (hit) {
      navigate(hit.to)
      setQuery('')
      searchRef.current?.blur()
    }
  }

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
    <div className={`a-root ${railMin ? 'rail-min' : ''}`}>
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
        <RailNav />
        <p className="a-railnote">
          {sampleOn
            ? sampleCount
              ? `Sample household on · ${sampleCount} example accounts`
              : 'Sample cash flow is filling empty months'
            : 'Live book only'}
        </p>
        <button
          type="button"
          className="a-collapse"
          onClick={toggleRail}
          aria-pressed={railMin}
          title={railMin ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {railMin ? (
            <ChevronsRight size={19} strokeWidth={2} />
          ) : (
            <ChevronsLeft size={19} strokeWidth={2} />
          )}
          <span>Collapse</span>
        </button>
      </aside>

      <div className="a-main">
        <header className="a-topbar">
          <span className="a-topbrand" aria-hidden>
            M
          </span>
          <form className="a-search" role="search" onSubmit={onSearch}>
            <Search size={15} strokeWidth={2.2} aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuery('')
                  searchRef.current?.blur()
                }
              }}
              placeholder="Search assets, accounts, pages…"
              aria-label="Search"
            />
            <kbd className="a-kbd">⌘K</kbd>
          </form>
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

        <div className="a-shell">
          <header className="a-pagehead">
            <h1 className="a-large">{title}</h1>
            <p className="a-navsub">{subtitle}</p>
          </header>

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
      </div>

      <SyncSheet open={syncOpen} onClose={() => setSyncOpen(false)} />

      <TabBar />
    </div>
  )
}
