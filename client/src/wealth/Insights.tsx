import { GAIN, TINT } from '@/wealth/tokens'
import { Ring } from '@/wealth/charts'
import { useMoney } from '@/wealth/format'
import type { AllocationSegment } from '@/hooks/useAnalytics'

export function InsightsStrip({
  topLabel,
  topPercent,
  liquidPercent,
  defensive,
  growth,
  speculative,
  best,
  worst,
}: {
  topLabel?: string
  topPercent?: number
  liquidPercent: number
  defensive: number
  growth: number
  speculative: number
  best?: { symbol: string; pct: number }
  worst?: { symbol: string; pct: number }
}) {
  const { pctStr } = useMoney()
  const conc = topPercent ?? 0
  const riskTotal = Math.max(defensive + growth + speculative, 1)
  const buckets = [
    { key: 'low', name: 'Defensive', color: '#3ABEFF', amount: defensive },
    { key: 'mid', name: 'Growth', color: '#FFD84D', amount: growth },
    { key: 'high', name: 'Speculative', color: '#FF5C48', amount: speculative },
  ]

  return (
    <>
      <div className="a-header">Insights</div>
      <div className="a-scroller">
        {topLabel != null && (
          <article className="a-ins">
            <div className="a-instop">
              <div>
                <div className="a-inslabel">Concentration</div>
                <div className="a-insval">{conc.toFixed(0)}%</div>
              </div>
              <Ring
                pct={conc}
                color={conc > 50 ? '#FF9F45' : GAIN}
                label={`${conc.toFixed(0)}%`}
              />
            </div>
            <p className="a-insnote">
              {topLabel} is your largest single holding.
              {conc > 50 ? ' Over half your assets sit in one place.' : ''}
            </p>
          </article>
        )}

        <article className="a-ins">
          <div className="a-instop">
            <div>
              <div className="a-inslabel">Liquid assets</div>
              <div className="a-insval">{liquidPercent.toFixed(0)}%</div>
            </div>
            <Ring pct={liquidPercent} color={TINT} label={`${liquidPercent.toFixed(0)}%`} />
          </div>
          <p className="a-insnote">
            Cash, stocks, bonds and crypto versus everything else in the book.
          </p>
        </article>

        <article className="a-ins">
          <div className="a-inslabel">Risk mix</div>
          <div className="a-riskbar">
            {buckets.map((b) => (
              <i
                key={b.key}
                style={{ flex: Math.max(b.amount, 0.01), background: b.color }}
              />
            ))}
          </div>
          <div className="a-risklegend">
            {buckets.map((b) => (
              <span key={b.key}>
                <i style={{ background: b.color }} />
                {b.name}
                <b>{((b.amount / riskTotal) * 100).toFixed(0)}%</b>
              </span>
            ))}
          </div>
        </article>

        {(best || worst) && (
          <article className="a-ins">
            <div className="a-inslabel">Today&apos;s movers</div>
            {best && (
              <div className="a-mover">
                <span className="a-atext">
                  <b>{best.symbol}</b>
                  <em>Best</em>
                </span>
                <span className="a-tag gain">{pctStr(best.pct)}</span>
              </div>
            )}
            {worst && (
              <div className="a-mover">
                <span className="a-atext">
                  <b>{worst.symbol}</b>
                  <em>Worst</em>
                </span>
                <span className="a-tag loss">{pctStr(worst.pct)}</span>
              </div>
            )}
          </article>
        )}
      </div>
    </>
  )
}

export function toSplitRows(
  segments: AllocationSegment[] | undefined,
  colors: Record<string, { name: string; color: string }>,
  flags?: Record<string, string>,
) {
  return (segments ?? []).map((s, i) => {
    const pal = colors[s.key] || colors[s.key.toLowerCase()]
    const palette = Object.values(colors)
    const name = pal?.name ?? s.label
    return {
      key: s.key,
      name,
      color: pal?.color ?? palette[i % palette.length]?.color ?? '#8E8E93',
      amount: s.value,
      pct: s.percent,
      icon: flags
        ? flags[s.key] ?? flags[s.key.toLowerCase()] ?? flags[name.toLowerCase()]
        : undefined,
    }
  })
}
