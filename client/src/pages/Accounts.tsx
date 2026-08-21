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
  RefreshCw,
  Wallet,
  Building2,
  PenLine,
  ExternalLink,
  MoreHorizontal,
  Landmark,
  Home,
  Umbrella,
  CreditCard,
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
} from '@/hooks/useAccounts'
import {
  useSnaptradeConnections,
  useSnaptradeStatus,
} from '@/hooks/useSnaptrade'

import { accountClass, accountValue, isLiability } from '@/wealth/classifyAccount'
import { CLASSES } from '@/wealth/tokens'
import { isDemoId } from '@/wealth/demo'
import { LogoAvatar } from '@/wealth/logos'
import { FloatSheet } from '@/wealth/FloatSheet'

type AddStep =
  | 'chooser'
  | 'crypto'
  | 'manual'
  | 'broker'
  | 'cash'
  | 'pension'
  | 'estate'
  | 'loan'

/** One field treatment for every input on the route. */
const fieldClass =
  'w-full rounded-[14px] border-[0.5px] border-white/[0.07] bg-[rgba(118,118,128,0.18)] px-3.5 py-3 text-[15px] font-semibold text-white placeholder:text-white/30'

function typeLabel(a: Account): string {
  switch (a.type) {
    case 'crypto_wallet':
      return 'Crypto'
    case 'broker':
      return 'Broker'
    case 'bank':
      return 'Bank'
    case 'loan':
      return 'Loan'
    case 'pension':
      return 'Pension'
    case 'estate':
      return 'Property'
    case 'manual':
      return 'Manual'
  }
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

function CryptoForm({ onDone }: { onDone?: () => void }) {
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

function ManualForm({ onDone }: { onDone?: () => void }) {
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

function SimpleBalanceForm({
  kind,
  onDone,
}: {
  kind: 'cash' | 'pension' | 'estate' | 'loan'
  onDone?: () => void
}) {
  const add = useAddManualAccount()
  const [label, setLabel] = useState('')
  const [institution, setInstitution] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [currency, setCurrency] = useState('USD')

  const copy = {
    cash: {
      title: 'Cash account',
      name: 'UBS · Checking',
      inst: 'UBS',
      amount: 'Current balance',
      notes: 'Last four digits · optional',
    },
    pension: {
      title: 'Pension',
      name: 'VIAC · Pillar 3a',
      inst: 'VIAC',
      amount: 'Current value',
      notes: 'Strategy · optional',
    },
    estate: {
      title: 'Property',
      name: 'Apartment · Carouge',
      inst: 'Home',
      amount: 'Estimated value',
      notes: 'Address or notes · optional',
    },
    loan: {
      title: 'Loan',
      name: 'UBS Hypothèque',
      inst: 'UBS',
      amount: 'Outstanding balance',
      notes: 'Rate and term · optional',
    },
  }[kind]

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = parseFloat(amount)
    if (!label.trim() || !Number.isFinite(n) || n < 0) return
    add.mutate(
      {
        label: label.trim(),
        institution: institution.trim() || undefined,
        notes: notes.trim() || undefined,
        currency,
        balance: n,
        type:
          kind === 'cash'
            ? 'bank'
            : kind === 'loan'
              ? 'loan'
              : kind === 'pension'
                ? 'pension'
                : 'estate',
        kind: kind === 'loan' ? 'liability' : 'asset',
        bookClass:
          kind === 'cash'
            ? 'cash'
            : kind === 'pension'
              ? 'pension'
              : kind === 'estate'
                ? 'estate'
                : undefined,
      },
      { onSuccess: () => onDone?.() },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label={copy.title}>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="simple-label">
          Name
        </label>
        <input
          id="simple-label"
          required
          placeholder={copy.name}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="simple-inst">
          Institution
        </label>
        <input
          id="simple-inst"
          placeholder={copy.inst}
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="simple-amt">
            {copy.amount}
          </label>
          <input
            id="simple-amt"
            required
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="simple-ccy">
            Ccy
          </label>
          <select
            id="simple-ccy"
            className={fieldClass}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="USD">USD</option>
            <option value="CHF">CHF</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="simple-notes">
          Notes
        </label>
        <input
          id="simple-notes"
          placeholder={copy.notes}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={fieldClass}
        />
      </div>
      {add.isError && <FormError error={add.error} fallback="Could not save this account." />}
      <Button type="submit" className="h-11 w-full" disabled={!label.trim() || add.isPending}>
        {add.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <ArrowRight className="mr-2 h-4 w-4" aria-hidden />
        )}
        Save {copy.title.toLowerCase()}
      </Button>
    </form>
  )
}

function AddFlow({
  step,
  onPick,
  onBack,
  onDone,
}: {
  step: AddStep
  onPick: (step: Exclude<AddStep, 'chooser'>) => void
  onBack: () => void
  onDone?: () => void
}) {
  if (step === 'crypto') return <CryptoForm onDone={onDone} />
  if (step === 'manual') return <ManualForm onDone={onDone} />
  if (step === 'broker') return <BrokerForm onDone={onDone} onBack={onBack} />
  if (step === 'cash' || step === 'pension' || step === 'estate' || step === 'loan') {
    return <SimpleBalanceForm kind={step} onDone={onDone} />
  }
  return <AddChooser onPick={onPick} />
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

      <p className="a-qlead">
        Import accounts already linked to your SnapTrade Personal key,
        read-only. Best for US, CA, UK, and EU brokers — use a manual account
        for unsupported Swiss banks.
      </p>

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

  interface AddOption {
    id: Exclude<AddStep, 'chooser'>
    title: string
    subtitle: string
    icon: typeof Wallet
    color: string
    badge?: string
    badgeTone?: 'gain' | 'warn'
  }

  const live: AddOption[] = [
    {
      id: 'broker',
      title: 'Brokerage',
      subtitle: snapConfigured
        ? 'Import accounts already connected in SnapTrade'
        : 'SnapTrade — needs API keys first',
      icon: Building2,
      color: '#FFD84D',
      badge: snapConfigured ? 'Ready' : 'Needs keys',
      badgeTone: snapConfigured ? 'gain' : 'warn',
    },
    {
      id: 'crypto',
      title: 'Crypto wallet',
      subtitle: 'Hyperliquid perps and spot, via recovery phrase',
      icon: Wallet,
      color: '#A57BFF',
    },
  ]

  const byHand: AddOption[] = [
    {
      id: 'cash',
      title: 'Cash',
      subtitle: 'Checking, savings, or a wallet of cash',
      icon: Landmark,
      color: '#4BD57E',
    },
    {
      id: 'pension',
      title: 'Pension',
      subtitle: 'Pillar 2, 3a, or any retirement account',
      icon: Umbrella,
      color: '#FF9F45',
    },
    {
      id: 'estate',
      title: 'Real estate',
      subtitle: 'A home or property at estimated value',
      icon: Home,
      color: '#FF5C48',
    },
    {
      id: 'loan',
      title: 'Loan or mortgage',
      subtitle: 'What you owe — subtracted from net worth',
      icon: CreditCard,
      color: '#8E8E93',
    },
    {
      id: 'manual',
      title: 'Holdings by hand',
      subtitle: 'Tickers, quantities, and prices you enter yourself',
      icon: PenLine,
      color: '#3ABEFF',
    },
  ]

  const row = (opt: AddOption) => (
    <button
      key={opt.id}
      type="button"
      onClick={() => onPick(opt.id)}
      className="a-arow tap"
    >
      <span
        className="a-av"
        style={{ background: `${opt.color}22`, color: opt.color }}
      >
        <opt.icon size={16} strokeWidth={2.2} aria-hidden />
      </span>
      <span className="a-atext">
        <b>{opt.title}</b>
        <em>{opt.subtitle}</em>
      </span>
      {opt.badge && (
        <span className={`ui-tag ${opt.badgeTone ?? 'flat'}`}>{opt.badge}</span>
      )}
      <ArrowRight size={15} strokeWidth={2.5} className="a-rowchev" aria-hidden />
    </button>
  )

  return (
    <>
      <p className="a-qlead">
        Everything lands on the same book — synced accounts refresh themselves,
        manual ones you update when things change.
      </p>
      <div className="a-header">Syncs itself</div>
      <section className="a-gcard">{live.map(row)}</section>
      <div className="a-header">Tracked by hand</div>
      <section className="a-gcard">{byHand.map(row)}</section>
    </>
  )
}

/* ---------- Account row ---------- */

const menuItemClass =
  'flex w-full cursor-pointer items-center gap-2 rounded-[12px] px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-white/10'

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
  const demo = isDemoId(account.id)
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
    <li className="flex items-center gap-3 border-b border-border/50 px-1.5 py-2.5 last:border-0">
      <LogoAvatar
        institution={account.institution}
        name={account.label}
        color="#AEAEB2"
      />

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
          <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <span className="truncate">{account.label}</span>
            {demo && <span className="a-tag cycle shrink-0">Sample</span>}
          </p>
        )}

        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusTone)}
          />
          <span className="truncate">
            {[typeLabel(account), institution].filter(Boolean).join(' · ')}
            {idDisplay && <span className="num"> · {idDisplay}</span>}
            {' · '}
            {demo
              ? 'Sample book'
              : failed
                ? account.lastError || 'Needs attention'
                : syncedNote}
          </span>
          {!demo && failed && (
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
          value={isLiability(account) ? -account.totalValueUsd : account.totalValueUsd}
          className="shrink-0 text-sm font-medium"
        />
      )}

      {demo ? null : confirming ? (
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
                className="surface z-50 min-w-[10rem] rounded-[16px] p-1.5"
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
  const assets = accounts.filter((a) => !isLiability(a))
  const loans = accounts.filter(isLiability)

  return (
    <div className="a-holdings-cols">
      {CLASSES.map((c) => {
        const items = assets.filter((a) => accountClass(a) === c.id)
        if (!items.length) return null
        const subtotal = items.reduce((s, a) => s + accountValue(a), 0)
        const headingId = `class-${c.id}`
        return (
          <section key={c.id} className="a-gcard" aria-labelledby={headingId}>
            <div className="flex items-center justify-between gap-3 px-3.5 pt-3.5 pb-1.5">
              <h3 id={headingId} className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: c.color }}
                  aria-hidden
                />
                {c.name}
                <span className="text-xs font-semibold text-white/40">
                  {items.length === 1 ? '1 account' : `${items.length} accounts`}
                </span>
              </h3>
              <span className="num text-[13px] font-bold">
                {formatCurrency(subtotal, { compact: true })}
              </span>
            </div>
            <ul className="a-arows list-none p-0">
              {items.map((a) => (
                <AccountRow key={a.id} account={a} />
              ))}
            </ul>
          </section>
        )
      })}
      {loans.length > 0 && (
        <section className="a-gcard" aria-labelledby="class-loans">
          <div className="flex items-center justify-between gap-3 px-3.5 pt-3.5 pb-1.5">
            <h3 id="class-loans" className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
              <span
                className="a-tiledot hatch h-2.5 w-2.5 shrink-0"
                aria-hidden
              />
              Loans
              <span className="text-xs font-semibold text-white/40">
                {loans.length === 1 ? '1 account' : `${loans.length} accounts`}
              </span>
            </h3>
            <span className="num text-[13px] font-bold text-[#FF453A]">
              −{formatCurrency(
                loans.reduce((s, a) => s + accountValue(a), 0),
                { compact: true },
              )}
            </span>
          </div>
          <ul className="a-arows list-none p-0">
            {loans.map((a) => (
              <AccountRow key={a.id} account={a} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/* ---------- Page ---------- */

const STEP_TITLES: Record<AddStep, string> = {
  chooser: 'Add an account',
  crypto: 'Crypto wallet',
  broker: 'Brokerage',
  manual: 'Holdings by hand',
  cash: 'Cash account',
  pension: 'Pension',
  estate: 'Real estate',
  loan: 'Loan or mortgage',
}

export function Accounts() {
  const { data: accounts, isLoading } = useAccounts()
  const [step, setStep] = useState<AddStep | null>(null)
  const navigate = useNavigate()
  const hasAccounts = Boolean(accounts && accounts.length > 0)

  useEffect(() => {
    document.title = hasAccounts ? 'Accounts' : 'Connect'
  }, [hasAccounts])

  function handleAdded() {
    setStep(null)
    if (!hasAccounts) navigate('/')
  }

  return (
    <article>
      {isLoading ? (
        <>
          <p role="status" aria-live="polite" className="sr-only">
            Loading accounts
          </p>
          <SkeletonRows rows={3} />
        </>
      ) : hasAccounts ? (
        <>
          <div className="a-pagebar">
            <div className="a-header">Connected accounts</div>
            <button
              type="button"
              className="ui-btn tinted sm"
              onClick={() => setStep('chooser')}
            >
              <Plus size={15} strokeWidth={2.5} />
              Add account
            </button>
          </div>

          <section aria-labelledby="connected-accounts-heading">
            <h2 id="connected-accounts-heading" className="sr-only">
              Connected accounts
            </h2>
            <AccountGroups accounts={accounts!} />
          </section>

          <p className="a-footnote">
            Secrets stay on the server. Recovery phrases are encrypted at rest.
          </p>
        </>
      ) : (
        /* ---- First run: one focused task, no dashboard chrome ---- */
        <>
          <div className="ui-empty">
            <div className="ui-empty-icon">
              <Wallet className="h-5 w-5" />
            </div>
            <b>One picture of everything you own and owe</b>
            <p>Cash, brokers, crypto, pension, property, and loans on a single book.</p>
          </div>

          <button type="button" className="a-add" onClick={() => setStep('chooser')}>
            <Plus size={17} strokeWidth={2.5} />
            Add your first account
          </button>

          <p className="a-footnote">
            Secrets stay on the server. Recovery phrases are encrypted at rest.
          </p>
        </>
      )}

      <FloatSheet
        open={step !== null}
        title={step ? STEP_TITLES[step] : undefined}
        onClose={() => setStep(null)}
        onBack={step && step !== 'chooser' ? () => setStep('chooser') : undefined}
        onEscape={
          step && step !== 'chooser' ? () => setStep('chooser') : () => setStep(null)
        }
      >
        {step && (
          <AddFlow
            step={step}
            onPick={setStep}
            onBack={() => setStep('chooser')}
            onDone={handleAdded}
          />
        )}
      </FloatSheet>
    </article>
  )
}
