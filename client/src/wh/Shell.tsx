import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import axios from 'axios'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Lockup } from '@/wh/Mark'
import { ICONS } from '@/wh/icons'
import { RoundButton, StatusPill } from '@/wh/controls'
import { NavPill, TabBar, type NavItem } from '@/wh/nav'
import { Menu, type MenuItem } from '@/wh/Menu'
import { useBook } from '@/wh/model/book'
import { useGrow } from '@/wh/model/grow'
import { useDesktop } from '@/wh/useMediaQuery'
import { usePrivacy } from '@/wealth/PrivacyContext'
import { useDemo } from '@/wealth/DemoContext'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { SyncSheet } from '@/wealth/SyncSheet'
import { AttentionSheet, useAttention } from '@/wealth/AttentionSheet'
import { Warmup } from '@/wealth/Warmup'
import { Overview } from '@/wh/screens/Overview'
import { Holdings } from '@/wh/screens/Holdings'
import { Exposure } from '@/wh/screens/Exposure'
import { Cashflow } from '@/wh/screens/Cashflow'
import { Subscriptions } from '@/wh/screens/Subscriptions'
import { Grow } from '@/wh/screens/Grow'
import { Connect } from '@/wh/screens/Connect'
import { Analysis } from '@/pages/Analysis'
import { Brokerage } from '@/pages/Brokerage'
import { Goals } from '@/pages/Goals'
import { HoldingDetail } from '@/pages/HoldingDetail'
import MarkPage from '@/wh/pages/MarkPage'
import ComponentsPage from '@/wh/pages/ComponentsPage'
import ChartsPage from '@/wh/pages/ChartsPage'
import EffectsPage from '@/wh/pages/EffectsPage'
import '@/wh/shell.css'

interface Section {
  key: string
  label: string
  icon: NavItem['icon']
  to: string
  end?: boolean
  /** In the phone tab bar. */
  tab?: boolean
  /** In the web pill; the rest wait under More. */
  pill?: boolean
}

const SECTIONS: Section[] = [
  { key: 'overview', label: 'Overview', icon: ICONS.nav.overview, to: '/', end: true, tab: true, pill: true },
  { key: 'holdings', label: 'Holdings', icon: ICONS.nav.holdings, to: '/holdings', tab: true, pill: true },
  { key: 'exposure', label: 'Exposure', icon: ICONS.nav.exposure, to: '/exposure', tab: true, pill: true },
  { key: 'cashflow', label: 'Cash flow', icon: ICONS.nav.cashflow, to: '/cashflow', tab: true, pill: true },
  { key: 'subscriptions', label: 'Subscriptions', icon: ICONS.nav.subscriptions, to: '/subscriptions', pill: true },
  { key: 'grow', label: 'Grow', icon: ICONS.nav.grow, to: '/grow', tab: true, pill: true },
  { key: 'performance', label: 'Performance', icon: ICONS.nav.performance, to: '/performance' },
  { key: 'activity', label: 'Activity', icon: ICONS.nav.activity, to: '/activity' },
  { key: 'connections', label: 'Connections', icon: ICONS.nav.connections, to: '/connect', pill: true },
  { key: 'planning', label: 'Planning', icon: ICONS.nav.planning, to: '/planning' },
]

function isActive(s: Section, pathname: string): boolean {
  if (s.end) return pathname === s.to
  if (s.to === '/holdings') return pathname === '/holdings' || pathname.startsWith('/holdings/')
  return pathname === s.to || pathname.startsWith(`${s.to}/`)
}

function Legacy({ children }: { children: ReactNode }) {
  return <div className="a-page wh-legacy">{children}</div>
}

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const desktop = useDesktop()
  const book = useBook()
  const grow = useGrow()
  const attention = useAttention()
  const { hidden, toggle: togglePrivacy } = usePrivacy()
  const { enabled: sampleOn, chosen: sampleChosen, toggle: toggleSample } = useDemo()
  const { data: settings } = useSettings()
  const setSettings = useUpdateSettings().mutate
  const [syncOpen, setSyncOpen] = useState(false)
  const [inboxOpen, setInboxOpen] = useState(false)

  useEffect(() => {
    // A new screen starts at the top and hands focus to the main region for readers.
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  const go = (to: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    navigate(to)
  }

  const items: NavItem[] = useMemo(
    () =>
      SECTIONS.map((s) => ({
        key: s.key,
        label: s.label,
        icon: s.icon,
        href: s.to,
        active: isActive(s, location.pathname),
        onSelect: go(s.to),
        count: s.key === 'grow' && grow.opportunities.length ? grow.opportunities.length : undefined,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.pathname, grow.opportunities.length],
  )
  const pill = items.filter((_, i) => SECTIONS[i].pill)
  const more = items.filter((_, i) => !SECTIONS[i].pill)
  const tabs = items.filter((_, i) => SECTIONS[i].tab)

  const brandPage = location.pathname.startsWith('/brand/')
  const broken = book.broken[0]
  const status = broken ? (
    <StatusPill tone="bad" icon={ICONS.status.needsSignIn} onClick={() => setSyncOpen(true)} title="Open connections">
      {broken.name} needs attention
    </StatusPill>
  ) : book.stale.length ? (
    <StatusPill tone="warn" icon={ICONS.status.stale} onClick={() => setSyncOpen(true)} title="Open connections">
      {book.stale.length} out of date
    </StatusPill>
  ) : (
    <StatusPill tone="ok" icon={ICONS.status.synced} onClick={() => setSyncOpen(true)} title="Open connections">
      {book.synced ? `${book.synced} synced` : 'Nothing connected'}
    </StatusPill>
  )

  const currencies = settings?.currencies ?? ['CHF', 'EUR', 'USD', 'GBP']
  const display = settings?.displayCurrency ?? 'CHF'
  const personItems: Array<MenuItem | 'rule'> = [
    { key: 'privacy', label: hidden ? 'Show balances' : 'Hide balances', icon: hidden ? ICONS.ui.show : ICONS.ui.hide, onSelect: togglePrivacy },
    { key: 'sample', label: 'Sample household', sub: sampleOn ? (sampleChosen ? 'On, beside anything you connect' : 'On until you connect something') : 'Off', icon: ICONS.action.education, on: sampleOn, onSelect: toggleSample },
    { key: 'attention', label: 'Needs attention', sub: attention.length ? `${attention.length} ${attention.length === 1 ? 'thing' : 'things'}` : 'Nothing right now', icon: ICONS.ui.notifications, onSelect: () => setInboxOpen(true) },
    'rule',
    ...currencies.map((c) => ({ key: `cur-${c}`, label: `Display in ${c}`, icon: ICONS.account.exchange, on: c === display, onSelect: () => setSettings({ displayCurrency: c }) })),
    'rule',
    {
      key: 'logout',
      label: 'Sign out',
      icon: ICONS.ui.logout,
      onSelect: async () => {
        try {
          await axios.post('/api/auth/logout')
        } finally {
          window.location.assign('/login')
        }
      },
    },
  ]

  return (
    <div className="wh-root">
      <Warmup />
      <a href="#main-content" className="wh-skip">
        Skip to content
      </a>
      {desktop && (
        <header className="wh-topbar">
          <div className="wh-topbar-left">
            <a href="/" onClick={go('/')} className="wh-lockup-link" aria-label="Wealth Hub, overview">
              <Lockup size={22} />
            </a>
          </div>
          <div className="wh-topbar-nav">
            <NavPill items={pill} />
            <Menu
              label="More sections"
              align="left"
              items={more.map((m) => ({ key: m.key, label: m.label, icon: m.icon, on: m.active, onSelect: () => navigate(m.href) }))}
              trigger={(props) => <RoundButton icon={ICONS.ui.more} label="More sections" flat {...props} />}
            />
          </div>
          <div className="wh-topbar-right">
            {status}
            <Menu label="Account" items={personItems} trigger={(props) => <RoundButton icon={ICONS.ui.person} label="Account and preferences" tint filled {...props} />} />
          </div>
        </header>
      )}

      <main id="main-content" tabIndex={-1} className={`wh-main${brandPage ? ' wh-legacy' : ''}`}>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/holdings" element={<Holdings />} />
          <Route path="/exposure" element={<Exposure />} />
          <Route path="/cashflow" element={<Cashflow />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/grow" element={<Grow />} />
          <Route path="/grow/:id" element={<Grow />} />
          <Route path="/connect" element={<Connect />} />
          <Route
            path="/performance"
            element={
              <Legacy>
                <Analysis />
              </Legacy>
            }
          />
          <Route
            path="/activity"
            element={
              <Legacy>
                <Brokerage />
              </Legacy>
            }
          />
          <Route
            path="/planning"
            element={
              <Legacy>
                <Goals />
              </Legacy>
            }
          />
          <Route
            path="/holdings/:symbol"
            element={
              <Legacy>
                <HoldingDetail />
              </Legacy>
            }
          />
          <Route path="/brand/mark" element={<MarkPage />} />
          <Route path="/brand/components" element={<ComponentsPage />} />
          <Route path="/brand/charts" element={<ChartsPage />} />
          <Route path="/brand/effects" element={<EffectsPage />} />
          <Route path="/accounts" element={<Navigate to="/connect" replace />} />
          <Route path="/analysis" element={<Navigate to="/performance" replace />} />
          <Route path="/brokerage" element={<Navigate to="/activity" replace />} />
          <Route path="/goals" element={<Navigate to="/planning" replace />} />
          <Route path="/wallets" element={<Navigate to="/connect" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <SyncSheet open={syncOpen} onClose={() => setSyncOpen(false)} />
      <AttentionSheet open={inboxOpen} onClose={() => setInboxOpen(false)} items={attention} />

      {!desktop && !brandPage && <TabBar items={tabs} />}
    </div>
  )
}
