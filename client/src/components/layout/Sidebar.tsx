import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Bitcoin, Building2, LineChart, Bot, Globe,
  Wallet, PiggyBank, Settings, TrendingUp, ArrowLeftRight,
  CandlestickChart, ChevronLeft, ChevronRight, Sparkles,
} from 'lucide-react'

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

const NAV = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/crypto',      icon: Bitcoin,         label: 'Crypto' },
  { to: '/tradfi',      icon: Building2,       label: 'TradFi' },
  { to: '/predictions', icon: CandlestickChart, label: 'Predictions' },
  { to: '/analytics',   icon: LineChart,       label: 'Analytics' },
  { to: '/swap',        icon: ArrowLeftRight,  label: 'Swap' },
  { to: '/ai',          icon: Bot,             label: 'AI Advisor', pro: true },
  { to: '/market',      icon: Globe,           label: 'Market' },
  { to: '/budget',      icon: PiggyBank,       label: 'Budget' },
  { to: '/accounts',    icon: Wallet,          label: 'Accounts' },
]

export function Sidebar({ open, onToggle }: SidebarProps) {
  const location = useLocation()

  return (
    <aside
      className="flex flex-col shrink-0 transition-all duration-250"
      style={{
        width: open ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed)',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--glass-border)',
        overflow: 'hidden',
      }}
    >
      {/* Brand */}
      <div className="flex items-center px-4 h-14 shrink-0" style={{ borderBottom: '1px solid var(--glass-border)' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0" style={{ background: 'var(--gold-dim)', border: '1px solid var(--gold-border)' }}>
            <Sparkles className="w-4 h-4" style={{ color: 'var(--gold)' }} />
          </div>
          {open && (
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>FinVault</p>
              <p className="text-[10px] leading-tight" style={{ color: 'var(--text-muted)' }}>Your Wealth, Unified</p>
            </div>
          )}
        </div>
        {open && (
          <button onClick={onToggle} className="ml-auto p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Collapsed toggle */}
      {!open && (
        <button onClick={onToggle} className="flex items-center justify-center w-full h-10 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {open && <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Navigation</p>}
        {NAV.map(({ to, icon: Icon, label, pro }) => {
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              title={!open ? label : undefined}
              className={cn('nav-item', isActive && 'active')}
              style={!open ? { justifyContent: 'center', padding: '9px' } : {}}
            >
              <Icon className="w-4 h-4 shrink-0" style={{ opacity: isActive ? 1 : 0.7 }} />
              {open && <span className="truncate">{label}</span>}
              {open && pro && (
                <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>PRO</span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-3 space-y-0.5" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '12px' }}>
        <NavLink
          to="/pricing"
          className={cn('nav-item', location.pathname === '/pricing' && 'active')}
          style={!open ? { justifyContent: 'center', padding: '9px' } : {}}
          title={!open ? 'Pricing' : undefined}
        >
          <Sparkles className="w-4 h-4 shrink-0" style={{ opacity: 0.7 }} />
          {open && <span>Upgrade</span>}
        </NavLink>
        <NavLink
          to="/settings"
          className={cn('nav-item', location.pathname === '/settings' && 'active')}
          style={!open ? { justifyContent: 'center', padding: '9px' } : {}}
          title={!open ? 'Settings' : undefined}
        >
          <Settings className="w-4 h-4 shrink-0" style={{ opacity: 0.7 }} />
          {open && <span>Settings</span>}
        </NavLink>
      </div>
    </aside>
  )
}
