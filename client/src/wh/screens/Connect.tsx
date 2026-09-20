import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { Token } from '@/wh/Token'
import { Button, Field, RoundButton, StatusPill } from '@/wh/controls'
import { Card, Note, Row } from '@/wh/layout'
import { Menu } from '@/wh/Menu'
import { useFigures } from '@/wh/format'
import { useBook, type BookAccount } from '@/wh/model/book'
import { useDesktop } from '@/wh/useMediaQuery'
import { useAddManualAccount, useAddWatchWallet, useDeleteAccount, useProviders, useRenameAccount, useSnaptradeConnect, useSnaptradeImport, useSyncAccount, type Account, type Holding } from '@/hooks/useAccounts'
import { holdingClassId } from '@/wh/model/classify'
import { FEATURED_IDS, INSTITUTIONS, KIND_LABEL, METHOD_LABEL, groupByKind, searchInstitutions, type Institution } from '@/wh/model/institutions'
import { R } from '@/routes'
import { ScreenHeader } from './ScreenHeader'
import '@/wh/screens/screens.css'
import './connect.css'

function errorText(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string; error?: string } } }
  return e?.response?.data?.message || e?.response?.data?.error || fallback
}

/* ---------------- Step 1: pick a source ---------------- */

function Picker({ onPick }: { onPick: (i: Institution) => void }) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchInstitutions(query), [query])
  const featured = useMemo(() => FEATURED_IDS.map((id) => INSTITUTIONS.find((i) => i.id === id)!).filter(Boolean), [])
  const groups = useMemo(() => groupByKind(results), [results])
  const searching = query.trim().length > 0
  return (
    <div className="wh-stack">
      <Field icon={ICONS.action.search} type="search" placeholder="Search a bank, broker, wallet or pension" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search institutions" autoFocus variant="lg" />
      {!searching && (
        <div className="wh-featured" aria-label="Popular">
          {featured.map((i) => (
            <button key={i.id} type="button" className="wh-featured-btn" onClick={() => onPick(i)}>
              <Token name={i.name} domain={i.domain} classId={i.classId} size={34} classOnly={!i.domain} />
              <span>{i.name}</span>
            </button>
          ))}
        </div>
      )}
      {groups.length === 0 && (
        <Note tone="plain" icon={ICONS.action.search}>
          Nothing matches. Try the name of the bank or broker, or pick “Another bank”, “Property” or “Positions by hand”.
        </Note>
      )}
      {groups.map((g) => (
        <Card key={g.kind} kind="list">
          <div className="wh-eyebrow" style={{ padding: '10px 0 2px' }}>
            {KIND_LABEL[g.kind]}
          </div>
          {g.items.map((i) => {
            const m = METHOD_LABEL[i.method]
            return (
              <Row
                key={i.id}
                onClick={() => onPick(i)}
                token={<Token name={i.name} domain={i.domain} classId={i.classId} size={36} classOnly={!i.domain} />}
                title={i.name}
                sub={`${i.region} · ${m.title}`}
                right={
                  m.ro ? (
                    <span className="wh-chip gain plain" style={{ fontSize: 12 }}>
                      Read-only
                    </span>
                  ) : (
                    <span className="wh-chip neutral plain" style={{ fontSize: 12 }}>
                      By hand
                    </span>
                  )
                }
                trailing={<Icon name={ICONS.ui.chevronRight} size={16} className="wh-row-chev" />}
              />
            )
          })}
        </Card>
      ))}
    </div>
  )
}

/* ---------------- Step 2: one form per method ---------------- */

function FormHead({ i, onBack }: { i: Institution; onBack: () => void }) {
  const m = METHOD_LABEL[i.method]
  return (
    <div className="wh-connect-head">
      <RoundButton icon={ICONS.ui.back} label="Choose another source" flat onClick={onBack} />
      <Token name={i.name} domain={i.domain} classId={i.classId} size={44} classOnly={!i.domain} />
      <div style={{ minWidth: 0 }}>
        <div className="wh-connect-title">{i.name}</div>
        <div className={`wh-connect-ro${m.ro ? '' : ' hand'}`}>
          <Icon name={m.ro ? ICONS.status.readOnly : ICONS.action.edit} size={14} />
          {m.title}
        </div>
      </div>
    </div>
  )
}

/** A broker or an exchange through the portal: one button, then straight back here. */
function PortalForm({ i, onBack, onDone }: { i: Institution; onBack: () => void; onDone: () => void }) {
  const { data: providers } = useProviders()
  const configured = Boolean(providers?.find((p) => p.id === 'snaptrade')?.configured)
  const connect = useSnaptradeConnect()
  const importAccts = useSnaptradeImport()
  const m = METHOD_LABEL[i.method]
  function start() {
    const customRedirect = `${window.location.origin}${R.connect}?snaptrade=done`
    connect.mutate({ broker: i.brokerSlug, customRedirect }, { onSuccess: (d) => d.redirectUrl && window.location.assign(d.redirectUrl) })
  }
  return (
    <Card kind="pad">
      <FormHead i={i} onBack={onBack} />
      <p className="wh-connect-p">{m.sub}</p>
      {!configured ? (
        <>
          <Note tone="info" title="Broker links are not switched on for this deployment">
            The server needs SnapTrade keys before a portal can open. Until then, keep {i.name} by hand and it still counts in every total.
          </Note>
          <div className="wh-form-actions" style={{ marginTop: 14 }}>
            <Button icon={ICONS.action.edit} onClick={() => onDone()}>
              Keep positions by hand instead
            </Button>
          </div>
        </>
      ) : (
        <>
          <ol className="wh-steps">
            <li>
              <b>Sign in on {i.name}'s page</b>
              <span>The portal is SnapTrade's, in read-only mode. Your password never reaches Wealth Hub.</span>
            </li>
            <li>
              <b>Come straight back</b>
              <span>Your accounts are imported the moment you land here.</span>
            </li>
          </ol>
          {connect.isError && <p className="wh-err">{errorText(connect.error, 'The portal could not be opened.')}</p>}
          <div className="wh-form-actions" style={{ marginTop: 14 }}>
            <Button icon={ICONS.ui.openInNew} size="lg" disabled={connect.isPending} onClick={start}>
              {connect.isPending ? 'Opening' : `Continue to ${i.name}`}
            </Button>
            <Button variant="tertiary" disabled={importAccts.isPending} onClick={() => importAccts.mutate(undefined, { onSuccess: (d) => (d.imported?.length ?? 0) > 0 && onDone() })}>
              {importAccts.isPending ? 'Importing' : 'Already linked? Import'}
            </Button>
          </div>
          {importAccts.data?.message && <p className="wh-caption" style={{ marginTop: 10 }}>{importAccts.data.message}</p>}
        </>
      )}
    </Card>
  )
}

/** A wallet by public key or address. */
function WalletForm({ i, onBack, onFound }: { i: Institution; onBack: () => void; onFound: (a: Account) => void }) {
  const add = useAddWatchWallet()
  const { money } = useFigures()
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [found, setFound] = useState<Account | null>(null)
  const placeholder = i.id === 'ethereum' ? '0x…' : i.id === 'solana' ? 'A Solana address' : 'bc1q… or xpub…'
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!key.trim()) return
    add.mutate(
      { key: key.trim(), label: label.trim() || undefined, institution: i.kind === 'wallet' && i.domain ? i.name : undefined },
      {
        onSuccess: (a) => {
          setFound(a)
          onFound(a)
        },
      },
    )
  }
  const holdings = found?.holdings ?? []
  return (
    <>
      <Card kind="pad">
        <FormHead i={i} onBack={onBack} />
        <p className="wh-connect-p">{i.id === 'ledger' || i.id === 'trezor' ? `Paste an address or xpub from ${i.name}'s app. Your keys stay on the device. We never ask for your recovery phrase.` : METHOD_LABEL.wallet.sub}</p>
        <form onSubmit={submit} className="wh-form" aria-label="Add a watch-only wallet">
          <Field icon={ICONS.account.hardwareWallet} label="Address or xpub" placeholder={placeholder} value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} hint="Bitcoin addresses and xpub, ypub or zpub keys, Ethereum and Solana addresses." variant="lg" />
          <Field icon={ICONS.action.edit} label="Name" placeholder="Optional" value={label} onChange={(e) => setLabel(e.target.value)} />
          {add.isError && <p className="wh-err">{errorText(add.error, 'This key or address is not recognised.')}</p>}
          <div className="wh-form-actions">
            <Button type="submit" size="lg" icon={ICONS.account.hardwareWallet} disabled={add.isPending || !key.trim()}>
              {add.isPending ? 'Reading the chain' : 'Add this wallet'}
            </Button>
          </div>
        </form>
      </Card>
      {found && (
        <Card kind="list">
          <div className="wh-card-head" style={{ padding: '10px 0 4px' }}>
            <h2 className="wh-card-title sm">Found on this key</h2>
            <span className="wh-chip gain plain">Added</span>
          </div>
          {holdings.length === 0 && <p className="wh-caption" style={{ padding: '10px 0' }}>Nothing on this key yet. It stays on the ledger and reads again later.</p>}
          {holdings.map((h: Holding) => (
            <Row key={h.symbol} token={<Token name={h.name || h.symbol} symbol={h.symbol} classId={holdingClassId(h)} size={36} />} title={h.name || h.symbol} sub={`${Number(h.quantity.toFixed(4))} ${h.symbol}`} value={money(h.quantity * h.priceUsd, found.currency)} />
          ))}
        </Card>
      )}
    </>
  )
}

/** A balance you keep by hand: a bank account, a pension, a property, a loan. */
function BalanceForm({ i, onBack, onDone }: { i: Institution; onBack: () => void; onDone: () => void }) {
  const add = useAddManualAccount()
  const kind = i.kind === 'bank' ? 'bank' : i.kind === 'pension' ? 'pension' : i.kind === 'property' ? 'property' : 'loan'
  const named = Boolean(i.domain)
  const [label, setLabel] = useState(named ? i.name : '')
  const [institution, setInstitution] = useState(named ? i.name : '')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState(i.id === 'mortgage' ? 'Mortgage' : '')
  const [currency, setCurrency] = useState('CHF')
  const copy = {
    bank: { name: named ? `${i.name}, everyday account` : 'Everyday account', amount: 'Current balance', icon: ICONS.account.bank },
    pension: { name: named ? `${i.name} 3a` : 'Pillar 3a', amount: 'Current value', icon: ICONS.assetClass.pension },
    property: { name: 'Apartment', amount: 'Estimated value', icon: ICONS.assetClass.property },
    loan: { name: i.id === 'mortgage' ? 'Mortgage' : 'Car loan', amount: 'Outstanding balance', icon: ICONS.account.mortgage },
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
    <Card kind="pad">
      <FormHead i={i} onBack={onBack} />
      <p className="wh-connect-p">{i.note ?? METHOD_LABEL.balance.sub}</p>
      <form onSubmit={submit} className="wh-form" aria-label={i.name}>
        <Field icon={copy.icon} label="Name" required placeholder={copy.name} value={label} onChange={(e) => setLabel(e.target.value)} />
        {!named && <Field icon={ICONS.account.bank} label="Institution" placeholder="Optional" value={institution} onChange={(e) => setInstitution(e.target.value)} />}
        <div className="wh-form-row">
          <Field icon={ICONS.figure.own} label={copy.amount} required inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          <Field icon={ICONS.account.exchange} label="Currency" as="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {['CHF', 'EUR', 'USD', 'GBP'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Field>
        </div>
        <Field icon={ICONS.action.edit} label="Note" placeholder={kind === 'loan' ? 'Rate and term' : kind === 'property' ? 'Address, or when it was valued' : 'Optional'} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {add.isError && <p className="wh-err">{errorText(add.error, 'Could not save this account.')}</p>}
        <div className="wh-form-actions">
          <Button type="submit" size="lg" icon={ICONS.action.add} disabled={!label.trim() || add.isPending}>
            {add.isPending ? 'Saving' : 'Add to the ledger'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

/** Positions typed in: ticker, quantity, price. */
function HoldingsForm({ i, onBack, onDone }: { i: Institution; onBack: () => void; onDone: () => void }) {
  const add = useAddManualAccount()
  const { money } = useFigures()
  const named = Boolean(i.domain)
  const [label, setLabel] = useState(named ? i.name : '')
  const [institution, setInstitution] = useState(named ? i.name : '')
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
    <Card kind="pad">
      <FormHead i={i} onBack={onBack} />
      <p className="wh-connect-p">{i.note ?? METHOD_LABEL.holdings.sub}</p>
      <form onSubmit={submit} className="wh-form" aria-label="Positions by hand">
        <div className="wh-form-row">
          <Field icon={ICONS.account.broker} label="Account name" required placeholder="Swissquote" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Field icon={ICONS.account.bank} label="Institution" placeholder="Optional" value={institution} onChange={(e) => setInstitution(e.target.value)} />
        </div>
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
            {rows.map((h, k) => (
              <Row key={`${h.symbol}-${k}`} token={<Token symbol={h.symbol} name={h.symbol} classId={holdingClassId(h)} size={32} />} title={h.symbol} sub={`${h.quantity} at ${h.priceUsd}`} value={money(h.quantity * h.priceUsd)} trailing={<RoundButton icon={ICONS.ui.close} label={`Remove ${h.symbol}`} flat onClick={() => setRows((r) => r.filter((_, j) => j !== k))} />} />
            ))}
          </div>
        )}
        {add.isError && <p className="wh-err">{errorText(add.error, 'Could not save this account.')}</p>}
        <div className="wh-form-actions">
          <Button type="submit" size="lg" icon={ICONS.action.add} disabled={!label.trim() || add.isPending}>
            {add.isPending ? 'Saving' : 'Add to the ledger'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

/* ---------------- Connected sources ---------------- */

function SourceRow({ a, highlight }: { a: BookAccount; highlight: boolean }) {
  const sync = useSyncAccount()
  const rename = useRenameAccount()
  const remove = useDeleteAccount()
  const { money } = useFigures()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(a.name)
  const [confirm, setConfirm] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlight])
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
        <Button type="submit" size="sm" disabled={rename.isPending}>
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
        <Button size="sm" variant="danger" onClick={() => remove.mutate(a.id)} disabled={remove.isPending}>
          Disconnect
        </Button>
        <Button variant="tertiary" size="sm" onClick={() => setConfirm(false)}>
          Keep
        </Button>
      </div>
    )
  }
  return (
    <div ref={ref} className={highlight ? 'wh-highlight' : undefined}>
      <Row
        token={<Token name={a.account.institution || a.name} classId={a.classId} size={36} classOnly={a.classId === 'property' || a.liability} />}
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
    </div>
  )
}

/* ---------------- The screen ---------------- */

export function Connect() {
  const desktop = useDesktop()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const book = useBook()
  const importAccts = useSnaptradeImport()
  const [picked, setPicked] = useState<Institution | null>(null)
  const [returned, setReturned] = useState<{ count: number } | null>(null)
  const highlightId = location.hash ? location.hash.slice(1) : null

  useEffect(() => {
    document.title = 'Connect · Wealth Hub'
  }, [])

  // Back from the SnapTrade portal: import straight away, once.
  const imported = useRef(false)
  useEffect(() => {
    if (params.get('snaptrade') !== 'done' || imported.current) return
    imported.current = true
    importAccts.mutate(undefined, {
      onSuccess: (d) => setReturned({ count: d.imported?.length ?? 0 }),
      onSettled: () => setParams({}, { replace: true }),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const done = () => navigate(R.overview)
  const form =
    picked &&
    (picked.method === 'broker' || picked.method === 'exchange' ? (
      <PortalForm i={picked} onBack={() => setPicked(null)} onDone={() => (picked.method === 'broker' && !picked.brokerSlug ? setPicked({ ...picked, method: 'holdings' }) : done())} />
    ) : picked.method === 'wallet' ? (
      <WalletForm i={picked} onBack={() => setPicked(null)} onFound={() => undefined} />
    ) : picked.method === 'holdings' ? (
      <HoldingsForm i={picked} onBack={() => setPicked(null)} onDone={done} />
    ) : (
      <BalanceForm i={picked} onBack={() => setPicked(null)} onDone={done} />
    ))

  const returnedNote = (returned || importAccts.isPending) && (
    <Note tone={importAccts.isPending ? 'info' : 'plain'} icon={importAccts.isPending ? ICONS.status.syncing : ICONS.status.synced} title={importAccts.isPending ? 'Importing your accounts' : returned && returned.count > 0 ? `${returned.count} ${returned.count === 1 ? 'account' : 'accounts'} imported` : 'Nothing new to import'}>
      {importAccts.isPending ? 'Back from the portal. Reading what was linked.' : returned && returned.count > 0 ? 'They sit on the ledger now and sync on their own.' : 'If you just linked a broker, give it a minute and import again from the broker’s page.'}
    </Note>
  )

  const sources = (
    <Card kind="list">
      <div className="wh-card-head" style={{ padding: '10px 0 4px' }}>
        <h2 className="wh-card-title">Connected</h2>
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
        <SourceRow key={a.id} a={a} highlight={a.id === highlightId} />
      ))}
      {book.sampleOn && book.accounts.some((a) => a.sample) && <p className="wh-caption" style={{ padding: '10px 0' }}>Sample accounts sit beside anything you connect. Turn the sample household off in Settings to see your own ledger alone.</p>}
    </Card>
  )
  const promise = (
    <Card kind="pad-sm">
      <div className="wh-promise">
        <span>
          <Icon name={ICONS.status.readOnly} size={16} />
          Read-only, always
        </span>
        <span>
          <Icon name={ICONS.ui.lock} size={16} />
          No recovery phrases
        </span>
        <span>
          <Icon name={ICONS.action.export} size={16} />
          Export or disconnect any time
        </span>
      </div>
    </Card>
  )

  if (!desktop) {
    return (
      <div className="wh-screen">
        <ScreenHeader title={picked ? 'Connect' : 'Connect'} lead={<RoundButton icon={ICONS.ui.back} label="Back to overview" onClick={() => (picked ? setPicked(null) : navigate(R.overview))} />} />
        {returnedNote}
        {form ?? <Picker onPick={setPicked} />}
        {!picked && sources}
        {!picked && promise}
      </div>
    )
  }
  return (
    <div className="wh-screen">
      <ScreenHeader title="Connect" subtitle="Banks, brokers, pensions and wallets, read-only. Property and debts by hand." />
      <div className="wh-grid">
        <div className="wh-col">
          {returnedNote}
          {form ?? <Picker onPick={setPicked} />}
        </div>
        <div className="wh-col">
          {sources}
          {promise}
        </div>
      </div>
    </div>
  )
}
