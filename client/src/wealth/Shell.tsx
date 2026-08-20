import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { useQuickLook } from '@/wealth/QuickLook'
import { useMergedHoldings } from '@/wealth/useMergedHoldings'
import { accountClass, accountValue, isLiability } from '@/wealth/classifyAccount'
import { CLASSES } from '@/wealth/tokens'
import { useMoney } from '@/wealth/format'
import { LogoAvatar } from '@/wealth/logos'
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

const PAGE_TARGETS: TabItem[] = [...TABS, BROKERAGE_TAB]

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

interface Suggestion {
  key: string
  group: string
  label: string
  sub?: string
  right?: string
  icon: ReactNode
  run: () => void
}

/**
 * Top-bar search: a combobox over pages, asset classes, accounts and
 * positions. Focus (or ⌘K) opens the suggestion list; anything that is
 * an asset opens as a quick-view panel rather than a navigation.
 */
function TopSearch() {
  const navigate = useNavigate()
  const { look } = useQuickLook()
  const { chf } = useMoney()
  const { data: accounts } = useAccounts()
  const holdings = useMergedHoldings()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const items = useMemo<Suggestion[]>(() => {
    const q = query.trim().toLowerCase()
    const hit = (...parts: Array<string | undefined>) =>
      !q || parts.some((p) => p?.toLowerCase().includes(q))
    const out: Suggestion[] = []

    const done = () => {
      setQuery('')
      setOpen(false)
      inputRef.current?.blur()
    }

    for (const t of PAGE_TARGETS) {
      if (!hit(t.label, t.keys)) continue
      const { Icon } = t
      out.push({
        key: `page-${t.to}`,
        group: 'Pages',
        label: t.label,
        sub: 'Page',
        icon: <Icon size={17} strokeWidth={2} />,
        run: () => {
          navigate(t.to)
          done()
        },
      })
    }
    out.splice(q ? 3 : 6)

    const assets = (accounts ?? []).filter((a) => !isLiability(a))
    const gross = assets.reduce((s, a) => s + accountValue(a), 0)
    const totals: Record<string, number> = {}
    for (const a of assets) {
      const id = accountClass(a)
      totals[id] = (totals[id] || 0) + accountValue(a)
    }
    let classCount = 0
    for (const c of CLASSES) {
      const v = totals[c.id] || 0
      if (!v || !hit(c.name) || classCount >= (q ? 3 : 4)) continue
      classCount++
      out.push({
        key: `class-${c.id}`,
        group: 'Asset classes',
        label: c.name,
        sub: gross ? `${((v / gross) * 100).toFixed(0)}% of assets` : undefined,
        right: chf(v),
        icon: <span className="a-tiledot" style={{ background: c.color }} />,
        run: () => {
          look({ kind: 'class', id: c.id })
          done()
        },
      })
    }

    if (q) {
      let accCount = 0
      for (const a of accounts ?? []) {
        if (!hit(a.label, a.institution, a.notes) || accCount >= 4) continue
        accCount++
        out.push({
          key: `acc-${a.id}`,
          group: 'Accounts',
          label: a.label,
          sub: a.institution || a.type,
          right: chf(accountValue(a)),
          icon: <LogoAvatar institution={a.institution} name={a.label} color="#8E8E93" />,
          run: () => {
            look({ kind: 'account', id: a.id })
            done()
          },
        })
      }
    }

    const bySymbol = new Map<string, { value: number; name?: string; count: number }>()
    for (const h of holdings) {
      const cur = bySymbol.get(h.symbol) ?? { value: 0, name: h.name, count: 0 }
      cur.value += h.marketValue || 0
      cur.count++
      cur.name = cur.name || h.name
      bySymbol.set(h.symbol, cur)
    }
    const symbols = [...bySymbol.entries()]
      .filter(([sym, v]) => hit(sym, v.name))
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, q ? 6 : 4)
    for (const [sym, v] of symbols) {
      out.push({
        key: `pos-${sym}`,
        group: 'Positions',
        label: v.name || sym,
        sub: v.count > 1 ? `${sym} · ${v.count} accounts` : sym,
        right: chf(v.value),
        icon: <LogoAvatar symbol={sym} name={v.name} color="#FFD84D" />,
        run: () => {
          look({ kind: 'holding', symbol: sym })
          done()
        },
      })
    }

    return out
  }, [query, accounts, holdings, chf, look, navigate])

  useEffect(() => setHi(0), [query])

  const groups: string[] = []
  for (const it of items) if (!groups.includes(it.group)) groups.push(it.group)

  return (
    <div className="a-searchwrap">
      <form
        className="a-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          items[hi]?.run()
        }}
      >
        <Search size={15} strokeWidth={2.2} aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQuery('')
              setOpen(false)
              inputRef.current?.blur()
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setHi((i) => Math.min(i + 1, items.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHi((i) => Math.max(i - 1, 0))
            }
          }}
          placeholder="Search assets, accounts, pages…"
          aria-label="Search"
          aria-expanded={open}
          autoComplete="off"
        />
        <kbd className="a-kbd">⌘K</kbd>
      </form>

      {open && items.length > 0 && (
        <div className="a-sugs" role="listbox">
          {groups.map((g) => (
            <div key={g} className="a-suggroup">
              <p className="a-suglabel">{g}</p>
              {items
                .filter((it) => it.group === g)
                .map((it) => {
                  const idx = items.indexOf(it)
                  return (
                    <button
                      key={it.key}
                      type="button"
                      role="option"
                      aria-selected={idx === hi}
                      className={`a-sug ${idx === hi ? 'on' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        it.run()
                      }}
                      onMouseEnter={() => setHi(idx)}
                    >
                      <span className="a-sugicon">{it.icon}</span>
                      <span className="a-atext">
                        <b>{it.label}</b>
                        {it.sub && <em>{it.sub}</em>}
                      </span>
                      {it.right && (
                        <span className="a-anum">
                          <b>{it.right}</b>
                        </span>
                      )}
                    </button>
                  )
                })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AppShell() {
  const location = useLocation()
  const { hidden, toggle } = usePrivacy()
  const { enabled: sampleOn, toggle: toggleSample } = useDemo()
  const [syncOpen, setSyncOpen] = useState(false)
  const [railMin, setRailMin] = useState(
    () => localStorage.getItem('meridian.railMin') === '1',
  )
  const { data: walletStatus, isLoading: statusLoading } = useWalletStatus()
  const { data: accounts } = useAccounts()
  const { data: subData } = useSubscriptions()

  const toggleRail = () =>
    setRailMin((v) => {
      localStorage.setItem('meridian.railMin', v ? '0' : '1')
      return !v
    })

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
    : location.pathname.startsWith('/holdings/')
      ? 'The market, and your position in it'
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
          <TopSearch />
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
