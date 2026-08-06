import * as React from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Wallet,
  Building2,
  PenLine,
  ExternalLink,
  MoreHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Amount } from '@/components/ui/Amount'
import { Banner, SkeletonRows } from '@/components/ui/states'
import { cn, shortenAddress, relativeTime, formatCurrency } from '@/lib/utils'
import {
  useAccounts,
  useAddCryptoAccount,
  useAddManualAccount,
  useDeleteAccount,
  useRenameAccount,
  useProviders,
  useSnaptradeConnect,
  useSnaptradeImport,
  useSyncAccount,
  Account,
  Holding,
  ProviderId,
} from '@/hooks/useAccounts'
import {
  useSnaptradeConnections,
  useSnaptradeStatus,
} from '@/hooks/useSnaptrade'

type AddStep = 'chooser' | 'crypto' | 'manual' | 'broker'

/** One field treatment for every input on the route. */
const fieldClass =
  'w-full rounded-md border border-input bg-background/70 px-3 py-2.5 text-sm placeholder:text-muted-foreground/70 transition-colors hover:border-border focus:border-primary/50'

function providerLabel(p: ProviderId): string {
  switch (p) {
    case 'hyperliquid':
      return 'Hyperliquid'
    case 'snaptrade':
      return 'SnapTrade'
    case 'manual':
      return 'Manual'
  }
}

function typeLabel(a: Account): string {
  switch (a.type) {
    case 'crypto_wallet':
      return 'Crypto'
    case 'broker':
      return 'Broker'
    case 'bank':
      return 'Bank'
    case 'manual':
      return 'Manual'
  }
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      Back
    </button>
  )
}

function FormError({ error, fallback }: { error: unknown; fallback: string }) {
  const message =
    (error as { response?: { data?: { message?: string; error?: string } } })
      ?.response?.data?.message ||
    (error as { response?: { data?: { error?: string } } })?.response?.data
      ?.error ||
    fallback
  return <Banner tone="error">{message}</Banner>
}

/* ---------- Add forms ---------- */

function CryptoForm({ onDone, onBack }: { onDone?: () => void; onBack: () => void }) {
  const [label, setLabel] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [showMnemonic, setShowMnemonic] = useState(false)
  const addAccount = useAddCryptoAccount()
  const wordCount = mnemonic.trim().split(/\s+/).filter(Boolean).length
  const validCount = wordCount === 12 || wordCount === 24

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    addAccount.mutate(
      { label: label.trim() || 'Hyperliquid', mnemonic: mnemonic.trim() },
      { onSuccess: () => onDone?.() },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Add crypto wallet">
      <BackLink onClick={onBack} />

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="acct-label">
          Account name
        </label>
        <input
          id="acct-label"
          type="text"
          placeholder="Main · Trading · Fund"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-sm font-medium" htmlFor="acct-mnemonic">
            Recovery phrase
          </label>
          <span
            className={cn(
              'num text-xs',
              validCount ? 'text-gain' : 'text-muted-foreground',
            )}
          >
            {wordCount > 0 ? `${wordCount} / 12 or 24 words` : '12 or 24 words'}
          </span>
        </div>
        <div className="relative">
          <textarea
            id="acct-mnemonic"
            rows={3}
            placeholder="word1 word2 word3 …"
            value={mnemonic}
            onChange={(e) => {
              setMnemonic(e.target.value)
              addAccount.reset()
            }}
            className={cn(
              fieldClass,
              'resize-none pr-10',
              addAccount.isError && 'border-destructive',
            )}
            style={
              showMnemonic
                ? {}
                : ({ WebkitTextSecurity: 'disc' } as React.CSSProperties)
            }
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setShowMnemonic((v) => !v)}
            className="absolute right-2.5 top-2.5 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={showMnemonic ? 'Hide recovery phrase' : 'Show recovery phrase'}
          >
            {showMnemonic ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {addAccount.isError && (
        <FormError error={addAccount.error} fallback="Failed to add account." />
      )}

      <Button
        type="submit"
        className="h-11 w-full"
        disabled={wordCount < 12 || addAccount.isPending}
      >
        {addAccount.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <ArrowRight className="mr-2 h-4 w-4" aria-hidden />
        )}
        {addAccount.isPending ? 'Connecting…' : 'Add Hyperliquid wallet'}
      </Button>
    </form>
  )
}

function ManualForm({ onDone, onBack }: { onDone?: () => void; onBack: () => void }) {
  const [label, setLabel] = useState('')
  const [institution, setInstitution] = useState('')
  const [symbol, setSymbol] = useState('')
  const [quantity, setQuantity] = useState('')
  const [priceUsd, setPriceUsd] = useState('')
  const [holdings, setHoldings] = useState<Holding[]>([])
  const addManual = useAddManualAccount()

  const rowReady =
    Boolean(symbol.trim()) &&
    Number.isFinite(parseFloat(quantity)) &&
    Number.isFinite(parseFloat(priceUsd))

  function addHoldingRow() {
    const sym = symbol.trim().toUpperCase()
    const qty = parseFloat(quantity)
    const px = parseFloat(priceUsd)
    if (!sym || !Number.isFinite(qty) || !Number.isFinite(px)) return
    setHoldings((h) => [
      ...h,
      {
        symbol: sym,
        quantity: qty,
        priceUsd: px,
        assetClass:
          sym === 'USD' || sym === 'CHF' || sym === 'EUR' ? 'cash' : 'equity',
      },
    ])
    setSymbol('')
    setQuantity('')
    setPriceUsd('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    addManual.mutate(
      {
        label: label.trim(),
        institution: institution.trim() || undefined,
        type: 'manual',
        holdings,
      },
      { onSuccess: () => onDone?.() },
    )
  }

  const previewTotal = holdings.reduce((s, h) => s + h.quantity * h.priceUsd, 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Add manual account">
      <BackLink onClick={onBack} />

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="manual-label">
            Account name
          </label>
          <input
            id="manual-label"
            required
            placeholder="IBKR · UBS · Pension"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="manual-inst">
            Institution{' '}
            <span className="font-normal text-muted-foreground">optional</span>
          </label>
          <input
            id="manual-inst"
            placeholder="Interactive Brokers"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>

      <fieldset className="space-y-3 border-t border-border/60 pt-4">
        <legend className="sr-only">Holdings</legend>
        <div>
          <p className="text-sm font-medium">Holdings</p>
          <p className="t-meta mt-0.5">
            Symbol, quantity, and USD price. You can edit these later.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input
            aria-label="Symbol"
            placeholder="AAPL"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className={cn(fieldClass, 'px-2.5 py-2')}
          />
          <input
            aria-label="Quantity"
            placeholder="Qty"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={cn(fieldClass, 'num px-2.5 py-2')}
          />
          <input
            aria-label="Price in USD"
            placeholder="Price"
            inputMode="decimal"
            value={priceUsd}
            onChange={(e) => setPriceUsd(e.target.value)}
            className={cn(fieldClass, 'num px-2.5 py-2')}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addHoldingRow}
          disabled={!rowReady}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Add holding
        </Button>

        {holdings.length > 0 && (
          <ul className="list-none divide-y divide-border/60 border-y border-border/60 p-0">
            {holdings.map((h, i) => (
              <li
                key={`${h.symbol}-${i}`}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{h.symbol}</span>{' '}
                  <span className="num text-muted-foreground">× {h.quantity}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Amount value={h.quantity * h.priceUsd} className="text-sm" />
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={`Remove ${h.symbol}`}
                    onClick={() =>
                      setHoldings((rows) => rows.filter((_, j) => j !== i))
                    }
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              </li>
            ))}
            <li className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <span className="t-eyebrow">Total</span>
              <Amount value={previewTotal} className="text-sm font-semibold" />
            </li>
          </ul>
        )}
      </fieldset>

      {addManual.isError && (
        <FormError error={addManual.error} fallback="Failed to add account." />
      )}

      <Button
        type="submit"
        className="h-11 w-full"
        disabled={!label.trim() || addManual.isPending}
      >
        {addManual.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <ArrowRight className="mr-2 h-4 w-4" aria-hidden />
        )}
        Save manual account
      </Button>
    </form>
  )
}

function BrokerForm({ onDone, onBack }: { onDone?: () => void; onBack: () => void }) {
  const { data: providers } = useProviders()
  const snap = providers?.find((p) => p.id === 'snaptrade')
  const connect = useSnaptradeConnect()
  const importAccts = useSnaptradeImport()
  const status = useSnaptradeStatus()
  const connections = useSnaptradeConnections(Boolean(snap?.configured))

  const disabledCount =
    status.data?.disabledConnectionCount ??
    connections.data?.connections.filter((c) => c.disabled).length ??
    0
  const remoteCount = status.data?.accountCount
  const connectionCount =
    status.data?.connectionCount ?? connections.data?.connections.length ?? 0

  return (
    <div className="space-y-5" aria-label="Import brokerage">
      <BackLink onClick={onBack} />

      <div>
        <h2 className="font-display text-lg tracking-tight">
          Brokerage via SnapTrade
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Import accounts already linked to your SnapTrade Personal key,
          read-only. Best for US, CA, UK, and EU brokers — use a manual account
          for unsupported Swiss banks.
        </p>
      </div>

      {!snap?.configured ? (
        <div className="space-y-2.5 rounded-md border border-border/70 bg-secondary/40 px-4 py-3.5 text-sm">
          <p className="font-semibold">API keys required</p>
          <p className="text-muted-foreground">
            Create a free Personal key at{' '}
            <a
              href="https://dashboard.snaptrade.com/api-key"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              dashboard.snaptrade.com
            </a>
            , then set these in <code className="num text-xs">.env</code>:
          </p>
          <pre className="num overflow-x-auto rounded-md border border-border/60 bg-background/70 p-3 text-xs">
{`SNAPTRADE_CLIENT_ID=…
SNAPTRADE_CONSUMER_KEY=…`}
          </pre>
          <p className="text-muted-foreground">
            Restart the server after saving. Until then, track any broker as a{' '}
            <button
              type="button"
              className="font-medium text-primary underline underline-offset-2"
              onClick={onBack}
            >
              manual account
            </button>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {typeof remoteCount === 'number' && (
            <p className="t-meta">
              SnapTrade reports{' '}
              <span className="num text-foreground">{remoteCount}</span> account
              {remoteCount === 1 ? '' : 's'}
              {connectionCount > 0
                ? ` across ${connectionCount} connection${connectionCount === 1 ? '' : 's'}`
                : ''}
              .
            </p>
          )}

          {disabledCount > 0 && (
            <Banner tone="warn">
              {disabledCount} connection{disabledCount === 1 ? ' is' : 's are'}{' '}
              disabled. Use “Add or repair” below, then import again.
            </Banner>
          )}

          {connectionCount === 0 && !status.isLoading && (
            <Banner tone="info">
              No connections found. Add a brokerage via the portal, or confirm
              accounts in the SnapTrade dashboard.
            </Banner>
          )}

          <Button
            className="h-11 w-full"
            disabled={importAccts.isPending}
            onClick={() =>
              importAccts.mutate(undefined, {
                onSuccess: (data) => {
                  if ((data.imported?.length ?? 0) > 0) onDone?.()
                },
              })
            }
          >
            {importAccts.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            )}
            Import connected accounts
          </Button>

          <Button
            variant="outline"
            className="w-full"
            disabled={connect.isPending}
            onClick={() =>
              connect.mutate(undefined, {
                onSuccess: (data) => {
                  if (data.redirectUrl)
                    window.open(data.redirectUrl, '_blank', 'noopener')
                },
              })
            }
          >
            {connect.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
            )}
            Add or repair brokerage
          </Button>

          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link to="/brokerage">
              Open brokerage dashboard
              <ArrowRight className="ml-2 h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>

          {(connect.isError || importAccts.isError) && (
            <FormError
              error={connect.error || importAccts.error}
              fallback="SnapTrade request failed."
            />
          )}

          {(connect.data?.message || importAccts.data?.message) && (
            <p className="t-meta" role="status">
              {importAccts.data?.message || connect.data?.message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function AddChooser({
  onPick,
}: {
  onPick: (step: Exclude<AddStep, 'chooser'>) => void
}) {
  const { data: providers } = useProviders()
  const snapConfigured = providers?.find((p) => p.id === 'snaptrade')?.configured

  const options: Array<{
    id: Exclude<AddStep, 'chooser'>
    title: string
    subtitle: string
    icon: typeof Wallet
    badge?: string
  }> = [
    {
      id: 'crypto',
      title: 'Crypto wallet',
      subtitle: 'Hyperliquid perps and spot, via recovery phrase',
      icon: Wallet,
    },
    {
      id: 'broker',
      title: 'Brokerage',
      subtitle: snapConfigured
        ? 'Import accounts already connected in SnapTrade'
        : 'SnapTrade — needs API keys',
      icon: Building2,
      badge: snapConfigured ? 'Ready' : 'Needs keys',
    },
    {
      id: 'manual',
      title: 'Manual account',
      subtitle: 'Any bank or broker — enter cash and holdings yourself',
      icon: PenLine,
    },
  ]

  return (
    <ul className="list-none space-y-2 p-0">
      {options.map((opt) => (
        <li key={opt.id}>
          <button
            type="button"
            onClick={() => onPick(opt.id)}
            className="group flex w-full items-center gap-3 rounded-md border border-border/70 px-3.5 py-3.5 text-left transition-colors hover:border-primary/45 hover:bg-accent/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/[0.09] text-primary">
              <opt.icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold">{opt.title}</span>
                {opt.badge && (
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                      snapConfigured || opt.id !== 'broker'
                        ? 'chip-gain'
                        : 'chip-warn',
                    )}
                  >
                    {opt.badge}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                {opt.subtitle}
              </span>
            </span>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          </button>
        </li>
      ))}
    </ul>
  )
}

/* ---------- Account row ---------- */

const menuItemClass =
  'flex w-full cursor-pointer items-center gap-2 rounded-[5px] px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent/70'

function AccountRow({ account }: { account: Account }) {
  const [editing, setEditing] = useState(false)
  const [newLabel, setNewLabel] = useState(account.label)
  const [confirming, setConfirming] = useState(false)
  const rename = useRenameAccount()
  const remove = useDeleteAccount()
  const sync = useSyncAccount()

  // Identifier is optional; the group header already names the provider, so
  // don't pad the row out with a repeat of it.
  const idDisplay =
    account.maskedIdentifier ||
    (account.externalId?.startsWith('0x')
      ? shortenAddress(account.externalId, 4)
      : account.externalId) ||
    null
  const institution =
    account.institution && account.institution !== typeLabel(account)
      ? account.institution
      : null
  const failed = account.status === 'error' || Boolean(account.lastError)

  const statusTone =
    account.status === 'connected'
      ? 'bg-gain'
      : account.status === 'error'
        ? 'bg-destructive'
        : 'bg-warn'

  function handleRename() {
    if (!newLabel.trim()) return
    rename.mutate(
      { id: account.id, label: newLabel.trim() },
      { onSuccess: () => setEditing(false) },
    )
  }

  const syncedNote = account.lastSyncedAt
    ? `Synced ${relativeTime(account.lastSyncedAt)}`
    : account.provider === 'hyperliquid'
      ? account.live
        ? 'Live'
        : 'Offline'
      : 'Not synced yet'

  return (
    <li className="flex items-center gap-3 border-b border-border/50 py-3 last:border-0">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink/[0.05] font-display text-xs text-foreground/70"
      >
        {account.label.slice(0, 2).toUpperCase()}
      </span>

      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') {
                  setEditing(false)
                  setNewLabel(account.label)
                }
              }}
              className={cn(fieldClass, 'h-8 max-w-[14rem] px-2 py-0')}
              aria-label={`Rename ${account.label}`}
            />
            <button
              onClick={handleRename}
              className="rounded p-1 text-gain"
              type="button"
              aria-label="Save name"
            >
              <Check className="h-4 w-4" aria-hidden />
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setNewLabel(account.label)
              }}
              className="rounded p-1 text-muted-foreground"
              type="button"
              aria-label="Cancel rename"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : (
          <p className="truncate text-sm font-semibold">{account.label}</p>
        )}

        <p className="truncate text-xs text-muted-foreground">
          {[typeLabel(account), institution].filter(Boolean).join(' · ')}
          {idDisplay && <span className="num"> · {idDisplay}</span>}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/90">
          <span
            aria-hidden
            className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusTone)}
          />
          <span className="truncate">
            {failed ? account.lastError || 'Needs attention' : syncedNote}
          </span>
          {failed && (
            <Link
              to="/brokerage"
              className="shrink-0 font-semibold text-primary underline-offset-2 hover:underline"
            >
              Repair
            </Link>
          )}
        </p>
      </div>

      {account.totalValueUsd != null && (
        <Amount
          value={account.totalValueUsd}
          className="shrink-0 text-sm font-medium"
        />
      )}

      {confirming ? (
        <div className="animate-fade-in flex shrink-0 items-center gap-1.5">
          <span className="text-xs font-medium text-destructive">Disconnect?</span>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 px-2"
            onClick={() =>
              remove.mutate(account.id, { onSuccess: () => setConfirming(false) })
            }
            disabled={remove.isPending}
          >
            {remove.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              'Yes'
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => setConfirming(false)}
          >
            No
          </Button>
        </div>
      ) : (
        !editing && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground data-[state=open]:bg-accent/70"
              aria-label={`Actions for ${account.label}`}
            >
              {sync.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              )}
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="surface z-50 min-w-[10rem] rounded-md p-1"
              >
                <DropdownMenu.Item
                  className={menuItemClass}
                  onSelect={() => sync.mutate(account.id)}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Sync now
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={menuItemClass}
                  onSelect={() => setEditing(true)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Rename
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-border/70" />
                <DropdownMenu.Item
                  className={cn(menuItemClass, 'text-destructive')}
                  onSelect={() => setConfirming(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Disconnect
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )
      )}
    </li>
  )
}

/**
 * Accounts grouped by the provider that supplies them, each group carrying
 * its own subtotal — the shape Origin and Rocket Money use for linked
 * institutions.
 */
function AccountGroups({ accounts }: { accounts: Account[] }) {
  const order: ProviderId[] = ['snaptrade', 'hyperliquid', 'manual']
  const groups = order
    .map((provider) => ({
      provider,
      items: accounts.filter((a) => a.provider === provider),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="space-y-8">
      {groups.map(({ provider, items }) => {
        const subtotal = items.reduce((s, a) => s + (a.totalValueUsd ?? 0), 0)
        const anyValued = items.some((a) => a.totalValueUsd != null)
        const headingId = `provider-${provider}`
        return (
          <section key={provider} aria-labelledby={headingId}>
            {/* Trailing gutter matches the row action button so the group
             * subtotal lands in the same column as each row's value. */}
            <div className="flex items-baseline justify-between gap-3 border-b border-border/70 pb-2 pr-[2.1rem]">
              <h3 id={headingId} className="t-eyebrow">
                {providerLabel(provider)}
                <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/70">
                  {items.length} {items.length === 1 ? 'account' : 'accounts'}
                </span>
              </h3>
              {anyValued && (
                <span className="num text-xs font-medium">
                  {formatCurrency(subtotal, { compact: true })}
                </span>
              )}
            </div>
            <ul className="list-none p-0">
              {items.map((a) => (
                <AccountRow key={a.id} account={a} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/* ---------- Page ---------- */

export function Accounts() {
  const { data: accounts, isLoading } = useAccounts()
  const [step, setStep] = useState<AddStep | null>(null)
  const navigate = useNavigate()
  const hasAccounts = Boolean(accounts && accounts.length > 0)

  useEffect(() => {
    document.title = hasAccounts ? 'Accounts — Meridian' : 'Connect — Meridian'
  }, [hasAccounts])

  // With nothing connected the chooser *is* the page; otherwise it's opt-in.
  useEffect(() => {
    if (!isLoading && !hasAccounts && step === null) setStep('chooser')
  }, [isLoading, hasAccounts, step])

  function handleAdded() {
    setStep(null)
    if (!hasAccounts) navigate('/')
  }

  const providerCount = new Set(accounts?.map((a) => a.provider)).size

  /* ---- First run: a single focused task, no dashboard chrome ---- */
  if (!isLoading && !hasAccounts) {
    return (
      <article className="px-5 py-12 sm:px-8 sm:py-20">
        <div className="measure-narrow">
          <header className="animate-rise mb-9 text-center">
            <p className="t-eyebrow mb-4">Set up Meridian</p>
            <h1 className="font-display text-balance text-[clamp(2rem,8vw,2.75rem)] leading-[1.05] tracking-tight">
              One ledger for everything you own
            </h1>
            <p className="mx-auto mt-4 max-w-md text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground">
              Bring brokers, banks, and crypto into a single portfolio. Start
              with Hyperliquid, a manual account, or SnapTrade.
            </p>
          </header>

          <div className="surface animate-rise stagger-2 rounded-lg p-5 sm:p-6">
            <h2 id="add-account-heading" className="sr-only">
              Choose an account type
            </h2>
            {step === 'crypto' ? (
              <CryptoForm onDone={handleAdded} onBack={() => setStep('chooser')} />
            ) : step === 'manual' ? (
              <ManualForm onDone={handleAdded} onBack={() => setStep('chooser')} />
            ) : step === 'broker' ? (
              <BrokerForm onDone={handleAdded} onBack={() => setStep('chooser')} />
            ) : (
              <AddChooser onPick={setStep} />
            )}
          </div>

          <p className="animate-fade-in stagger-4 t-meta mx-auto mt-6 max-w-sm text-pretty text-center">
            Secrets stay on the server. Recovery phrases are encrypted at rest;
            SnapTrade keys never leave <code className="num">.env</code>.
          </p>
        </div>
      </article>
    )
  }

  /* ---- Managing existing accounts ---- */
  return (
    <article className="measure px-5 py-9 sm:px-8 sm:py-14">
      {/* Header shares the list's measure so the action lines up with the
       * value column rather than floating out at the page edge. */}
      <header
        className={cn(
          'animate-rise mb-8 flex flex-wrap items-end justify-between gap-4',
          step === null && 'max-w-3xl',
        )}
      >
        <div>
          <p className="t-eyebrow mb-2.5">Connections</p>
          <h1 className="font-display text-[clamp(1.75rem,6vw,2.25rem)] tracking-tight">
            Accounts
          </h1>
          {!isLoading && (
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="num text-foreground">{accounts!.length}</span>{' '}
              connected across {providerCount}{' '}
              {providerCount === 1 ? 'provider' : 'providers'}
            </p>
          )}
        </div>

        {step === null && (
          <Button onClick={() => setStep('chooser')}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add account
          </Button>
        )}
      </header>

      {isLoading ? (
        <>
          <p role="status" aria-live="polite" className="sr-only">
            Loading accounts
          </p>
          <SkeletonRows rows={3} />
        </>
      ) : (
        <>
          {/* Two columns only while adding: the list keeps the full measure
           * the rest of the time rather than carrying filler beside it. */}
          <div
            className={cn(
              'grid items-start gap-10',
              step !== null && 'lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-14',
            )}
          >
            <section aria-labelledby="connected-accounts-heading" className="max-w-3xl">
              <h2 id="connected-accounts-heading" className="sr-only">
                Connected accounts
              </h2>
              <AccountGroups accounts={accounts!} />
            </section>

            {/* The add flow is the one interactive card on the page. */}
            {step !== null && (
              <div className="surface animate-rise rounded-lg p-5 lg:sticky lg:top-20">
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <h2 id="add-account-heading" className="font-display text-base">
                    Add an account
                  </h2>
                  <button
                    type="button"
                    onClick={() => setStep(null)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Close add account panel"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                {step === 'crypto' ? (
                  <CryptoForm onDone={handleAdded} onBack={() => setStep('chooser')} />
                ) : step === 'manual' ? (
                  <ManualForm onDone={handleAdded} onBack={() => setStep('chooser')} />
                ) : step === 'broker' ? (
                  <BrokerForm onDone={handleAdded} onBack={() => setStep('chooser')} />
                ) : (
                  <AddChooser onPick={setStep} />
                )}
              </div>
            )}
          </div>

          <p className="t-meta mt-10 max-w-3xl">
            Secrets stay on the server. Recovery phrases are encrypted at rest;
            SnapTrade keys never leave <code className="num">.env</code>.
          </p>
        </>
      )}
    </article>
  )
}
