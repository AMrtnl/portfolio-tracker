import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { Token, type ClassId } from '@/wh/Token'
import { Button, Field, RoundButton, StatusPill } from '@/wh/controls'
import { Card, Note, Row } from '@/wh/layout'
import { Menu } from '@/wh/Menu'
import { useFigures } from '@/wh/format'
import { useBook, type BookAccount } from '@/wh/model/book'
import { useDesktop } from '@/wh/useMediaQuery'
import { useAddManualAccount, useAddWatchWallet, useDeleteAccount, useProviders, useRenameAccount, useSnaptradeConnect, useSnaptradeImport, useSyncAccount, type Account, type Holding } from '@/hooks/useAccounts'
import { useSnaptradeStatus } from '@/hooks/useSnaptrade'
import { holdingClassId } from '@/wh/model/classify'
import { ScreenHeader } from './ScreenHeader'
import '@/wh/screens/screens.css'

type Kind = 'wallet' | 'bank' | 'broker' | 'pension' | 'property' | 'loan' | 'holdings'

const KINDS: Array<{ id: Kind; label: string; classId: ClassId }> = [
  { id: 'bank', label: 'Bank', classId: 'bank' },
  { id: 'broker', label: 'Broker', classId: 'broker' },
  { id: 'pension', label: 'Pension', classId: 'pension' },
  { id: 'property', label: 'Property', classId: 'property' },
  { id: 'loan', label: 'Loan or mortgage', classId: 'mortgage' },
  { id: 'holdings', label: 'Holdings by hand', classId: 'equities' },
]

function errorText(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string; error?: string } } }
  return e?.response?.data?.message || e?.response?.data?.error || fallback
}

/** Ledger by public address or xpub, read-only, with what was found. */
function WatchWallet({ found, onFound }: { found: Account | null; onFound: (a: Account) => void }) {
  const add = useAddWatchWallet()
  const { money } = useFigures()
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const holdings = found?.holdings ?? []
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!key.trim()) return
    add.mutate({ key: key.trim(), label: label.trim() || undefined, institution: 'Ledger' }, { onSuccess: (a) => onFound(a) })
  }
  return (
    <>
      <Card kind="bare" style={{ padding: 18 }}>
        <div className="wh-connect-head">
          <Token name="Ledger" classId="wallet" remote={false} />
          <div>
            <div className="wh-connect-title">Ledger hardware wallet</div>
            <div className="wh-connect-ro">
              <Icon name={ICONS.status.readOnly} size={16} />
              Read-only, by public address
            </div>
          </div>
        </div>
        <p className="wh-connect-p">Paste an address or xpub from Ledger Live. Your keys stay on the device. We never ask for your 24 words.</p>
        <form onSubmit={submit} aria-label="Add a watch-only wallet">
          <label htmlFor="xpub" className="wh-label" style={{ fontSize: 13 }}>
            Address or xpub
          </label>
          <div className="wh-connect-field">
            <Field icon={ICONS.account.hardwareWallet} id="xpub" placeholder="bc1q… or xpub…" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} aria-describedby="xpub-hint" />
          </div>
          <Field icon={ICONS.action.edit} placeholder="Name, optional" value={label} onChange={(e) => setLabel(e.target.value)} className="wh-fieldset" />
          <p id="xpub-hint" className="wh-hint" style={{ margin: '8px 0 12px' }}>
            Bitcoin addresses and xpub, ypub or zpub keys, Ethereum and Solana addresses.
          </p>
          {add.isError && <p className="wh-err" style={{ marginBottom: 10 }}>{errorText(add.error, 'This key or address is not recognised.')}</p>}
          <Button type="submit" full icon={ICONS.account.hardwareWallet} disabled={add.isPending || !key.trim()}>
            {add.isPending ? 'Reading the chain' : 'Add this wallet'}
          </Button>
        </form>
      </Card>
      {found && (
        <Card kind="list" style={{ borderRadius: 24 }}>
          {holdings.length === 0 && <p className="wh-caption" style={{ padding: '10px 0' }}>Nothing found on this key yet.</p>}
          {holdings.map((h: Holding) => (
            <Row
              key={h.symbol}
              token={<Token name={h.name || h.symbol} symbol={h.symbol} classId={holdingClassId(h)} size={40} />}
              title={h.name || h.symbol}
              sub={`${Number(h.quantity.toFixed(4))} ${h.symbol}`}
              value={money(h.quantity * h.priceUsd, found.currency)}
              delta="found"
              deltaTone="muted"
            />
          ))}
        </Card>
      )}
    </>
  )
}

/** A balance you keep by hand: a bank account, a pension, a flat, a loan. */
function BalanceForm({ kind, onDone, onBack }: { kind: 'bank' | 'pension' | 'property' | 'loan'; onDone: () => void; onBack: () => void }) {
  const add = useAddManualAccount()
  const [label, setLabel] = useState('')
  const [institution, setInstitution] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [currency, setCurrency] = useState('CHF')
  const copy = {
    bank: { title: 'Bank account', name: 'UBS, everyday account', amount: 'Current balance', icon: ICONS.account.bank },
    pension: { title: 'Pension', name: 'Pillar 3a', amount: 'Current value', icon: ICONS.assetClass.pension },
    property: { title: 'Property', name: 'Apartment', amount: 'Estimated value', icon: ICONS.assetClass.property },
    loan: { title: 'Loan or mortgage', name: 'Mortgage', amount: 'Outstanding balance', icon: ICONS.account.mortgage },
  }[kind]
  function submit(e: FormEvent) {
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
        type: kind === 'bank' ? 'bank' : kind === 'loan' ? 'loan' : kind === 'pension' ? 'pension' : 'estate',
        kind: kind === 'loan' ? 'liability' : 'asset',
        bookClass: kind === 'bank' ? 'cash' : kind === 'pension' ? 'pension' : kind === 'property' ? 'estate' : undefined,
      },
      { onSuccess: onDone },
    )
  }
  return (
    <Card kind="bare" style={{ padding: 18 }}>
      <div className="wh-connect-head" style={{ marginBottom: 12 }}>
        <Token classId={kind === 'bank' ? 'bank' : kind === 'pension' ? 'pension' : kind === 'property' ? 'property' : 'mortgage'} classOnly />
        <div>
          <div className="wh-connect-title">{copy.title}</div>
          <div className="wh-caption">Kept by hand. Update the figure whenever it changes.</div>
        </div>
      </div>
      <form onSubmit={submit} className="wh-form" aria-label={copy.title}>
        <Field icon={copy.icon} label="Name" required placeholder={copy.name} value={label} onChange={(e) => setLabel(e.target.value)} />
        <Field icon={ICONS.account.bank} label="Institution" placeholder="Optional" value={institution} onChange={(e) => setInstitution(e.target.value)} />
        <div className="wh-form-row">
          <Field icon={ICONS.figure.own} label={copy.amount} required inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Field icon={ICONS.account.exchange} label="Currency" as="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {['CHF', 'EUR', 'USD', 'GBP'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Field>
        </div>
        <Field icon={ICONS.action.edit} label="Note" placeholder={kind === 'loan' ? 'Rate and term' : kind === 'property' ? 'Address, or when it was valued' : 'Optional'} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {add.isError && <p className="wh-err">{errorText(add.error, 'Could not save this account.')}</p>}
        <div className="wh-form-actions">
          <Button type="submit" icon={ICONS.action.add} disabled={!label.trim() || add.isPending}>
            {add.isPending ? 'Saving' : `Add ${copy.title.toLowerCase()}`}
          </Button>
          <Button variant="tertiary" onClick={onBack}>
            Back
          </Button>
        </div>
      </form>
    </Card>
  )
}

/** Positions typed in: ticker, quantity, price. */
function HoldingsForm({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const add = useAddManualAccount()
  const { money } = useFigures()
  const [label, setLabel] = useState('')
  const [institution, setInstitution] = useState('')
  const [symbol, setSymbol] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [rows, setRows] = useState<Holding[]>([])
  const ready = symbol.trim() && Number.isFinite(parseFloat(quantity)) && Number.isFinite(parseFloat(price))
  function addRow() {
    if (!ready) return
    const sym = symbol.trim().toUpperCase()
    setRows((r) => [...r, { symbol: sym, quantity: parseFloat(quantity), priceUsd: parseFloat(price), assetClass: ['CHF', 'USD', 'EUR', 'GBP'].includes(sym) ? 'cash' : 'equity' }])
    setSymbol('')
    setQuantity('')
    setPrice('')
  }
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    add.mutate({ label: label.trim(), institution: institution.trim() || undefined, type: 'manual', holdings: rows }, { onSuccess: onDone })
  }
  return (
    <Card kind="bare" style={{ padding: 18 }}>
      <div className="wh-connect-head" style={{ marginBottom: 12 }}>
        <Token classId="equities" classOnly />
        <div>
          <div className="wh-connect-title">Holdings by hand</div>
          <div className="wh-caption">Tickers, quantities and prices you enter yourself.</div>
        </div>
      </div>
      <form onSubmit={submit} className="wh-form" aria-label="Holdings by hand">
        <Field icon={ICONS.account.broker} label="Account name" required placeholder="Swissquote" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Field icon={ICONS.account.bank} label="Institution" placeholder="Optional" value={institution} onChange={(e) => setInstitution(e.target.value)} />
        <div className="wh-form-row" style={{ gridTemplateColumns: '1.2fr 1fr 1fr' }}>
          <Field icon={ICONS.assetClass.equities} label="Ticker" placeholder="AAPL" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
          <Field icon={ICONS.evidence.holdings} label="Quantity" inputMode="decimal" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <Field icon={ICONS.figure.own} label="Price" inputMode="decimal" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="wh-form-actions">
          <Button variant="secondary" size="sm" icon={ICONS.action.add} onClick={addRow} disabled={!ready}>
            Add position
          </Button>
        </div>
        {rows.length > 0 && (
          <div>
            {rows.map((h, i) => (
              <Row key={`${h.symbol}-${i}`} token={<Token symbol={h.symbol} name={h.symbol} classId={holdingClassId(h)} size={36} />} title={h.symbol} sub={`${h.quantity} at ${h.priceUsd}`} value={money(h.quantity * h.priceUsd)} trailing={<RoundButton icon={ICONS.ui.close} label={`Remove ${h.symbol}`} flat onClick={() => setRows((r) => r.filter((_, j) => j !== i))} />} />
            ))}
          </div>
        )}
        {add.isError && <p className="wh-err">{errorText(add.error, 'Could not save this account.')}</p>}
        <div className="wh-form-actions">
          <Button type="submit" icon={ICONS.action.add} disabled={!label.trim() || add.isPending}>
            {add.isPending ? 'Saving' : 'Add account'}
          </Button>
          <Button variant="tertiary" onClick={onBack}>
            Back
          </Button>
        </div>
      </form>
    </Card>
  )
}

/** A broker through SnapTrade, read-only. */
function BrokerForm({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { data: providers } = useProviders()
  const snap = providers?.find((p) => p.id === 'snaptrade')
  const status = useSnaptradeStatus()
  const connect = useSnaptradeConnect()
  const importAccts = useSnaptradeImport()
  return (
    <Card kind="bare" style={{ padding: 18 }}>
      <div className="wh-connect-head" style={{ marginBottom: 12 }}>
        <Token classId="broker" classOnly />
        <div>
          <div className="wh-connect-title">Broker</div>
          <div className="wh-connect-ro">
            <Icon name={ICONS.status.readOnly} size={16} />
            Read-only, through SnapTrade
          </div>
        </div>
      </div>
      {!snap?.configured ? (
        <>
          <p className="wh-connect-p">This deployment has no SnapTrade keys yet. Add SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY to the server and restart it, or keep the broker by hand for now.</p>
          <div className="wh-form-actions">
            <Button variant="tertiary" onClick={onBack}>
              Back
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="wh-connect-p">
            {typeof status.data?.accountCount === 'number' ? `SnapTrade reports ${status.data.accountCount} ${status.data.accountCount === 1 ? 'account' : 'accounts'} across ${status.data.connectionCount} ${status.data.connectionCount === 1 ? 'connection' : 'connections'}.` : 'Link a broker in the SnapTrade portal, then import the accounts it reports.'}
          </p>
          {(status.data?.disabledConnectionCount ?? 0) > 0 && (
            <Note tone="risk" title="A connection needs sign-in">
              {status.data!.disabledConnectionCount} {status.data!.disabledConnectionCount === 1 ? 'connection is' : 'connections are'} disabled. Repair it below, then import again.
            </Note>
          )}
          <div className="wh-form-actions" style={{ marginTop: 12 }}>
            <Button icon={ICONS.action.export} disabled={importAccts.isPending} onClick={() => importAccts.mutate(undefined, { onSuccess: (d) => (d.imported?.length ?? 0) > 0 && onDone() })}>
              {importAccts.isPending ? 'Importing' : 'Import connected accounts'}
            </Button>
            <Button variant="secondary" icon={ICONS.ui.openInNew} disabled={connect.isPending} onClick={() => connect.mutate(undefined, { onSuccess: (d) => d.redirectUrl && window.open(d.redirectUrl, '_blank', 'noopener') })}>
              Add or repair a broker
            </Button>
            <Button variant="tertiary" onClick={onBack}>
              Back
            </Button>
          </div>
          {(connect.isError || importAccts.isError) && <p className="wh-err" style={{ marginTop: 10 }}>{errorText(connect.error || importAccts.error, 'SnapTrade request failed.')}</p>}
          {importAccts.data?.message && <p className="wh-caption" style={{ marginTop: 10 }}>{importAccts.data.message}</p>}
        </>
      )}
    </Card>
  )
}

/** One connected source with its freshness and its actions. */
function SourceRow({ a }: { a: BookAccount }) {
  const sync = useSyncAccount()
  const rename = useRenameAccount()
  const remove = useDeleteAccount()
  const { money } = useFigures()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(a.name)
  const [confirm, setConfirm] = useState(false)
  const live = a.account.provider !== 'manual'
  const sub = a.broken ? a.account.lastError || 'Sync failed' : a.sample ? `${a.kind}, sample` : live ? `${a.kind}, synced ${a.freshLabel} ago` : `${a.kind}, ${a.note ?? 'by hand'}`
  if (renaming) {
    return (
      <form
        className="wh-row"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) rename.mutate({ id: a.id, label: name.trim() }, { onSuccess: () => setRenaming(false) })
        }}
      >
        <Field icon={ICONS.action.edit} value={name} onChange={(e) => setName(e.target.value)} aria-label={`Rename ${a.name}`} autoFocus />
        <Button type="submit" size="sm" icon={ICONS.ui.check} disabled={rename.isPending}>
          Save
        </Button>
        <Button variant="tertiary" size="sm" onClick={() => setRenaming(false)}>
          Cancel
        </Button>
      </form>
    )
  }
  if (confirm) {
    return (
      <div className="wh-row">
        <span className="wh-row-text">
          <span className="wh-row-title">Disconnect {a.name}?</span>
          <span className="wh-row-sub">Its figures leave the ledger. Nothing is moved.</span>
        </span>
        <Button size="sm" icon={ICONS.ui.remove} onClick={() => remove.mutate(a.id)} disabled={remove.isPending} style={{ background: 'var(--wh-owed)' }}>
          Disconnect
        </Button>
        <Button variant="tertiary" size="sm" onClick={() => setConfirm(false)}>
          Keep
        </Button>
      </div>
    )
  }
  return (
    <Row
      token={<Token name={a.account.institution || a.name} classId={a.classId} size={40} classOnly={a.classId === 'property' || a.liability} />}
      title={a.name}
      sub={sub}
      value={a.liability ? money(-a.value) : money(a.value)}
      valueTone={a.liability ? 'owed' : undefined}
      delta={a.broken ? <span className="wh-owed">needs attention</span> : live && !a.sample ? a.freshLabel : undefined}
      trailing={
        a.sample ? undefined : (
          <Menu
            label={`Actions for ${a.name}`}
            items={[
              ...(live ? [{ key: 'sync', label: sync.isPending ? 'Syncing' : 'Sync now', icon: ICONS.ui.refresh, onSelect: () => sync.mutate(a.id), disabled: sync.isPending }] : []),
              { key: 'rename', label: 'Rename', icon: ICONS.action.edit, onSelect: () => setRenaming(true) },
              'rule',
              { key: 'remove', label: 'Disconnect', icon: ICONS.ui.remove, onSelect: () => setConfirm(true) },
            ]}
            trigger={(props) => <RoundButton icon={ICONS.ui.more} label={`Actions for ${a.name}`} flat {...props} />}
          />
        )
      }
    />
  )
}

export function Connect() {
  const desktop = useDesktop()
  const navigate = useNavigate()
  const book = useBook()
  const [kind, setKind] = useState<Kind>('wallet')
  const [found, setFound] = useState<Account | null>(null)

  useEffect(() => {
    document.title = 'Connect · Wealth Hub'
  }, [])

  // The sample Ledger shows what a read finds; a real one replaces it the moment it is added.
  const sampleLedger = book.accounts.find((a) => a.sample && a.classId === 'wallet')?.account ?? null
  const shownFound = found ?? (book.hasLive ? null : sampleLedger)

  const kinds = (
    <>
      <h2 className="wh-h2" style={{ margin: '4px 0 0', color: 'var(--wh-muted)', fontSize: 14 }}>
        {kind === 'wallet' ? 'Or connect something else' : 'Connect'}
      </h2>
      <div className="wh-connect-grid">
        {[{ id: 'wallet' as Kind, label: 'Ledger wallet', classId: 'wallet' as ClassId }, ...KINDS].map((k) => (
          <button key={k.id} type="button" className={`wh-connect-kind${kind === k.id ? ' on' : ''}`} onClick={() => setKind(k.id)} aria-pressed={kind === k.id}>
            <Token classId={k.classId} classOnly size={36} />
            {k.label}
          </button>
        ))}
      </div>
    </>
  )
  const form =
    kind === 'wallet' ? (
      <WatchWallet found={shownFound} onFound={setFound} />
    ) : kind === 'holdings' ? (
      <HoldingsForm onDone={() => navigate('/')} onBack={() => setKind('wallet')} />
    ) : kind === 'broker' ? (
      <BrokerForm onDone={() => navigate('/')} onBack={() => setKind('wallet')} />
    ) : (
      <BalanceForm kind={kind} onDone={() => navigate('/')} onBack={() => setKind('wallet')} />
    )
  const sources = (
    <Card kind="list" style={{ padding: '6px 18px' }}>
      <div className="wh-card-head" style={{ padding: '10px 0 4px' }}>
        <h2 className="wh-card-title sm">Connected</h2>
        {book.broken.length ? (
          <StatusPill tone="bad" icon={ICONS.status.needsSignIn}>
            {book.broken.length} {book.broken.length === 1 ? 'needs' : 'need'} attention
          </StatusPill>
        ) : (
          <StatusPill tone="ok" icon={ICONS.status.synced}>
            {book.synced} synced
          </StatusPill>
        )}
      </div>
      {book.accounts.length === 0 && <p className="wh-caption" style={{ padding: '10px 0' }}>Nothing connected yet.</p>}
      {book.accounts.map((a) => (
        <SourceRow key={a.id} a={a} />
      ))}
      {book.sampleOn && book.accounts.some((a) => a.sample) && (
        <p className="wh-caption" style={{ padding: '10px 0' }}>
          Sample accounts sit beside anything you connect. Turn the sample household off from the account menu to see your own ledger alone.
        </p>
      )}
    </Card>
  )

  if (!desktop) {
    return (
      <div className="wh-screen">
        <ScreenHeader title="Connect" lead={<RoundButton icon={ICONS.ui.back} label="Back to overview" onClick={() => navigate('/')} />} />
        {form}
        {kinds}
        {sources}
      </div>
    )
  }
  return (
    <div className="wh-screen">
      <ScreenHeader title="Connect" subtitle="Banks, brokers, pensions and hardware wallets, read-only. Property and debts by hand." actions={<Link to="/activity" className="wh-link">Broker activity <Icon name={ICONS.ui.chevronRight} size={18} /></Link>} />
      <div className="wh-grid">
        <div className="wh-col">
          {form}
          {kinds}
        </div>
        <div className="wh-col">{sources}</div>
      </div>
    </div>
  )
}
