import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Bitcoin, Building2, LineChart, Bot, Globe,
  Wallet, PiggyBank, Settings, Zap, ChevronLeft, ChevronRight,
  TrendingUp,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/crypto', icon: Bitcoin, label: 'Crypto' },
  { to: '/tradfi', icon: Building2, label: 'TradFi' },
  { to: '/predictions', icon: TrendingUp, label: 'Predictions' },
  { to: '/analytics', icon: LineChart, label: 'Analytics' },
  { to: '/ai', icon: Bot, label: 'AI Advisor' },
  { to: '/market', icon: Globe, label: 'Market Data' },
  { to: '/budget', icon: PiggyBank, label: 'Budget' },
  { to: '/accounts', icon: Wallet, label: 'Accounts' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen sticky top-0 border-r border-border bg-card transition-all duration-300 z-40',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center gap-2 px-4 py-5 border-b border-border', collapsed && 'justify-center px-0')}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20">
          <Zap className="w-4 h-4 text-primary" />
        </div>
        {!collapsed && <span className="font-bold text-lg tracking-tight">FinVault</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn('sidebar-item', isActive && 'active', collapsed && 'justify-center px-0 py-3')
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border p-2">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="sidebar-item w-full justify-center"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
