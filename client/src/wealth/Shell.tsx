import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { ArrowsLeftRight, Briefcase, CalendarBlank, CaretDoubleLeft, CaretDoubleRight, Eye, EyeSlash, Stack, ChartPieSlice, ArrowsClockwise, MagnifyingGlass, Wallet, GearSix, Target, Plus, UploadSimple, Sparkle, CurrencyCircleDollar, Bell } from '@phosphor-icons/react'
import { Dashboard } from '@/pages/Dashboard'
import { Accounts } from '@/pages/Accounts'
import { Brokerage } from '@/pages/Brokerage'
import { Analysis } from '@/pages/Analysis'
import { HoldingDetail } from '@/pages/HoldingDetail'
import { Cashflow } from '@/pages/Cashflow'
import { Subscriptions } from '@/pages/Subscriptions'
import { Goals } from '@/pages/Goals'
import { useWalletStatus } from '@/hooks/useWalletStatus'
import { useAccounts, type Account } from '@/hooks/useAccounts'
import { PreferencesSheet } from '@/wealth/PreferencesSheet'
import { AttentionSheet, useAttention } from '@/wealth/AttentionSheet'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { Warmup } from '@/wealth/Warmup'
import { useSubscriptions } from '@/hooks/useMoneyLedger'
import { usePrivacy } from '@/wealth/PrivacyContext'
import { useDemo } from '@/wealth/DemoContext'
import { isDemoId } from '@/wealth/demo'
import { SyncSheet } from '@/wealth/SyncSheet'
import { useQuickLook } from '@/wealth/QuickLook'
import { useMergedHoldings } from '@/wealth/useMergedHoldings'
import { accountClass, accountValue, isLiability } from '@/wealth/classifyAccount'
import { CLASSES } from '@/wealth/tokens'
import { Lockup, Mark } from '@/wh/Mark'
import MarkPage from '@/wh/pages/MarkPage'
import ComponentsPage from '@/wh/pages/ComponentsPage'
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
  if (pathname.startsWith('/goals')) return 'Goals'
  return 'Wealth'
}

const TABS: TabItem[] = [
  { to: '/', label: 'Wealth', Icon: Wallet, end: true, keys: 'home dashboard net worth overview' },
  { to: '/analysis', label: 'Analysis', Icon: ChartPieSlice, keys: 'allocation income benchmark concentration' },
  { to: '/cashflow', label: 'Cash flow', Icon: ArrowsLeftRight, keys: 'cashflow transactions spending income' },
  { to: '/subscriptions', label: 'Subscriptions', Icon: CalendarBlank, keys: 'recurring charges calendar' },
  { to: '/goals', label: 'Goals', Icon: Target, keys: 'savings targets projections deposit' },
  { to: '/accounts', label: 'Accounts', Icon: Stack, keys: 'banks wallets connections property loans' },
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
  { label: 'Money', tabs: [TABS[2], TABS[3], TABS[4]] },
  { label: 'Setup', tabs: [TABS[5], BROKERAGE_TAB] },
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
          <Icon size={20} weight={isActive ? 'regular' : 'light'} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}

/** Rail nav with the top accounts listed under the Accounts entry (Mercury). */
function RailNav({ accounts }: { accounts: Account[] }) {
  const { look } = useQuickLook()
  const { chf } = useMoney()
  const top = accounts
    .filter((a) => !isLiability(a))
    .sort((a, b) => accountValue(b) - accountValue(a))
    .slice(0, 5)
  return (
    <nav className="a-railnav" aria-label="Primary">
      {NAV_GROUPS.map(({ label, tabs }) => (
        <div key={label} className="a-navgroup">
          <p className="a-navlabel">{label}</p>
          {tabs.map((tab) => (
            <div key={tab.to}>
              <RailTab tab={tab} />
              {tab.to === '/accounts' && top.length > 0 && (
                <div className="a-railsub" aria-label="Largest accounts">
                  {top.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="a-railacct"
                      onClick={() => look({ kind: 'account', id: a.id })}
                      title={a.label}
                    >
                      <i style={{ background: CLASSES.find((c) => c.id === accountClass(a))?.color }} />
                      <span>{a.label}</span>
                      <b>{chf(accountValue(a))}</b>
                    </button>
                  ))}
                </div>
              )}
            </div>
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
/**
 * A hairline at the very top while anything is still fetching. It waits a
 * beat before showing so cached pages never flash it.
 */
function LoadingBar() {
  const fetching = useIsFetching()
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!fetching) {
      setShow(false)
      return
    }
    const t = setTimeout(() => setShow(true), 250)
    return () => clearTimeout(t)
  }, [fetching])
  return <div className={`a-loadbar ${show ? 'on' : ''}`} aria-hidden />
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

function TopSearch({
  openPrefs,
  openSync,
  openInbox,
}: {
  openPrefs: () => void
  openSync: () => void
  openInbox: () => void
}) {
  const navigate = useNavigate()
  const { look } = useQuickLook()
  const { chf } = useMoney()
  const { hidden, toggle: togglePrivacy } = usePrivacy()
  const { enabled: sampleOn, toggle: toggleSample } = useDemo()
  const { data: settings } = useSettings()
  const setCurrency = useUpdateSettings().mutate
  const { data: accounts } = useAccounts()
  const holdings = useMergedHoldings()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      const slash = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)
      if (cmdK || slash) {
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
        icon: <Icon size={17} />,
        run: () => {
          navigate(t.to)
          done()
        },
      })
    }
    out.splice(q ? 3 : 6)

    // Things you can do from anywhere — the command half of the palette.
    const display = settings?.displayCurrency ?? 'USD'
    const actions: Array<Omit<Suggestion, 'group' | 'right'> & { keys: string }> = [
      {
        key: 'act-tx',
        label: 'Add a transaction',
        sub: 'Log spending or income',
        keys: 'spend income log cash flow',
        icon: <Plus size={17} />,
        run: () => navigate('/cashflow?add=spend'),
      },
      {
        key: 'act-import',
        label: 'Import a bank statement',
        sub: 'Paste a CSV — every line gets categorised',
        keys: 'csv upload statement bank',
        icon: <UploadSimple size={17} />,
        run: () => navigate('/cashflow?add=import'),
      },
      {
        key: 'act-account',
        label: 'Add an account',
        sub: 'Bank, broker, wallet, property, or loan',
        keys: 'connect ledger wallet broker bank',
        icon: <Stack size={17} />,
        run: () => navigate('/accounts?add=1'),
      },
      {
        key: 'act-goal',
        label: 'New goal',
        sub: 'A target, a date, and what funds it',
        keys: 'savings target deposit',
        icon: <Target size={17} />,
        run: () => navigate('/goals?new=1'),
      },
      {
        key: 'act-sync',
        label: 'Sync all connections',
        sub: 'Refresh every live source',
        keys: 'refresh update connections',
        icon: <ArrowsClockwise size={17} />,
        run: openSync,
      },
      {
        key: 'act-inbox',
        label: 'What needs attention',
        sub: 'Failed syncs, detected charges, goals behind',
        keys: 'inbox alerts attention repair',
        icon: <Bell size={17} />,
        run: openInbox,
      },
      {
        key: 'act-privacy',
        label: hidden ? 'Show balances' : 'Hide balances',
        sub: 'Masks every figure on screen',
        keys: 'privacy mask hide show',
        icon: hidden ? <Eye size={17} /> : <EyeSlash size={17} />,
        run: togglePrivacy,
      },
      {
        key: 'act-sample',
        label: sampleOn ? 'Turn off the sample household' : 'Turn on the sample household',
        sub: 'Example accounts and cash flow beside yours',
        keys: 'demo example sample',
        icon: <Sparkle size={17} />,
        run: toggleSample,
      },
      ...(settings?.currencies ?? [])
        .filter((c) => c !== display)
        .map((c) => ({
          key: `act-cur-${c}`,
          label: `Display in ${c}`,
          sub: `Every total converted at today's rate`,
          keys: `currency ${c.toLowerCase()} display convert`,
          icon: <CurrencyCircleDollar size={17} />,
          run: () => setCurrency({ displayCurrency: c }),
        })),
      {
        key: 'act-prefs',
        label: 'Preferences',
        sub: 'Currency, headline figure, privacy',
        keys: 'settings options',
        icon: <GearSix size={17} />,
        run: openPrefs,
      },
    ]
    let actionCount = 0
    for (const a of actions) {
      if (!hit(a.label, a.sub, a.keys) || actionCount >= (q ? 4 : 3)) continue
      actionCount++
      out.push({
        key: a.key,
        group: 'Actions',
        label: a.label,
        sub: a.sub,
        icon: a.icon,
        run: () => {
          a.run()
          done()
        },
      })
    }

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
  }, [
    query,
    accounts,
    holdings,
    chf,
    look,
    navigate,
    hidden,
    togglePrivacy,
    sampleOn,
    toggleSample,
    settings,
    setCurrency,
    openPrefs,
    openSync,
    openInbox,
  ])

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
        <MagnifyingGlass size={15} aria-hidden />
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
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [inboxOpen, setInboxOpen] = useState(false)
  const attention = useAttention()
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

  /* Brand pages (/brand/*) carry their own serif title. */
  const brandPage = location.pathname.startsWith('/brand/')
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
        : location.pathname.startsWith('/goals')
          ? 'Targets, dates, and what it takes each month'
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
      <Warmup />
      <LoadingBar />
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <aside className="a-rail" aria-label="Workspace">
        <div className="a-brand">
          <Lockup size={22} />
        </div>
        <RailNav accounts={accounts ?? []} />
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
            <CaretDoubleRight size={19} />
          ) : (
            <CaretDoubleLeft size={19} />
          )}
          <span>Collapse</span>
        </button>
      </aside>

      <div className="a-main">
        <header className="a-topbar">
          <Mark width={42} className="a-topbrand" />
          <TopSearch
            openPrefs={() => setPrefsOpen(true)}
            openSync={() => setSyncOpen(true)}
            openInbox={() => setInboxOpen(true)}
          />
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
                <EyeSlash size={17} />
              ) : (
                <Eye size={17} />
              )}
            </button>
            <button
              type="button"
              className="a-navbtn"
              onClick={() => setInboxOpen(true)}
              aria-label={
                attention.length
                  ? `${attention.length} ${attention.length === 1 ? 'thing needs' : 'things need'} attention`
                  : 'Needs attention'
              }
            >
              <Bell size={17} />
              {attention.length > 0 && <i className="a-navcount">{attention.length}</i>}
            </button>
            <button
              type="button"
              className="a-navbtn"
              onClick={() => setSyncOpen(true)}
              aria-label="Connections"
            >
              <ArrowsClockwise size={17} />
              {needsAttention && <i className="a-navbadge" />}
            </button>
            <button
              type="button"
              className="a-navbtn"
              onClick={() => setPrefsOpen(true)}
              aria-label="Preferences"
            >
              <GearSix size={17} />
            </button>
          </div>
        </header>

        <div className="a-shell">
          {!brandPage && (
            <header className="a-pagehead">
              <h1 className="a-large">{title}</h1>
              <p className="a-navsub">{subtitle}</p>
            </header>
          )}

          <main id="main-content" tabIndex={-1} className="a-page" key={location.pathname}>
            {(
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
                <Route path="/goals" element={<Goals />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/brokerage" element={<Brokerage />} />
                <Route path="/brand/mark" element={<MarkPage />} />
                <Route path="/brand/components" element={<ComponentsPage />} />
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
      <PreferencesSheet open={prefsOpen} onClose={() => setPrefsOpen(false)} />
      <AttentionSheet open={inboxOpen} onClose={() => setInboxOpen(false)} items={attention} />

      <TabBar />
    </div>
  )
}
