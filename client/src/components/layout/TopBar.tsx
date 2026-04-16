import { RefreshCw, Bell, Menu } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import axios from 'axios'
import { cn } from '@/lib/utils'

interface TopBarProps {
  sidebarOpen: boolean
  onMenuToggle: () => void
}

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${v.toFixed(2)}`
}

export function TopBar({ onMenuToggle }: TopBarProps) {
  const qc = useQueryClient()

  const { data: portfolio, isRefetching } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => axios.get('/api/portfolio').then(r => r.data),
    staleTime: 60_000,
  })

  const total = portfolio?.totalValue ?? 0
  const pnl   = portfolio?.pnl24h ?? 0
  const pct   = portfolio?.pnl24hPercent ?? 0

  return (
    <header
      className="flex items-center gap-3 px-4 shrink-0"
      style={{
        height: '56px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--glass-border)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      {/* Mobile menu */}
      <button onClick={onMenuToggle} className="p-1.5 rounded-lg md:hidden" style={{ color: 'var(--text-muted)' }}>
        <Menu className="w-4 h-4" />
      </button>

      {/* Net worth ticker */}
      {total > 0 && (
        <div className="flex items-center gap-3 mr-2">
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Net Worth</p>
            <p className="text-sm font-bold leading-tight" style={{ fontFamily: 'Space Grotesk' }}>{fmt(total)}</p>
          </div>
          <div className={cn('text-xs font-semibold px-2 py-0.5 rounded', pnl >= 0 ? 'badge-gain' : 'badge-loss')}>
            {pnl >= 0 ? '+' : ''}{pct.toFixed(2)}%
          </div>
        </div>
      )}

      <div className="flex-1" />

      {/* Refresh */}
      <button
        onClick={() => qc.invalidateQueries()}
        className="p-2 rounded-lg transition-colors"
        style={{ color: 'var(--text-muted)', background: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <RefreshCw className={cn('w-3.5 h-3.5', isRefetching && 'animate-spin')} />
      </button>

      {/* Alerts bell */}
      <button
        className="relative p-2 rounded-lg transition-colors"
        style={{ color: 'var(--text-muted)', background: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <Bell className="w-3.5 h-3.5" />
      </button>

      {/* Wallet connect */}
      <ConnectButton
        showBalance={false}
        chainStatus="icon"
        accountStatus="avatar"
      />
    </header>
  )
}
