import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DetailList,
  DisclosureRow,
  SectionHead,
  SortHeader,
  type SortDirection,
} from '@/components/ui/data'
import { Amount } from '@/components/ui/Amount'
import { EmptyState } from '@/components/ui/states'
import {
  formatAmount,
  formatCurrency,
  chartColor,
  cn,
  providerName,
} from '@/lib/utils'

interface Asset {
  asset: string
  amount: string
  usdValue: string
  chain: string
  accountLabel?: string
  provider?: string
}

interface AssetsListProps {
  assets: Asset[]
}

type SortKey = 'value' | 'asset' | 'amount'

/**
 * Holdings as a real column grid: symbol on the left, right-aligned tabular
 * money, sortable headers, and rows that disclose their own breakdown.
 *
 * The header row and sortable columns follow Quicken's and Monarch's web
 * holdings tables; expanding a row in place into a key/value block is
 * Public's holding detail.
 */
export function AssetsList({ assets }: AssetsListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('value')
  const [direction, setDirection] = useState<SortDirection>('desc')

  const total = assets.reduce((s, a) => s + (parseFloat(a.usdValue) || 0), 0)

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setDirection((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setDirection(key === 'asset' ? 'asc' : 'desc')
    }
  }

  const sorted = [...assets].sort((a, b) => {
    const flip = direction === 'desc' ? 1 : -1
    if (sortKey === 'asset') {
      return a.asset.localeCompare(b.asset) * (direction === 'asc' ? 1 : -1)
    }
    const field = sortKey === 'value' ? 'usdValue' : 'amount'
    return ((parseFloat(b[field]) || 0) - (parseFloat(a[field]) || 0)) * flip
  })

  // Colour rank follows value order so a holding's swatch always matches
  // its segment in the composition rule.
  const rank = new Map(
    [...assets]
      .sort((a, b) => (parseFloat(b.usdValue) || 0) - (parseFloat(a.usdValue) || 0))
      .map((a, i) => [`${a.asset}-${a.chain}-${a.accountLabel ?? ''}`, i]),
  )

  return (
    <section aria-labelledby="holdings-heading">
      <SectionHead
        id="holdings-heading"
        title="Holdings"
        meta={
          assets.length === 0 ? (
            '—'
          ) : (
            <span className="num">
              {formatCurrency(total, { compact: true })} ·{' '}
              {assets.length}
            </span>
          )
        }
      />

      {assets.length === 0 ? (
        <div className="border-y border-border/60">
          <EmptyState
            glyph="holdings"
            title="No holdings yet"
            description="Balances from your connected brokerage, crypto, and manual accounts land here."
            action={
              <Link
                to="/accounts"
                className="inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                Connect an account
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* Column headers exist only where there's room to align to them. */}
          <div className="hidden border-b border-border/70 px-2 pb-2 sm:grid sm:grid-cols-[minmax(0,1fr)_5.5rem_8rem_7rem_1.25rem] sm:items-end sm:gap-3">
            <SortHeader
              column="asset"
              active={sortKey}
              direction={direction}
              onSort={handleSort}
              align="left"
            >
              Asset
            </SortHeader>
            <span className="t-eyebrow text-right">Share</span>
            <SortHeader
              column="amount"
              active={sortKey}
              direction={direction}
              onSort={handleSort}
            >
              Quantity
            </SortHeader>
            <SortHeader
              column="value"
              active={sortKey}
              direction={direction}
              onSort={handleSort}
            >
              Value
            </SortHeader>
            <span aria-hidden />
          </div>

          <ul className="list-none border-b border-border/70 p-0">
            {sorted.map((asset, index) => {
              const usd = parseFloat(asset.usdValue) || 0
              const share = total > 0 ? (usd / total) * 100 : 0
              const key = `${asset.asset}-${asset.chain}-${asset.accountLabel ?? ''}`
              const colorIndex = rank.get(key) ?? index
              const source = asset.accountLabel
                ? `${asset.accountLabel} · ${asset.chain}`
                : asset.chain

              return (
                <DisclosureRow
                  key={`${key}-${index}`}
                  label={asset.asset}
                  className="animate-rise"
                  summary={
                    <div className="sm:grid sm:grid-cols-[minmax(0,1fr)_5.5rem_8rem_7rem] sm:items-center sm:gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          aria-hidden
                          className="h-7 w-[3px] shrink-0 rounded-full"
                          style={{ background: chartColor(colorIndex) }}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {asset.asset}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {source}
                          </p>
                        </div>
                      </div>

                      <p className="num hidden text-right text-xs text-muted-foreground sm:block">
                        {share.toFixed(1)}%
                      </p>
                      <p className="num hidden text-right text-xs text-muted-foreground sm:block">
                        {formatAmount(asset.amount)}
                      </p>

                      {/* Mobile keeps value and quantity stacked on the right. */}
                      <div className="mt-1 flex items-baseline justify-between gap-3 sm:mt-0 sm:block sm:text-right">
                        <span className="num text-xs text-muted-foreground sm:hidden">
                          {formatAmount(asset.amount)} {asset.asset} ·{' '}
                          {share.toFixed(1)}%
                        </span>
                        <Amount value={usd} className="text-sm font-semibold" />
                      </div>
                    </div>
                  }
                  detail={
                    <DetailList
                      items={[
                        { label: 'Market value', value: formatCurrency(usd) },
                        {
                          label: 'Quantity',
                          value: `${formatAmount(asset.amount)} ${asset.asset}`,
                        },
                        {
                          label: 'Share of portfolio',
                          value: `${share.toFixed(2)}%`,
                        },
                        { label: 'Held in', value: asset.accountLabel || '—' },
                        { label: 'Source', value: asset.chain },
                        { label: 'Provider', value: providerName(asset.provider) },
                      ]}
                    />
                  }
                />
              )
            })}
          </ul>

          <div
            className={cn(
              'flex items-baseline justify-between gap-3 px-2 pt-2.5',
              'text-sm',
            )}
          >
            <span className="t-eyebrow">Total</span>
            <Amount value={total} className="text-sm font-semibold" />
          </div>
        </>
      )}
    </section>
  )
}
