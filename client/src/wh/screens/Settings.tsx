import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { Button, Field, RoundButton, Segmented, Switch } from '@/wh/controls'
import { Card } from '@/wh/layout'
import { useAppearance, type Appearance } from '@/wh/ground'
import { useDesktop } from '@/wh/useMediaQuery'
import { useAuth, errorText } from '@/auth/AuthContext'
import { usePrivacy } from '@/wealth/PrivacyContext'
import { useDemo } from '@/wealth/DemoContext'
import { useSettings, useUpdateSettings, type DisplayCurrency, type HeadlineMetric } from '@/hooks/useSettings'
import { R } from '@/routes'
import { ScreenHeader } from './ScreenHeader'
import '@/wh/screens/screens.css'

const CURRENCY_NAMES: Record<DisplayCurrency, string> = { CHF: 'Swiss franc', EUR: 'Euro', USD: 'US dollar', GBP: 'Pound sterling' }
const METRIC_COPY: Record<HeadlineMetric, string> = { net: 'Net worth', financial: 'Financial assets', gross: 'Gross assets' }
const APPEARANCES: ReadonlyArray<{ value: Appearance; label: string }> = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

function Row({ icon, title, sub, children }: { icon: Parameters<typeof Icon>[0]['name']; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="wh-settings-row">
      <Icon name={icon} size={18} />
      <span className="wh-settings-text">
        <b>{title}</b>
        {sub && <span>{sub}</span>}
      </span>
      {children}
    </div>
  )
}

function Profile() {
  const { user, update } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => setName(user?.name ?? ''), [user?.name])
  const dirty = name.trim() !== (user?.name ?? '') && name.trim().length > 0
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!dirty) return
    setBusy(true)
    setErr(null)
    try {
      await update({ name: name.trim() })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (x) {
      setErr(errorText(x, 'Could not save your name.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="wh-form" aria-label="Profile">
      <div className="wh-form-row">
        <Field icon={ICONS.ui.person} label="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
        <Field icon={ICONS.action.email} label="Email" value={user?.email ?? ''} readOnly hint="Used to sign in. Contact support to change it." />
      </div>
      {err && <p className="wh-err">{err}</p>}
      <div className="wh-form-actions">
        <Button type="submit" size="sm" disabled={!dirty || busy}>
          {busy ? 'Saving' : 'Save'}
        </Button>
        {saved && (
          <span className="wh-ok">
            <Icon name={ICONS.ui.check} size={16} />
            Saved
          </span>
        )}
      </div>
    </form>
  )
}

function Password() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const ok = current.length > 0 && next.length >= 10
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ok) return
    setBusy(true)
    setErr(null)
    try {
      await axios.post('/api/auth/password', { currentPassword: current, newPassword: next })
      setCurrent('')
      setNext('')
      setDone(true)
      setTimeout(() => setDone(false), 3000)
    } catch (x) {
      setErr(errorText(x, 'Could not change the password.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="wh-form" aria-label="Change password">
      <div className="wh-form-row">
        <Field icon={ICONS.ui.lock} label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Field icon={ICONS.action.passkey} label="New password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} hint="At least 10 characters. Other devices are signed out." />
      </div>
      {err && <p className="wh-err">{err}</p>}
      <div className="wh-form-actions">
        <Button type="submit" size="sm" variant="secondary" disabled={!ok || busy}>
          {busy ? 'Changing' : 'Change password'}
        </Button>
        {done && (
          <span className="wh-ok">
            <Icon name={ICONS.ui.check} size={16} />
            Password changed
          </span>
        )}
      </div>
    </form>
  )
}

function DeleteAccount() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await axios.delete('/api/auth/me', { data: { password } })
      await logout()
      navigate(R.home, { replace: true })
    } catch (x) {
      setErr(errorText(x, 'Could not delete the account.'))
      setBusy(false)
    }
  }
  if (!open) {
    return (
      <Row icon={ICONS.ui.remove} title="Delete account" sub="Removes every connection, balance and setting. There is no undo.">
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Delete
        </Button>
      </Row>
    )
  }
  return (
    <form onSubmit={submit} className="wh-form" aria-label="Delete account">
      <p className="wh-body" style={{ fontSize: 14 }}>
        Type your password to delete your account and everything in it. Export first if you want a copy.
      </p>
      <Field icon={ICONS.ui.lock} label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
      {err && <p className="wh-err">{err}</p>}
      <div className="wh-form-actions">
        <Button type="submit" size="sm" variant="danger" disabled={!password || busy}>
          {busy ? 'Deleting' : 'Delete my account'}
        </Button>
        <Button size="sm" variant="tertiary" onClick={() => setOpen(false)}>
          Keep it
        </Button>
      </div>
    </form>
  )
}

export function Settings() {
  const desktop = useDesktop()
  const navigate = useNavigate()
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const { appearance, setAppearance } = useAppearance()
  const { hidden, toggle: togglePrivacy } = usePrivacy()
  const { enabled: sampleOn, toggle: toggleSample } = useDemo()

  useEffect(() => {
    document.title = 'Settings · Wealth Hub'
  }, [])

  const currencies = settings?.currencies ?? ['CHF', 'EUR', 'USD', 'GBP']
  const display = settings?.displayCurrency ?? 'CHF'
  const metric = settings?.headlineMetric ?? 'net'

  return (
    <div className="wh-screen">
      <ScreenHeader title="Settings" subtitle="Your account, how figures read, and what the app looks like." lead={!desktop ? <RoundButton icon={ICONS.ui.back} label="Back" onClick={() => navigate(-1)} /> : undefined} />
      <div className="wh-settings">
        <section className="wh-settings-group">
          <h2>Account</h2>
          <Card kind="pad">
            <Profile />
          </Card>
        </section>

        <section className="wh-settings-group">
          <h2>Figures</h2>
          <Card kind="bare" style={{ padding: '2px 18px' }}>
            <Row icon={ICONS.account.exchange} title="Display currency" sub={`Every total converts into ${CURRENCY_NAMES[display]} at today's rate.`}>
              <div className="wh-seg" role="radiogroup" aria-label="Display currency" style={{ minWidth: 0 }}>
                {currencies.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={c === display} className={`wh-seg-btn${c === display ? ' on' : ''}`} onClick={() => update.mutate({ displayCurrency: c })} disabled={update.isPending}>
                    {c}
                  </button>
                ))}
              </div>
            </Row>
            <Row icon={ICONS.figure.own} title="Headline figure" sub="What the overview leads with.">
              <Segmented
                options={(settings?.metrics ?? ['net', 'financial', 'gross']).map((m) => ({ value: m, label: METRIC_COPY[m] }))}
                value={metric}
                onChange={(m) => update.mutate({ headlineMetric: m })}
                label="Headline figure"
              />
            </Row>
            <Row icon={ICONS.ui.hide} title="Hide balances" sub="Masks every figure until you show them again.">
              <Switch on={hidden} onChange={togglePrivacy} label="Hide balances" />
            </Row>
            <Row icon={ICONS.action.education} title="Sample household" sub="Example accounts beside your own, to see the whole product.">
              <Switch on={sampleOn} onChange={toggleSample} label="Sample household" />
            </Row>
          </Card>
          {(settings?.warnings?.length ?? 0) > 0 && <p className="wh-caption">{settings!.warnings.join(' ')}</p>}
        </section>

        <section className="wh-settings-group">
          <h2>Appearance</h2>
          <Card kind="bare" style={{ padding: '2px 18px' }}>
            <Row icon={ICONS.ui.show} title="Theme" sub="Auto follows your device.">
              <Segmented options={APPEARANCES} value={appearance} onChange={setAppearance} label="Theme" />
            </Row>
          </Card>
        </section>

        <section className="wh-settings-group">
          <h2>Security</h2>
          <Card kind="pad">
            <Password />
          </Card>
        </section>

        <section className="wh-settings-group">
          <h2>Your data</h2>
          <Card kind="bare" style={{ padding: '2px 18px' }}>
            <Row icon={ICONS.action.export} title="Export everything" sub="Accounts, settings, transactions, goals and history as one JSON file.">
              <Button size="sm" variant="secondary" icon={ICONS.action.export} href="/api/export">
                Export
              </Button>
            </Row>
            <Row icon={ICONS.nav.connections} title="Connections" sub="Sync, rename or disconnect a source.">
              <Button size="sm" variant="secondary" to={R.connect}>
                Open
              </Button>
            </Row>
          </Card>
          <Card kind="bare" className="wh-danger-zone" style={{ padding: '2px 18px' }}>
            <DeleteAccount />
          </Card>
        </section>
      </div>
    </div>
  )
}
