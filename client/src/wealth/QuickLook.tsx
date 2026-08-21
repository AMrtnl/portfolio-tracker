import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { FloatSheet } from '@/wealth/FloatSheet'
import { useAccounts, type Account } from '@/hooks/useAccounts'
import {
  useHistory,
  usePriceHistory,
  useQuote,
  type AnalyticsHolding,
} from '@/hooks/useAnalytics'
import { accountClass, accountValue, isLiability } from '@/wealth/classifyAccount'
import { DetailChart } from '@/wealth/charts'
import { useMoney } from '@/wealth/format'
import { LogoAvatar } from '@/wealth/logos'
import { CLASS_BY_KEY, classOf, type AssetClassId } from '@/wealth/tokens'
import { useMergedHoldings } from '@/wealth/useMergedHoldings'
import { freshness, relativeTime } from '@/lib/utils'

export type QuickLookTarget =
  | { kind: 'class'; id: AssetClassId }
  | { kind: 'account'; id: string }
  | { kind: 'holding'; symbol: string }

interface QuickLookValue {
  look: (target: QuickLookTarget) => void
  close: () => void
}

const QuickLookContext = createContext<QuickLookValue>({
  look: () => {},
  close: () => {},
})

export function useQuickLook() {
  return useContext(QuickLookContext)
}

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function HoldingRow({
  h,
  currency,
  onOpen,
}: {
  h: AnalyticsHolding
  currency: string
  onOpen: () => void
}) {
  const { chf } = useMoney()
  return (
    <button type="button" className="a-arow tap" onClick={onOpen}>
      <LogoAvatar symbol={h.symbol} name={h.name} color="#FFD84D" />
      <span className="a-atext">
        <b>{h.name || h.symbol}</b>
        <em>
          {h.symbol}
          {h.accountLabel ? ` · ${h.accountLabel}` : ''}
        </em>
      </span>
      <span className="a-anum">
        <b>{chf(h.marketValue, false, h.currency || currency)}</b>
      </span>
      <ChevronRight size={15} strokeWidth={2.5} className="a-rowchev" />
    </button>
  )
}

function ClassLook({
  id,
  onLook,
  onClose,
}: {
  id: AssetClassId
  onLook: (t: QuickLookTarget) => void
  onClose: () => void
}) {
  const { chf } = useMoney()
  const { data: accounts } = useAccounts()
  const holdings = useMergedHoldings()
  const { data: history } = useHistory('3m')
  const [cur, setCur] = useState<number | null>(null)

  const cls = CLASS_BY_KEY[id] ?? CLASS_BY_KEY.other
  const assets = (accounts ?? []).filter((a) => !isLiability(a))
  const inClass = assets.filter((a) => accountClass(a) === cls.id)
  const total = inClass.reduce((s, a) => s + accountValue(a), 0)
  const gross = assets.reduce((s, a) => s + accountValue(a), 0)
  const share = gross ? (total / gross) * 100 : 0

  const ids = new Set(inClass.map((a) => a.id))
  const classHoldings = holdings
    .filter(
      (h) =>
        (h.accountId && ids.has(h.accountId)) ||
        classOf(h.assetClass).id === cls.id,
    )
    .sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0))
    .slice(0, 6)

  const points = history?.points ?? []
  const weight = gross ? total / gross : 0
  const values = useMemo(
    () => points.map((p) => p.value * weight),
    [points, weight],
  )
  const shown = cur != null && values[cur] != null ? values[cur] : total

  return (
    <>
      <div className="a-qid">
        <span className="a-tile" style={{ background: `${cls.color}26` }}>
          <span className="a-tiledot" style={{ background: cls.color }} />
        </span>
        <div>
          <h2 className="a-dettitle">{cls.name}</h2>
          <p className="a-detsub">
            {share.toFixed(0)}% of assets · {inClass.length}{' '}
            {inClass.length === 1 ? 'account' : 'accounts'}
          </p>
        </div>
      </div>

      <div className="a-hero bare">
        <div className="a-caption">
          {cur != null && points[cur] ? shortDate(points[cur].date) : 'Value'}
        </div>
        <div className="a-value">{chf(shown)}</div>
      </div>

      {values.length >= 2 && (
        <DetailChart
          values={values}
          height={140}
          color={cls.color}
          dates={(i) => (points[i] ? shortDate(points[i].date) : '')}
          onScrub={setCur}
        />
      )}

      {inClass.length > 0 && (
        <>
          <div className="a-header">Accounts</div>
          <section className="a-gcard">
            {inClass.map((a) => (
              <button
                key={a.id}
                type="button"
                className="a-arow tap"
                onClick={() => onLook({ kind: 'account', id: a.id })}
              >
                <LogoAvatar institution={a.institution} name={a.label} color={cls.color} />
                <span className="a-atext">
                  <b>{a.label}</b>
                  <em>{a.notes || a.institution || a.type}</em>
                </span>
                <span className="a-anum">
                  <b>{chf(accountValue(a))}</b>
                </span>
                <ChevronRight size={15} strokeWidth={2.5} className="a-rowchev" />
              </button>
            ))}
          </section>
        </>
      )}

      {classHoldings.length > 0 && (
        <>
          <div className="a-header">Positions</div>
          <section className="a-gcard">
            {classHoldings.map((h) => (
              <HoldingRow
                key={`${h.symbol}-${h.accountId}`}
                h={h}
                currency="USD"
                onOpen={() => onLook({ kind: 'holding', symbol: h.symbol })}
              />
            ))}
          </section>
        </>
      )}

      <Link to="/accounts" className="a-qlink" onClick={onClose}>
        Manage accounts
        <ArrowUpRight size={15} strokeWidth={2.5} />
      </Link>
    </>
  )
}

function AccountLook({
  id,
  onLook,
  onClose,
}: {
  id: string
  onLook: (t: QuickLookTarget) => void
  onClose: () => void
}) {
  const { chf } = useMoney()
  const { data: accounts } = useAccounts()
  const holdings = useMergedHoldings()

  const account: Account | undefined = (accounts ?? []).find((a) => a.id === id)
  if (!account) {
    return <p className="a-insnote spaced">This account is no longer in the book.</p>
  }

  const cls = CLASS_BY_KEY[accountClass(account)] ?? CLASS_BY_KEY.other
  const liability = isLiability(account)
  const value = accountValue(account)
  const rows = holdings
    .filter((h) => h.accountId === account.id)
    .sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0))
  const fresh = freshness(account.lastSyncedAt)

  return (
    <>
      <div className="a-qid">
        <LogoAvatar
          institution={account.institution}
          name={account.label}
          color={cls.color}
          className="lg"
        />
        <div>
          <h2 className="a-dettitle">{account.label}</h2>
          <p className="a-detsub">
            {account.institution || account.type}
            {liability ? ' · Liability' : ` · ${cls.name}`}
          </p>
        </div>
      </div>

      <div className="a-hero bare">
        <div className="a-caption">Balance</div>
        <div className={`a-value ${liability ? 'loss' : ''}`}>
          {liability ? `−${chf(value)}` : chf(value, false, account.currency)}
        </div>
        {account.status === 'error' ? (
          <div className="a-delta loss">{account.lastError || 'Sync failed'}</div>
        ) : account.lastSyncedAt ? (
          <div className="a-delta muted">
            Synced {relativeTime(account.lastSyncedAt)}
            {fresh === 'stale' ? ' · stale' : ''}
          </div>
        ) : null}
      </div>

      {rows.length > 0 && (
        <>
          <div className="a-header">Holdings</div>
          <section className="a-gcard">
            {rows.map((h) => (
              <HoldingRow
                key={`${h.symbol}-${h.accountId}`}
                h={h}
                currency={account.currency}
                onOpen={() => onLook({ kind: 'holding', symbol: h.symbol })}
              />
            ))}
          </section>
        </>
      )}

      <div className="a-header">Details</div>
      <section className="a-gcard pad">
        <div className="a-inforow">
          <span>Type</span>
          <b>{account.type.replace('_', ' ')}</b>
        </div>
        <div className="a-inforow">
          <span>Currency</span>
          <b>{account.currency}</b>
        </div>
        {account.maskedIdentifier && (
          <div className="a-inforow">
            <span>Identifier</span>
            <b>{account.maskedIdentifier}</b>
          </div>
        )}
        {account.notes && (
          <div className="a-inforow">
            <span>Notes</span>
            <b>{account.notes}</b>
          </div>
        )}
      </section>

      <Link to="/accounts" className="a-qlink" onClick={onClose}>
        Manage in Accounts
        <ArrowUpRight size={15} strokeWidth={2.5} />
      </Link>
    </>
  )
}

function HoldingLook({
  symbol,
  onClose,
}: {
  symbol: string
  onClose: () => void
}) {
  const { chf, pctStr } = useMoney()
  const holdings = useMergedHoldings()
  const { data: quote } = useQuote(symbol)
  const { data: priceHistory } = usePriceHistory(symbol, '3m')
  const [cur, setCur] = useState<number | null>(null)

  const lots = holdings.filter((h) => h.symbol.toUpperCase() === symbol)
  const units = lots.reduce((s, h) => s + (h.units ?? 0), 0)
  const marketValue = lots.reduce((s, h) => s + (h.marketValue || 0), 0)
  const pnl = lots.reduce((s, h) => s + (h.unrealizedPnl ?? 0), 0)
  const costBasis = lots.reduce((s, h) => s + (h.costBasis ?? 0), 0)
  const pnlPct = costBasis ? (pnl / costBasis) * 100 : null
  const name = lots[0]?.name || quote?.name
  const currency = lots[0]?.currency || quote?.currency || 'USD'

  const points = priceHistory?.points ?? []
  const price =
    cur != null && points[cur] ? points[cur].close : quote?.price ?? lots[0]?.price ?? null
  const dayPct = quote?.dayChangePercent

  return (
    <>
      <div className="a-qid">
        <LogoAvatar symbol={symbol} name={name} color="#FFD84D" className="lg" />
        <div>
          <h2 className="a-dettitle">{name || symbol}</h2>
          <p className="a-detsub">
            {symbol}
            {quote?.sector ? ` · ${quote.sector}` : ''}
          </p>
        </div>
      </div>

      <div className="a-hero bare">
        <div className="a-caption">
          {cur != null && points[cur] ? shortDate(points[cur].date) : 'Price'}
        </div>
        <div className="a-value">{price != null ? chf(price, false, currency) : '—'}</div>
        {cur == null && dayPct != null && (
          <div className={`a-delta ${dayPct >= 0 ? 'gain' : 'loss'}`}>
            {pctStr(dayPct)} today
          </div>
        )}
      </div>

      {points.length >= 3 && (
        <DetailChart
          values={points.map((p) => p.close)}
          height={140}
          color="#0A84FF"
          dates={(i) => (points[i] ? shortDate(points[i].date) : '')}
          onScrub={setCur}
        />
      )}

      {lots.length > 0 && (
        <div className="a-possum">
          <div>
            <span>Value</span>
            <b>{chf(marketValue, false, currency)}</b>
          </div>
          <div>
            <span>Units</span>
            <b>{units ? units.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—'}</b>
          </div>
          <div>
            <span>Unrealized P&L</span>
            <b className={pnl >= 0 ? 'gain' : 'loss'}>{chf(pnl, true, currency)}</b>
          </div>
          <div>
            <span>Return</span>
            <b className={pnlPct == null ? '' : pnlPct >= 0 ? 'gain' : 'loss'}>
              {pnlPct == null ? '—' : pctStr(pnlPct)}
            </b>
          </div>
        </div>
      )}

      {lots.length > 1 && (
        <>
          <div className="a-header">Held in</div>
          <section className="a-gcard">
            {lots.map((h) => (
              <div key={`${h.symbol}-${h.accountId}`} className="a-arow">
                <span className="a-atext">
                  <b>{h.accountLabel || 'Account'}</b>
                </span>
                <span className="a-anum">
                  <b>{chf(h.marketValue, false, h.currency || currency)}</b>
                </span>
              </div>
            ))}
          </section>
        </>
      )}

      <Link
        to={`/holdings/${encodeURIComponent(symbol)}`}
        className="a-qlink"
        onClick={onClose}
      >
        Open full view
        <ArrowUpRight size={15} strokeWidth={2.5} />
      </Link>
    </>
  )
}

export function QuickLookProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<QuickLookTarget[]>([])

  const look = useCallback((target: QuickLookTarget) => {
    setStack((s) => [...s, target])
  }, [])
  const close = useCallback(() => setStack([]), [])
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), [])

  const top = stack[stack.length - 1]
  const value = useMemo(() => ({ look, close }), [look, close])

  return (
    <QuickLookContext.Provider value={value}>
      {children}
      <FloatSheet
        open={Boolean(top)}
        onClose={close}
        onBack={stack.length > 1 ? back : undefined}
        onEscape={back}
      >
        {top &&
          (top.kind === 'class' ? (
            <ClassLook id={top.id} onLook={look} onClose={close} />
          ) : top.kind === 'account' ? (
            <AccountLook id={top.id} onLook={look} onClose={close} />
          ) : (
            <HoldingLook symbol={top.symbol} onClose={close} />
          ))}
      </FloatSheet>
    </QuickLookContext.Provider>
  )
}
