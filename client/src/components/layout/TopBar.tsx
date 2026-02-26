import { RefreshCw, Sun, Moon, Bell, Menu } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { cn } from '@/lib/utils'

interface TopBarProps {
  theme: 'dark' | 'light'
  onThemeToggle: () => void
  onMenuToggle: () => void
}

export function TopBar({ theme, onThemeToggle, onMenuToggle }: TopBarProps) {
  const qc = useQueryClient()
  const { data: portfolio, isFetching } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => axios.get('/api/portfolio').then(r => r.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const totalValue = portfolio?.totalValue ?? 0
  const pnl = portfolio?.pnl24h ?? 0
  const pnlPct = portfolio?.pnl24hPercent ?? 0
  const positive = pnl >= 0

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center gap-4 px-4 border-b border-border bg-card/80 backdrop-blur-xl">
      {/* Mobile menu */}
      <button onClick={onMenuToggle} className="md:hidden text-muted-foreground hover:text-foreground">
        <Menu className="w-5 h-5" />
      </button>

      {/* Net worth ticker */}
      <div className="flex items-center gap-3">
        <div>
          <p className="text-xs text-muted-foreground font-medium">Net Worth</p>
          <p className="font-bold text-lg leading-none">
            {totalValue > 0
              ? `$${totalValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
              : '—'
            }
          </p>
        </div>
        {totalValue > 0 && (
          <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-md', positive ? 'gain-bg' : 'loss-bg')}>
            {positive ? '+' : ''}{pnlPct.toFixed(2)}%
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        {/* Refresh */}
        <button
          onClick={() => qc.invalidateQueries()}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Refresh all data"
        >
          <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
        </button>

        {/* Alerts indicator */}
        <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors relative">
          <Bell className="w-4 h-4" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={onThemeToggle}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  )
}
