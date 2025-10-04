import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'

interface Position {
  asset: string
  size: string
  entryPrice: string
  markPrice: string
  pnl: string
  pnlPercent: string
  leverage: string
  side: 'LONG' | 'SHORT'
  type: 'PERPETUAL' | 'FUTURE' | 'OPTION'
  protocol: string
}

interface PositionsListProps {
  positions: Position[]
}

export function PositionsList({ positions }: PositionsListProps) {
  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Open Positions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {positions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No open positions. Start trading on Hyperliquid to see your positions here.
            </p>
          ) : (
            <div className="space-y-2">
              {positions.map((position, index) => {
                const pnlNum = parseFloat(position.pnl)
                const isProfitable = pnlNum >= 0

                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        position.side === 'LONG' ? 'bg-green-500/10' : 'bg-red-500/10'
                      }`}>
                        {position.side === 'LONG' ? (
                          <TrendingUp className="h-5 w-5 text-green-500" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{position.asset}</p>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            position.side === 'LONG' 
                              ? 'bg-green-500/20 text-green-700 dark:text-green-300' 
                              : 'bg-red-500/20 text-red-700 dark:text-red-300'
                          }`}>
                            {position.side}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
                            {position.leverage}x
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {position.protocol} • {position.type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div>
                        <p className="text-sm text-muted-foreground">Size: {parseFloat(position.size).toFixed(4)}</p>
                        <p className="text-sm text-muted-foreground">
                          Entry: {formatCurrency(position.entryPrice)} → Mark: {formatCurrency(position.markPrice)}
                        </p>
                      </div>
                      <div className={`font-medium ${isProfitable ? 'text-green-500' : 'text-red-500'}`}>
                        {formatCurrency(pnlNum)} ({formatPercent(parseFloat(position.pnlPercent))})
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
