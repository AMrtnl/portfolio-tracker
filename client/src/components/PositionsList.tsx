import { DetailList, DisclosureRow, SectionHead } from '@/components/ui/data'
import { Amount, Delta } from '@/components/ui/Amount'
import { EmptyState } from '@/components/ui/states'
import { formatAmount, formatCurrency, cn } from '@/lib/utils'

interface Position {
  asset: string
  size: string
  entryPrice: string
  markPrice: string
  pnl: string
  pnlPercent: string
  leverage: string
  side: 'LONG' | 'SHORT'
  type: 'PERPETUAL' | 'FUTURE' | 'OPTION' | 'EQUITY'
  protocol: string
  accountLabel?: string
}

interface PositionsListProps {
  positions: Position[]
}

/**
 * Open derivative positions. Side and leverage stay as small neutral tags so
 * the only colour in the row is the P&L — the discipline QuestMobile and
 * Fidelity apply to their position lists.
 */
export function PositionsList({ positions }: PositionsListProps) {
  const netPnl = positions.reduce((s, p) => s + (parseFloat(p.pnl) || 0), 0)

  return (
    <section aria-labelledby="positions-heading">
      <SectionHead
        id="positions-heading"
        title="Open positions"
        meta={
          positions.length === 0 ? (
            'None open'
          ) : (
            <span
              className={cn('num', netPnl >= 0 ? 'text-gain' : 'text-loss')}
            >
              {formatCurrency(netPnl)} net · {positions.length}
            </span>
          )
        }
      />

      {positions.length === 0 ? (
        <div className="border-y border-border/60">
          <EmptyState
            glyph="positions"
            title="No open positions"
            description="Perpetual and futures positions from Hyperliquid appear here while a trade is live."
          />
        </div>
      ) : (
        <>
          <div className="hidden border-b border-border/70 px-2 pb-2 sm:grid sm:grid-cols-[minmax(0,1fr)_8rem_7rem_1.25rem] sm:items-end sm:gap-3">
            <span className="t-eyebrow">Position</span>
            <span className="t-eyebrow text-right">Entry → Mark</span>
            <span className="t-eyebrow text-right">Unrealised</span>
            <span aria-hidden />
          </div>

          <ul className="list-none border-b border-border/70 p-0">
            {positions.map((position, index) => {
              const pnl = parseFloat(position.pnl) || 0
              const pnlPct = parseFloat(position.pnlPercent) || 0
              const isLong = position.side === 'LONG'

              return (
                <DisclosureRow
                  key={`${position.asset}-${position.side}-${index}`}
                  label={`${position.asset} ${position.side}`}
                  className="animate-rise"
                  summary={
                    <div className="sm:grid sm:grid-cols-[minmax(0,1fr)_8rem_7rem] sm:items-center sm:gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{position.asset}</p>
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                              isLong ? 'chip-gain' : 'chip-loss',
                            )}
                          >
                            {position.side}
                          </span>
                          <span className="num chip-neutral rounded px-1.5 py-0.5 text-[10px] font-medium">
                            {position.leverage}×
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {position.accountLabel
                            ? `${position.accountLabel} · ${position.protocol}`
                            : position.protocol}
                        </p>
                      </div>

                      <p className="num hidden text-right text-xs text-muted-foreground sm:block">
                        {formatCurrency(position.entryPrice)}
                        <span aria-hidden> → </span>
                        <span className="text-foreground">
                          {formatCurrency(position.markPrice)}
                        </span>
                      </p>

                      <div className="mt-1.5 flex items-baseline justify-between gap-3 sm:mt-0 sm:block sm:text-right">
                        <span className="num text-xs text-muted-foreground sm:hidden">
                          {formatCurrency(position.entryPrice)} →{' '}
                          {formatCurrency(position.markPrice)}
                        </span>
                        <span className="flex flex-col items-end">
                          <Amount
                            value={pnl}
                            className={cn(
                              'text-sm font-semibold',
                              pnl >= 0 ? 'text-gain' : 'text-loss',
                            )}
                          />
                          <Delta percent={pnlPct} size="sm" />
                        </span>
                      </div>
                    </div>
                  }
                  detail={
                    <DetailList
                      items={[
                        { label: 'Size', value: formatAmount(position.size) },
                        { label: 'Leverage', value: `${position.leverage}×` },
                        {
                          label: 'Entry price',
                          value: formatCurrency(position.entryPrice),
                        },
                        {
                          label: 'Mark price',
                          value: formatCurrency(position.markPrice),
                        },
                        { label: 'Contract', value: position.type },
                        { label: 'Venue', value: position.protocol },
                      ]}
                    />
                  }
                />
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
