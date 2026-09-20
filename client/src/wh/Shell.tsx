import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Lockup } from '@/wh/Mark'
import { DotField } from '@/wh/effects/DotField'
import { ICONS } from '@/wh/icons'
import { Icon } from '@/wh/Icon'
import { SidebarItem, TabBar, type NavItem } from '@/wh/nav'
import { Menu, type MenuItem } from '@/wh/Menu'
import { useBook } from '@/wh/model/book'
import { useGrow } from '@/wh/model/grow'
import { useDesktop } from '@/wh/useMediaQuery'
import { usePrivacy } from '@/wealth/PrivacyContext'
import { useDemo } from '@/wealth/DemoContext'
import { useAuth, initials } from '@/auth/AuthContext'
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
import { Settings } from '@/wh/screens/Settings'
import { Onboarding } from '@/wh/screens/Onboarding'
import { Analysis } from '@/pages/Analysis'
import { Brokerage } from '@/pages/Brokerage'
import { Goals } from '@/pages/Goals'
import { HoldingDetail } from '@/pages/HoldingDetail'
import { PlanChip } from '@/wh/screens/Billing'
import { R } from '@/routes'
import '@/wh/shell.css'

interface Section {
  key: string
  label: string
  icon: NavItem['icon']
  to: string
  end?: boolean
  group: 'main' | 'insights'
  /** In the phone tab bar. */
  tab?: boolean
}

const SECTIONS: Section[] = [
  { key: 'overview', label: 'Overview', icon: ICONS.nav.overview, to: R.overview, end: true, group: 'main', tab: true },
  { key: 'holdings', label: 'Holdings', icon: ICONS.nav.holdings, to: R.holdings, group: 'main', tab: true },
  { key: 'exposure', label: 'Exposure', icon: ICONS.nav.exposure, to: R.exposure, group: 'main', tab: true },
  { key: 'cashflow', label: 'Cash flow', icon: ICONS.nav.cashflow, to: R.cashflow, group: 'main', tab: true },
  { key: 'subscriptions', label: 'Subscriptions', icon: ICONS.nav.subscriptions, to: R.subscriptions, group: 'main' },
  { key: 'grow', label: 'Grow', icon: ICONS.nav.grow, to: R.grow, group: 'main', tab: true },
  { key: 'performance', label: 'Performance', icon: ICONS.nav.performance, to: R.performance, group: 'insights' },
  { key: 'activity', label: 'Activity', icon: ICONS.nav.activity, to: R.activity, group: 'insights' },
  { key: 'planning', label: 'Planning', icon: ICONS.nav.planning, to: R.planning, group: 'insights' },
  { key: 'connections', label: 'Connections', icon: ICONS.nav.connections, to: R.connect, group: 'insights' },
]

function isActive(s: Section, pathname: string): boolean {
  if (s.end) return pathname === s.to
  return pathname === s.to || pathname.startsWith(`${s.to}/`)
}

function Legacy({ children }: { children: ReactNode }) {
  return <div className="a-page wh-legacy">{children}</div>
}

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const desktop = useDesktop()
  const { user, logout } = useAuth()
  const book = useBook()
  const grow = useGrow()
  const attention = useAttention()
  const { hidden, toggle: togglePrivacy } = usePrivacy()
  const { enabled: sampleOn, toggle: toggleSample } = useDemo()
  const [syncOpen, setSyncOpen] = useState(false)
  const [inboxOpen, setInboxOpen] = useState(false)

  useEffect(() => {
    // A new screen starts at the top.
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  const onboarding = location.pathname === R.welcome
  const needsOnboarding = user != null && user.onboardedAt == null

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
  const main = items.filter((_, i) => SECTIONS[i].group === 'main')
  const insights = items.filter((_, i) => SECTIONS[i].group === 'insights')
  const tabs = items.filter((_, i) => SECTIONS[i].tab)

  const broken = book.broken[0]
  const statusTone = broken ? 'bad' : book.stale.length ? 'warn' : 'ok'
  const statusText = broken ? `${broken.name} needs attention` : book.stale.length ? `${book.stale.length} out of date` : book.synced ? `${book.synced} synced` : 'Nothing connected'

  const personItems: Array<MenuItem | 'rule'> = [
    { key: 'settings', label: 'Settings', icon: ICONS.ui.settings, onSelect: () => navigate(R.settings) },
    { key: 'privacy', label: hidden ? 'Show balances' : 'Hide balances', icon: hidden ? ICONS.ui.show : ICONS.ui.hide, onSelect: togglePrivacy },
    { key: 'sample', label: 'Sample household', sub: sampleOn ? 'Shown beside your own accounts' : 'Off', icon: ICONS.action.education, on: sampleOn, onSelect: toggleSample },
    { key: 'attention', label: 'Needs attention', sub: attention.length ? `${attention.length} ${attention.length === 1 ? 'thing' : 'things'}` : 'Nothing right now', icon: ICONS.ui.notifications, onSelect: () => setInboxOpen(true) },
    'rule',
    { key: 'logout', label: 'Sign out', icon: ICONS.ui.logout, onSelect: () => void logout().then(() => navigate(R.home, { replace: true })) },
  ]
  const personHead = user ? (
    <div className="wh-menu-head">
      <b>{user.name}</b>
      <span>{user.email}</span>
      <PlanChip />
    </div>
  ) : null

  if (needsOnboarding && !onboarding) return <Navigate to={R.welcome} replace />

  return (
    <div className="wh-root">
      <Warmup />
      <a href="#main-content" className="wh-skip">
        Skip to content
      </a>
      {desktop && !onboarding && (
        <aside className="wh-sidebar">
          <a href={R.overview} onClick={go(R.overview)} className="wh-sidebar-brand" aria-label="Wealth Hub, overview">
            <Lockup size={21} />
          </a>
          <nav className="wh-sidebar-group" aria-label="Sections">
            {main.map((it) => (
              <SidebarItem key={it.key} item={it} />
            ))}
          </nav>
          <div className="wh-sidebar-label">Insights</div>
          <nav className="wh-sidebar-group" aria-label="Insights">
            {insights.map((it) => (
              <SidebarItem key={it.key} item={it} />
            ))}
          </nav>
          <div className="wh-sidebar-foot">
            <DotField className="wh-sidebar-picture" image="/wh/images/garden-dots-marble.png" darkImage="/wh/images/garden-dots-night.png" position={[46, 42]} spacing={5}>
              <button type="button" className={`wh-sidebar-status ${statusTone}`} onClick={() => setSyncOpen(true)} title="Open connections">
                <i className="wh-dot" aria-hidden="true" />
                <span>{statusText}</span>
                {attention.length > 0 && <span className="wh-count" title="Needs attention">{attention.length}</span>}
              </button>
            </DotField>
            <Menu
              label="Account"
              align="left"
              up
              head={personHead}
              items={personItems}
              trigger={(props) => (
                <button type="button" className="wh-sidebar-person" {...props}>
                  <span className="wh-avatar">{initials(user?.name, user?.email)}</span>
                  <span className="wh-sidebar-person-text">
                    <b>{user?.name ?? 'Account'}</b>
                    <span>{user?.email ?? ''}</span>
                  </span>
                  <Icon name={ICONS.ui.expand} size={16} />
                </button>
              )}
            />
          </div>
        </aside>
      )}

      <div className="wh-main-col">
        <main id="main-content" tabIndex={-1} className={`wh-main${location.pathname.startsWith(R.performance) || location.pathname.startsWith(R.activity) || location.pathname.startsWith(R.planning) ? ' wh-legacy' : ''}`}>
          <Routes>
            <Route index element={<Overview />} />
            <Route path="welcome" element={<Onboarding />} />
            <Route path="holdings" element={<Holdings />} />
            <Route path="exposure" element={<Exposure />} />
            <Route path="cashflow" element={<Cashflow />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="grow" element={<Grow />} />
            <Route path="grow/:id" element={<Grow />} />
            <Route path="connect" element={<Connect />} />
            <Route path="settings" element={<Settings />} />
            <Route
              path="performance"
              element={
                <Legacy>
                  <Analysis />
                </Legacy>
              }
            />
            <Route
              path="activity"
              element={
                <Legacy>
                  <Brokerage />
                </Legacy>
              }
            />
            <Route
              path="planning"
              element={
                <Legacy>
                  <Goals />
                </Legacy>
              }
            />
            <Route
              path="holdings/:symbol"
              element={
                <Legacy>
                  <HoldingDetail />
                </Legacy>
              }
            />
            <Route path="accounts" element={<Navigate to={R.connect} replace />} />
            <Route path="analysis" element={<Navigate to={R.performance} replace />} />
            <Route path="brokerage" element={<Navigate to={R.activity} replace />} />
            <Route path="goals" element={<Navigate to={R.planning} replace />} />
            <Route path="wallets" element={<Navigate to={R.connect} replace />} />
            <Route path="*" element={<Navigate to={R.overview} replace />} />
          </Routes>
        </main>
      </div>

      <SyncSheet open={syncOpen} onClose={() => setSyncOpen(false)} />
      <AttentionSheet open={inboxOpen} onClose={() => setInboxOpen(false)} items={attention} />

      {!desktop && !onboarding && <TabBar items={tabs} />}
    </div>
  )
}

/** The account menu the phone screens put in their header. */
export function PersonMenu() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { hidden, toggle: togglePrivacy } = usePrivacy()
  const { enabled: sampleOn, toggle: toggleSample } = useDemo()
  const items: Array<MenuItem | 'rule'> = [
    { key: 'settings', label: 'Settings', icon: ICONS.ui.settings, onSelect: () => navigate(R.settings) },
    { key: 'connect', label: 'Connections', icon: ICONS.nav.connections, onSelect: () => navigate(R.connect) },
    { key: 'privacy', label: hidden ? 'Show balances' : 'Hide balances', icon: hidden ? ICONS.ui.show : ICONS.ui.hide, onSelect: togglePrivacy },
    { key: 'sample', label: 'Sample household', icon: ICONS.action.education, on: sampleOn, onSelect: toggleSample },
    'rule',
    { key: 'logout', label: 'Sign out', icon: ICONS.ui.logout, onSelect: () => void logout().then(() => navigate(R.home, { replace: true })) },
  ]
  return (
    <Menu
      label="Account"
      items={items}
      head={
        user ? (
          <div className="wh-menu-head">
            <b>{user.name}</b>
            <span>{user.email}</span>
            <PlanChip />
          </div>
        ) : null
      }
      trigger={(props) => (
        <button type="button" className="wh-avatar" aria-label="Account and preferences" {...props}>
          {initials(user?.name, user?.email)}
        </button>
      )}
    />
  )
}
