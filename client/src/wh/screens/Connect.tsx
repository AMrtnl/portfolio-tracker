import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '@/wh/Icon'
import { ICONS, type IconName } from '@/wh/icons'
import { Token, type ClassId } from '@/wh/Token'
import { Button, Field, RoundButton, StatusPill } from '@/wh/controls'
import { Card, Note, Row } from '@/wh/layout'
import { Menu } from '@/wh/Menu'
import { useFigures } from '@/wh/format'
import { useBook, type BookAccount } from '@/wh/model/book'
import { useDesktop } from '@/wh/useMediaQuery'
import { useAddManualAccount, useAddWatchWallet, useDeleteAccount, useRenameAccount, useSnaptradeConnect, useSnaptradeImport, useSyncAccount, type Account, type Holding } from '@/hooks/useAccounts'
import { useCatalog, useGocardlessFinish, useGocardlessStart, useImportTransactions, isPlanLimit, type CatalogInstitution, type CategoryId } from '@/hooks/useCatalog'
import { holdingClassId } from '@/wh/model/classify'
import { R } from '@/routes'
import { ScreenHeader } from './ScreenHeader'
import { UpgradeNote } from './Billing'
import '@/wh/screens/screens.css'
import './connect.css'

function errorText(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string; error?: string } } }
  return e?.response?.data?.message || e?.response?.data?.error || fallback
}

const CATEGORY_ICON: Record<CategoryId, IconName> = {
  banks: ICONS.account.bank,
  brokers: ICONS.account.broker,
  exchanges: ICONS.account.exchange,
  wallets: ICONS.account.hardwareWallet,
  pensions: ICONS.assetClass.pension,
  property: ICONS.assetClass.property,
  debts: ICONS.account.mortgage,
}

const CATEGORY_CLASS: Record<CategoryId, ClassId> = {
  banks: 'bank',
  brokers: 'broker',
  exchanges: 'exchange',
  wallets: 'wallet',
  pensions: 'pension',
  property: 'property',
  debts: 'mortgage',
}

const COUNTRY_KEY = 'wh.country'

function readCountry(): string {
  try {
    return localStorage.getItem(COUNTRY_KEY) || 'CH'
  } catch {
    return 'CH'
  }
}

/** What a row says under the name: the method, in plain words. */
function methodLine(i: CatalogInstitution): string {
  if (i.method === 'link') {
    if (!i.available) return i.connector === 'gocardless' ? 'Open banking link, not switched on here' : 'Broker portal, not switched on here'
    return i.connector === 'gocardless' ? 'Open banking, read-only' : i.category === 'exchanges' ? 'Exchange link, read-only' : 'Broker portal, read-only'
  }
  if (i.method === 'key') return 'Public key or address, read-only'
  return i.manualKind === 'holdings' ? 'Positions you keep by hand' : 'A figure you keep by hand'
}

function InstitutionToken({ i, size = 36 }: { i: CatalogInstitution; size?: number }) {
  const classOnly = !i.domain && !i.logo
  return <Token name={i.name} domain={i.domain} logoUrl={i.logo} classId={i.category === 'wallets' && /bitcoin/i.test(i.name) ? 'bitcoin' : i.category === 'wallets' && /ethereum|solana/i.test(i.name) ? 'crypto' : CATEGORY_CLASS[i.category]} size={size} classOnly={classOnly} />
}

/* ---------------- Step 1: a category, then the institutions in it ---------------- */

function Picker({ country, onCountry, onPick }: { country: string; onCountry: (c: string) => void; onPick: (i: CatalogInstitution) => void }) {
  const catalog = useCatalog(country)
  const [category, setCategory] = useState<CategoryId>('banks')
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const categories = useMemo(() => catalog.data?.categories ?? [], [catalog.data])
  const current = categories.find((c) => c.id === category) ?? categories[0]
  const rows = useMemo(() => {
    // The generic entries ("Another bank", "Positions by hand") close the list; the server orders the rest.
    const generic = (i: CatalogInstitution) => Number(!i.domain && !i.logo)
    const pool = q ? categories.flatMap((c) => c.institutions) : (current?.institutions ?? [])
    if (!q) return [...pool].sort((a, b) => generic(a) - generic(b))
    return pool.filter((i) => i.name.toLowerCase().includes(q)).sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)))
  }, [categories, current, q])
  const countryName = catalog.data?.countries.find((c) => c.code === country)?.name ?? country
  const supported = current ? current.institutions.filter((i) => i.available && i.method !== 'manual').length : 0

  return (
    <div className="wh-stack">
      <div className="wh-connect-top">
        <Field icon={ICONS.action.search} type="search" placeholder="Search every category" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search institutions" variant="lg" className="wh-connect-search" />
        <Menu
          label="Country"
          items={(catalog.data?.countries ?? [{ code: country, name: countryName }]).map((c) => ({ key: c.code, label: c.name, sub: c.code, on: c.code === country, onSelect: () => onCountry(c.code) }))}
          trigger={(props) => (
            <button type="button" className="wh-pill neutral wh-connect-country" aria-label={`Country: ${countryName}`} {...props}>
              <Icon name={ICONS.nav.exposure} size={16} />
              {countryName}
              <Icon name={ICONS.ui.expand} size={14} />
            </button>
          )}
        />
      </div>

      {!q && (
        <div className="wh-cats" role="tablist" aria-label="Categories">
          {categories.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={c.id === category} className={`wh-cat${c.id === category ? ' on' : ''}`} onClick={() => setCategory(c.id)}>
              <Icon name={CATEGORY_ICON[c.id]} size={16} filled={c.id === category} />
              {c.name}
              <span className="wh-cat-n">{c.institutions.length}</span>
            </button>
          ))}
        </div>
      )}

      {catalog.isLoading && (
        <Card kind="list">
          {[0, 1, 2, 3].map((k) => (
            <div key={k} className="wh-row">
              <span className="wh-skeleton" style={{ width: 36, height: 36, borderRadius: 12 }} />
              <span className="wh-skeleton" style={{ flex: '1 1 auto', height: 14 }} />
            </div>
          ))}
        </Card>
      )}
      {catalog.isError && (
        <Note tone="risk" title="The catalogue could not be loaded">
          {errorText(catalog.error, 'Try again in a moment.')}
        </Note>
      )}

      {current && !q && (
        <div className="wh-cat-head">
          <div>
            <h2 className="wh-serif" style={{ margin: 0, fontSize: 26 }}>
              {current.name}
            </h2>
            <p className="wh-caption" style={{ marginTop: 4 }}>
              {current.description}
              {supported > 0 ? ` ${supported} with a live link in ${countryName}.` : ''}
            </p>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <Card kind="list">
          {rows.map((i) => (
            <Row
              key={i.id}
              onClick={() => onPick(i)}
              token={<InstitutionToken i={i} />}
              title={i.name}
              sub={methodLine(i)}
              right={
                i.method === 'manual' ? (
                  <span className="wh-chip neutral plain" style={{ fontSize: 12 }}>
                    By hand
                  </span>
                ) : i.available ? (
                  <span className="wh-chip gain plain" style={{ fontSize: 12 }}>
                    Read-only
                  </span>
                ) : (
                  <span className="wh-chip stone plain" style={{ fontSize: 12 }}>
                    Keys needed
                  </span>
                )
              }
              trailing={<Icon name={ICONS.ui.chevronRight} size={16} className="wh-row-chev" />}
            />
          ))}
        </Card>
      )}
      {!catalog.isLoading && rows.length === 0 && (
        <Note tone="plain" icon={ICONS.action.search}>
          Nothing matches. Try another spelling, another country, or “Another bank” and “Positions by hand” in Banks and Brokers.
        </Note>
      )}
    </div>
  )
}

/* ---------------- Step 2: one form per method ---------------- */

function FormHead({ i, onBack }: { i: CatalogInstitution; onBack: () => void }) {
  const ro = i.method !== 'manual'
  return (
    <div className="wh-connect-head">
      <RoundButton icon={ICONS.ui.back} label="Choose another source" flat onClick={onBack} />
      <InstitutionToken i={i} size={46} />
      <div style={{ minWidth: 0 }}>
        <div className="wh-connect-title">{i.name}</div>
        <div className={`wh-connect-ro${ro ? '' : ' hand'}`}>
          <Icon name={ro ? ICONS.status.readOnly : ICONS.action.edit} size={14} />
          {methodLine(i)}
        </div>
      </div>
    </div>
  )
}

/** A link that is not switched on for this deployment: say so, offer the hand-kept route. */
function Unavailable({ i, onBack, onManual }: { i: CatalogInstitution; onBack: () => void; onManual: () => void }) {
  const what = i.connector === 'gocardless' ? 'Bank links need GoCardless keys on the server' : 'Broker links need SnapTrade keys on the server'
  return (
    <Card kind="pad">
      <FormHead i={i} onBack={onBack} />
      <Note tone="info" title={`${what}.`} className="wh-connect-note">
        Until then, keep {i.name} by hand. It still counts in every total and the app reminds you when the figure looks old.
      </Note>
      <div className="wh-form-actions" style={{ marginTop: 14 }}>
        <Button icon={ICONS.action.edit} onClick={onManual}>
          Keep {i.category === 'brokers' ? 'positions' : 'the balance'} by hand
        </Button>
      </div>
    </Card>
  )
}

/** A broker or an exchange through the SnapTrade portal: one button, then straight back here. */
function PortalForm({ i, onBack, onDone }: { i: CatalogInstitution; onBack: () => void; onDone: () => void }) {
  const connect = useSnaptradeConnect()
  const importAccts = useSnaptradeImport()
  const limit = isPlanLimit(importAccts.error)
  function start() {
    const customRedirect = `${window.location.origin}${R.connect}?snaptrade=done`
    connect.mutate({ broker: i.ref, customRedirect }, { onSuccess: (d) => d.redirectUrl && window.location.assign(d.redirectUrl) })
  }
  return (
    <Card kind="pad">
      <FormHead i={i} onBack={onBack} />
      <p className="wh-connect-p">Read-only, through SnapTrade. You sign in on {i.name}'s own page; Wealth Hub never sees your password and cannot place an order.</p>
      <ol className="wh-steps">
        <li>
          <b>Sign in on {i.name}'s page</b>
          <span>The portal opens in read mode. Approve the read-only connection there.</span>
        </li>
        <li>
          <b>Come straight back</b>
          <span>Your accounts are imported the moment you land here.</span>
        </li>
      </ol>
      {connect.isError && <p className="wh-err">{errorText(connect.error, 'The portal could not be opened.')}</p>}
      {limit ? <UpgradeNote /> : importAccts.isError && <p className="wh-err">{errorText(importAccts.error, 'Import failed.')}</p>}
      <div className="wh-form-actions" style={{ marginTop: 14 }}>
        <Button icon={ICONS.ui.openInNew} size="lg" disabled={connect.isPending} onClick={start}>
          {connect.isPending ? 'Opening' : `Continue to ${i.name}`}
        </Button>
        <Button variant="tertiary" disabled={importAccts.isPending} onClick={() => importAccts.mutate(undefined, { onSuccess: (d) => (d.imported?.length ?? 0) > 0 && onDone() })}>
          {importAccts.isPending ? 'Importing' : 'Already linked? Import'}
        </Button>
      </div>
      {importAccts.data?.message && <p className="wh-caption" style={{ marginTop: 10 }}>{importAccts.data.message}</p>}
    </Card>
  )
}

/** A bank through open banking: consent on the bank's page, then straight back here. */
function BankLinkForm({ i, onBack }: { i: CatalogInstitution; onBack: () => void }) {
  const start = useGocardlessStart()
  function go() {
    if (!i.ref) return
    const redirect = `${window.location.origin}${R.connect}?gocardless=done`
    start.mutate({ institutionId: i.ref, redirect }, { onSuccess: (d) => window.location.assign(d.url) })
  }
  return (
    <Card kind="pad">
      <FormHead i={i} onBack={onBack} />
      <p className="wh-connect-p">Read-only, through GoCardless open banking. You give consent on {i.name}'s own page for balances and transactions; nothing can be moved, and the consent expires by itself after 90 days.</p>
      <ol className="wh-steps">
        <li>
          <b>Consent on {i.name}'s page</b>
          <span>Your bank's own login, in read mode. Wealth Hub never sees your credentials.</span>
        </li>
        <li>
          <b>Come straight back</b>
          <span>Accounts land on the ledger with their balance; transactions can fill the cash flow next.</span>
        </li>
      </ol>
      {start.isError && <p className="wh-err">{errorText(start.error, 'The bank could not be reached.')}</p>}
      <div className="wh-form-actions" style={{ marginTop: 14 }}>
        <Button icon={ICONS.ui.openInNew} size="lg" disabled={start.isPending || !i.ref} onClick={go}>
          {start.isPending ? 'Opening' : `Continue to ${i.name}`}
        </Button>
      </div>
    </Card>
  )
}

/** A wallet by public key or address. */
function WalletForm({ i, onBack }: { i: CatalogInstitution; onBack: () => void }) {
  const add = useAddWatchWallet()
  const { money } = useFigures()
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [found, setFound] = useState<Account | null>(null)
  const name = i.name.toLowerCase()
  const placeholder = /ethereum/.test(name) ? '0x…' : /solana/.test(name) ? 'A Solana address' : 'bc1q… or xpub…'
  const hardware = /ledger|trezor/.test(name)
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!key.trim()) return
    add.mutate({ key: key.trim(), label: label.trim() || undefined, institution: hardware ? i.name : undefined }, { onSuccess: (a) => setFound(a) })
  }
  const holdings = found?.holdings ?? []
  return (
    <>
      <Card kind="pad">
        <FormHead i={i} onBack={onBack} />
        <p className="wh-connect-p">{hardware ? `Paste an address or xpub from ${i.name}'s app. Your keys stay on the device. We never ask for your recovery phrase.` : 'Paste an address or an account key. Nothing that can sign ever leaves your device.'}</p>
        <form onSubmit={submit} className="wh-form" aria-label="Add a watch-only wallet">
          <Field icon={ICONS.account.hardwareWallet} label="Address or xpub" placeholder={placeholder} value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} hint="Bitcoin addresses and xpub, ypub or zpub keys, Ethereum and Solana addresses." variant="lg" />
          <Field icon={ICONS.action.edit} label="Name" placeholder="Optional" value={label} onChange={(e) => setLabel(e.target.value)} />
          {isPlanLimit(add.error) ? <UpgradeNote /> : add.isError && <p className="wh-err">{errorText(add.error, 'This key or address is not recognised.')}</p>}
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
function BalanceForm({ i, kind, onBack, onDone }: { i: CatalogInstitution; kind: 'bank' | 'pension' | 'property' | 'loan'; onBack: () => void; onDone: () => void }) {
  const add = useAddManualAccount()
  const named = Boolean(i.domain || i.logo)
  const [label, setLabel] = useState(named ? i.name : '')
  const [institution, setInstitution] = useState(named ? i.name : '')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState(/mortgage/i.test(i.name) ? 'Mortgage' : '')
  const [currency, setCurrency] = useState('CHF')
  const copy = {
    bank: { name: named ? `${i.name}, everyday account` : 'Everyday account', amount: 'Current balance', icon: ICONS.account.bank },
    pension: { name: named ? `${i.name} 3a` : 'Pillar 3a', amount: 'Current value', icon: ICONS.assetClass.pension },
    property: { name: 'Apartment', amount: 'Estimated value', icon: ICONS.assetClass.property },
    loan: { name: /mortgage/i.test(i.name) ? 'Mortgage' : 'Car loan', amount: 'Outstanding balance', icon: ICONS.account.mortgage },
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
      <p className="wh-connect-p">{i.note ?? 'Enter the figure. The app reminds you when it looks old.'}</p>
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
function HoldingsForm({ i, onBack, onDone }: { i: CatalogInstitution; onBack: () => void; onDone: () => void }) {
  const add = useAddManualAccount()
  const { money } = useFigures()
  const named = Boolean(i.domain || i.logo)
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
      <p className="wh-connect-p">{i.note ?? 'Tickers, quantities and prices you keep yourself. Prices refresh from the market where a symbol is known.'}</p>
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
  const importTx = useImportTransactions()
  const { money } = useFigures()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(a.name)
  const [confirm, setConfirm] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlight])
  const live = a.account.provider !== 'manual'
  const bank = a.account.provider === 'gocardless'
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
        sub={importTx.data ? `${importTx.data.imported} transactions imported, ${importTx.data.skipped} already there` : sub}
        value={a.liability ? money(-a.value) : money(a.value)}
        valueTone={a.liability ? 'owed' : undefined}
        delta={a.broken ? <span className="wh-owed">needs attention</span> : live && !a.sample ? a.freshLabel : undefined}
        trailing={
          a.sample ? undefined : (
            <Menu
              label={`Actions for ${a.name}`}
              items={[
                ...(live ? [{ key: 'sync', label: sync.isPending ? 'Syncing' : 'Sync now', icon: ICONS.ui.refresh, onSelect: () => sync.mutate(a.id), disabled: sync.isPending }] : []),
                ...(bank ? [{ key: 'tx', label: importTx.isPending ? 'Importing' : 'Import transactions', sub: 'Into cash flow, last 90 days', icon: ICONS.nav.cashflow, onSelect: () => importTx.mutate({ id: a.id, days: 90 }), disabled: importTx.isPending }] : []),
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

type Step = { i: CatalogInstitution; method: 'link' | 'key' | 'manual'; manualKind?: CatalogInstitution['manualKind'] }

export function Connect() {
  const desktop = useDesktop()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const book = useBook()
  const importAccts = useSnaptradeImport()
  const finishBank = useGocardlessFinish()
  const [country, setCountryState] = useState(readCountry)
  const [step, setStep] = useState<Step | null>(null)
  const [returned, setReturned] = useState<{ count: number; what: string } | null>(null)
  const highlightId = location.hash ? location.hash.slice(1) : null

  useEffect(() => {
    document.title = 'Connect · Wealth Hub'
  }, [])

  function setCountry(c: string) {
    setCountryState(c)
    try {
      localStorage.setItem(COUNTRY_KEY, c)
    } catch {
      /* ignore */
    }
  }

  // Back from a portal: import straight away, once.
  const handled = useRef(false)
  useEffect(() => {
    if (handled.current) return
    if (params.get('snaptrade') === 'done') {
      handled.current = true
      importAccts.mutate(undefined, {
        onSuccess: (d) => setReturned({ count: d.imported?.length ?? 0, what: 'broker' }),
        onSettled: () => setParams({}, { replace: true }),
      })
    } else if (params.get('gocardless') === 'done' && params.get('ref')) {
      handled.current = true
      finishBank.mutate(params.get('ref')!, {
        onSuccess: (d) => setReturned({ count: d.imported?.length ?? 0, what: d.institution }),
        onSettled: () => setParams({}, { replace: true }),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const done = () => navigate(R.overview)
  const back = () => setStep(null)
  const pick = (i: CatalogInstitution) => setStep({ i, method: i.method, manualKind: i.manualKind })
  const manualKindFor = (i: CatalogInstitution): NonNullable<CatalogInstitution['manualKind']> => i.manualKind ?? (i.category === 'brokers' || i.category === 'exchanges' ? 'holdings' : i.category === 'pensions' ? 'pension' : i.category === 'property' ? 'property' : i.category === 'debts' ? 'loan' : 'bank')

  let form: React.ReactNode = null
  if (step) {
    const { i, method } = step
    if (method === 'link' && !i.available) form = <Unavailable i={i} onBack={back} onManual={() => setStep({ i, method: 'manual', manualKind: manualKindFor(i) })} />
    else if (method === 'link' && i.connector === 'gocardless') form = <BankLinkForm i={i} onBack={back} />
    else if (method === 'link') form = <PortalForm i={i} onBack={back} onDone={done} />
    else if (method === 'key') form = <WalletForm i={i} onBack={back} />
    else {
      const kind = step.manualKind ?? manualKindFor(i)
      form = kind === 'holdings' || kind === 'broker' ? <HoldingsForm i={i} onBack={back} onDone={done} /> : <BalanceForm i={i} kind={kind === 'bank' ? 'bank' : kind === 'pension' ? 'pension' : kind === 'property' ? 'property' : 'loan'} onBack={back} onDone={done} />
    }
  }

  const busy = importAccts.isPending || finishBank.isPending
  const failed = importAccts.isError || finishBank.isError
  const limit = isPlanLimit(importAccts.error) || isPlanLimit(finishBank.error)
  const returnedNote = limit ? (
    <UpgradeNote />
  ) : (
    (returned || busy || failed) && (
      <Note
        tone={busy ? 'info' : failed ? 'risk' : 'plain'}
        icon={busy ? ICONS.status.syncing : failed ? ICONS.status.failed : ICONS.status.synced}
        title={busy ? 'Importing your accounts' : failed ? 'The link did not complete' : returned && returned.count > 0 ? `${returned.count} ${returned.count === 1 ? 'account' : 'accounts'} imported from ${returned.what}` : 'Nothing new to import'}
      >
        {busy ? 'Back from the portal. Reading what was linked.' : failed ? errorText(importAccts.error ?? finishBank.error, 'Try the link again.') : returned && returned.count > 0 ? 'They sit on the ledger now and sync on their own.' : 'If you just linked an account, give it a minute and try the import again from its page.'}
      </Note>
    )
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
          No recovery phrases, no passwords stored
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
        <ScreenHeader title="Connect" lead={<RoundButton icon={ICONS.ui.back} label="Back" onClick={() => (step ? back() : navigate(R.overview))} />} />
        {returnedNote}
        {form ?? <Picker country={country} onCountry={setCountry} onPick={pick} />}
        {!step && sources}
        {!step && promise}
      </div>
    )
  }
  return (
    <div className="wh-screen">
      <ScreenHeader title="Connect" subtitle="Pick a category, find the institution, and the safest way in is chosen for you." />
      <div className="wh-grid">
        <div className="wh-col">
          {returnedNote}
          {form ?? <Picker country={country} onCountry={setCountry} onPick={pick} />}
        </div>
        <div className="wh-col">
          {sources}
          {promise}
        </div>
      </div>
    </div>
  )
}
