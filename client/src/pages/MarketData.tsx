import { useEconomicCalendar, useEarningsCalendar, useMarketNews, useMacroData, useCryptoPrices } from '@/hooks/useMarketData'
import { cn } from '@/lib/utils'
import { Globe, TrendingUp, Newspaper, Calendar, Activity } from 'lucide-react'
import { format } from 'date-fns'

const IMPACT_COLORS = { HIGH: 'bg-red-500', MEDIUM: 'bg-amber-500', LOW: 'bg-green-500' }

export function MarketData() {
  const { data: economicEvents = [] } = useEconomicCalendar()
  const { data: earningsEvents = [] } = useEarningsCalendar()
  const { data: news = [] } = useMarketNews()
  const { data: macro } = useMacroData()
  const { data: prices = [] } = useCryptoPrices()

  const SENTIMENT_LABEL = (s: number) => {
    if (s <= 20) return { label: 'Extreme Fear', color: 'loss' }
    if (s <= 40) return { label: 'Fear', color: 'text-amber-400' }
    if (s <= 60) return { label: 'Neutral', color: 'text-muted-foreground' }
    if (s <= 80) return { label: 'Greed', color: 'text-blue-400' }
    return { label: 'Extreme Greed', color: 'gain' }
  }

  const fg = macro ? SENTIMENT_LABEL(macro.fearGreedIndex) : { label: 'Loading', color: 'text-muted-foreground' }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Market Data</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Economic calendar, earnings, news, and macro indicators</p>
      </div>

      {/* Macro dashboard */}
      {macro && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Macro Dashboard
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Fed Funds Rate', value: `${macro.fedFundsRate}%`, color: '' },
              { label: 'CPI (YoY)', value: `${macro.cpi}%`, color: macro.cpi > 3 ? 'loss' : macro.cpi < 2 ? 'text-blue-400' : 'gain' },
              { label: '10Y Treasury', value: `${macro.tenYearYield}%`, color: '' },
              { label: 'DXY', value: macro.dxy.toFixed(1), color: '' },
              { label: 'Fear & Greed', value: macro.fearGreedIndex.toString(), color: fg.color },
              { label: 'Sentiment', value: fg.label, color: fg.color },
            ].map(m => (
              <div key={m.label} className="text-center p-3 bg-secondary/40 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                <p className={cn('font-bold text-lg', m.color)}>{m.value}</p>
              </div>
            ))}
          </div>
          {/* Fear & Greed bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Extreme Fear</span>
              <span>Extreme Greed</span>
            </div>
            <div className="h-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 relative">
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow border-2 border-gray-800 transition-all"
                style={{ left: `${macro.fearGreedIndex}%`, transform: 'translate(-50%, -50%)' }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Economic Calendar */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Economic Calendar (7 days)
          </h3>
          <div className="space-y-2">
            {economicEvents.map((e: any, i: number) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                <div className="text-center w-16 shrink-0">
                  <p className="text-xs text-muted-foreground">{format(new Date(e.date), 'MMM d')}</p>
                  {e.time && <p className="text-xs font-medium">{e.time}</p>}
                </div>
                <div className={cn('w-2 h-2 rounded-full shrink-0', IMPACT_COLORS[e.impact as keyof typeof IMPACT_COLORS])} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.event}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{e.country}</span>
                    {e.forecast && <span>Forecast: {e.forecast}</span>}
                    {e.previous && <span>Prev: {e.previous}</span>}
                    {e.actual && <span className="font-semibold text-foreground">Actual: {e.actual}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Earnings Calendar */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Earnings Calendar (7 days)
          </h3>
          <div className="space-y-2">
            {earningsEvents.map((e: any, i: number) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                <div className="text-center w-16 shrink-0">
                  <p className="text-xs text-muted-foreground">{format(new Date(e.date), 'MMM d')}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold shrink-0">
                  {e.ticker.slice(0, 4)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.company}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{e.period}</span>
                    {e.epsEstimate != null && <span>EPS Est: ${e.epsEstimate}</span>}
                    {e.epsActual != null && (
                      <span className={e.epsActual >= (e.epsEstimate ?? 0) ? 'gain' : 'loss'}>
                        Actual: ${e.epsActual}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Crypto prices */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Crypto Prices
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {prices.map((p: any) => (
            <div key={p.symbol} className="bg-secondary/40 rounded-lg p-3">
              <p className="text-xs font-bold text-muted-foreground">{p.symbol}</p>
              <p className="font-bold mt-0.5">${p.price < 1 ? p.price.toFixed(4) : p.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              <p className={cn('text-xs font-semibold mt-0.5', p.change24hPercent >= 0 ? 'gain' : 'loss')}>
                {p.change24hPercent >= 0 ? '+' : ''}{p.change24hPercent.toFixed(2)}%
              </p>
              {p.volume24h && <p className="text-xs text-muted-foreground mt-0.5">Vol: ${(p.volume24h / 1e9).toFixed(1)}B</p>}
            </div>
          ))}
        </div>
      </div>

      {/* News feed */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Newspaper className="w-4 h-4" />
          Latest News
        </h3>
        <div className="space-y-3">
          {news.map((n: any) => (
            <div key={n.id} className="flex gap-4 p-3 bg-secondary/30 rounded-lg hover:bg-secondary/60 transition-colors cursor-pointer group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold group-hover:text-primary transition-colors line-clamp-2">{n.headline}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.summary}</p>
                <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span className="font-medium">{n.source}</span>
                  <span>{format(new Date(n.timestamp), 'MMM d, HH:mm')}</span>
                  {n.sentiment && n.sentiment !== 'NEUTRAL' && (
                    <span className={n.sentiment === 'POSITIVE' ? 'gain' : 'loss'}>{n.sentiment}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
