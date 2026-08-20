import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useAnalyticsHoldings } from '@/hooks/useAnalytics'
import { useMoney } from '@/wealth/format'
import { accountClass, accountValue, isLiability } from '@/wealth/classifyAccount'
import { CLASSES, type AssetClassId } from '@/wealth/tokens'
import { isDemoId } from '@/wealth/demo'
import { LogoAvatar } from '@/wealth/logos'
import type { AnalyticsHolding } from '@/hooks/useAnalytics'

export function HoldingsGroups({
  gross,
  debt,
  currency,
  collapsed,
  onToggle,
}: {
  gross: number
  debt: number
  currency: string
  collapsed: Record<string, boolean>
  onToggle: (id: string) => void
}) {
  const { chf, pctStr } = useMoney()
  const { data: accounts } = useAccounts()
  const { data: holdings } = useAnalyticsHoldings()

  const assets = (accounts ?? []).filter((a) => !isLiability(a))
  const loans = (accounts ?? []).filter(isLiability)

  const grouped = new Map<AssetClassId, typeof assets>()
  for (const a of assets) {
    const id = accountClass(a)
    const list = grouped.get(id) ?? []
    list.push(a)
    grouped.set(id, list)
  }

  const fromAccounts: AnalyticsHolding[] = []
  for (const a of accounts ?? []) {
    for (const h of a.holdings ?? []) {
      fromAccounts.push({
        symbol: h.symbol,
        name: h.name,
        units: h.quantity,
        price: h.priceUsd,
        marketValue: h.quantity * h.priceUsd,
        accountId: a.id,
        accountLabel: a.label,
        currency: a.currency,
      })
    }
  }
  const liveHoldings = holdings?.holdings ?? []
  const seenHoldings = new Set(liveHoldings.map((h) => `${h.symbol}-${h.accountId}`))
  const mergedHoldings = liveHoldings.length
    ? [
        ...liveHoldings,
        ...fromAccounts.filter(
          (h) => isDemoId(h.accountId) && !seenHoldings.has(`${h.symbol}-${h.accountId}`),
        ),
      ]
    : fromAccounts
  const topPositions = [...mergedHoldings]
    .sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0))
    .slice(0, 8)

  const debtOpen = !collapsed.debt
  const debtShare = gross + debt > 0 ? (debt / (gross + debt)) * 100 : 0

  return (
    <>
      <div className="a-header">Holdings</div>
      <div className="a-holdings-cols">
      {CLASSES.map((c) => {
        const rows = grouped.get(c.id) ?? []
        if (!rows.length) return null
        const sum = rows.reduce((s, a) => s + accountValue(a), 0)
        const share = gross ? (sum / gross) * 100 : 0
        const open = !collapsed[c.id]
        return (
          <section key={c.id} className="a-gcard">
            <button type="button" className="a-ghead" onClick={() => onToggle(c.id)}>
              <span className="a-tile" style={{ background: `${c.color}26` }}>
                <span className="a-tiledot" style={{ background: c.color }} />
              </span>
              <span className="a-gtext">
                <b>{c.name}</b>
                <span className="a-bar">
                  <i style={{ width: `${Math.min(share, 100)}%`, background: c.color }} />
                </span>
              </span>
              <span className="a-gnum">
                <b>{chf(sum, false, currency)}</b>
                <em>{share.toFixed(0)}%</em>
              </span>
              <ChevronRight
                size={16}
                strokeWidth={2.5}
                className={`a-chev ${open ? 'open' : ''}`}
              />
            </button>
            {open && (
              <div className="a-arows">
                {rows.map((a) => (
                  <Link key={a.id} to="/accounts" className="a-arow tap">
                    <LogoAvatar
                      institution={a.institution}
                      name={a.label}
                      color={c.color}
                    />
                    <span className="a-atext">
                      <b>
                        {a.label}
                        {a.status === 'error' && (
                          <i className="a-stale" title="Needs attention" />
                        )}
                      </b>
                      <em>
                        {a.status === 'error'
                          ? a.lastError || 'Sync failed'
                          : a.notes || a.institution || a.maskedIdentifier || a.type}
                      </em>
                    </span>
                    <span className="a-anum">
                      <b>{chf(accountValue(a), false, currency)}</b>
                    </span>
                    <ChevronRight size={15} strokeWidth={2.5} className="a-rowchev" />
                  </Link>
                ))}
              </div>
            )}
          </section>
        )
      })}
      </div>

      {loans.length > 0 && (
        <>
          <div className="a-header">Liabilities</div>
          <section className="a-gcard">
            <button type="button" className="a-ghead" onClick={() => onToggle('debt')}>
              <span className="a-tile hatch">
                <span className="a-tiledot hatch" />
              </span>
              <span className="a-gtext">
                <b>Loans</b>
                <span className="a-bar">
                  <i style={{ width: `${Math.min(debtShare, 100)}%`, background: '#8E8E93' }} />
                </span>
              </span>
              <span className="a-gnum">
                <b className="loss">−{chf(debt, false, currency)}</b>
                <em>
                  {loans.length} {loans.length === 1 ? 'account' : 'accounts'}
                </em>
              </span>
              <ChevronRight
                size={16}
                strokeWidth={2.5}
                className={`a-chev ${debtOpen ? 'open' : ''}`}
              />
            </button>
            {debtOpen && (
              <div className="a-arows">
                {loans.map((l) => (
                  <Link key={l.id} to="/accounts" className="a-arow tap">
                    <LogoAvatar
                      institution={l.institution}
                      name={l.label}
                      color="#AEAEB2"
                    />
                    <span className="a-atext">
                      <b>{l.label}</b>
                      <em>{l.notes || l.institution || 'Loan'}</em>
                    </span>
                    <span className="a-anum">
                      <b className="loss">−{chf(accountValue(l), false, currency)}</b>
                    </span>
                    <ChevronRight size={15} strokeWidth={2.5} className="a-rowchev" />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {topPositions.length > 0 && (
        <>
          <div className="a-header">Positions</div>
          <section className="a-gcard pad">
            {topPositions.map((h) => {
              const pl = h.unrealizedPnlPercent
              return (
                <Link
                  key={`${h.symbol}-${h.accountId}`}
                  to={`/holdings/${encodeURIComponent(h.symbol)}`}
                  className="a-arow tap"
                >
                  <LogoAvatar symbol={h.symbol} name={h.name} color="#FFD84D" />
                  <span className="a-atext">
                    <b>{h.name || h.symbol}</b>
                    <em>
                      {h.symbol}
                      {h.accountLabel ? ` · ${h.accountLabel}` : ''}
                      {h.weight != null ? ` · ${h.weight.toFixed(1)}%` : ''}
                    </em>
                  </span>
                  <span className="a-anum">
                    <b>{chf(h.marketValue, false, h.currency || currency)}</b>
                    <em className={`a-tag ${pl == null ? 'flat' : pl >= 0 ? 'gain' : 'loss'}`}>
                      {pl == null ? '—' : pctStr(pl)}
                    </em>
                  </span>
                  <ChevronRight size={15} strokeWidth={2.5} className="a-rowchev" />
                </Link>
              )
            })}
          </section>
        </>
      )}
    </>
  )
}
