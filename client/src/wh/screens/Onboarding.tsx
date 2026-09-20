import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { Lockup } from '@/wh/Mark'
import { Button, Field } from '@/wh/controls'
import { useAuth, errorText } from '@/auth/AuthContext'
import { useDemo } from '@/wealth/DemoContext'
import { useSettings, useUpdateSettings, type DisplayCurrency } from '@/hooks/useSettings'
import { R } from '@/routes'
import '@/wh/screens/screens.css'

const CURRENCIES: Array<{ id: DisplayCurrency; name: string; note: string }> = [
  { id: 'CHF', name: 'Swiss franc', note: 'CHF' },
  { id: 'EUR', name: 'Euro', note: 'EUR' },
  { id: 'USD', name: 'US dollar', note: 'USD' },
  { id: 'GBP', name: 'Pound sterling', note: 'GBP' },
]

/** Three short steps the first time in: a name, a currency, and whether to see the sample while the ledger fills. */
export function Onboarding() {
  const navigate = useNavigate()
  const { user, update } = useAuth()
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const { enabled: sampleOn, toggle: toggleSample } = useDemo()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(user?.name ?? '')
  const [currency, setCurrency] = useState<DisplayCurrency>(settings?.displayCurrency ?? 'CHF')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [leaving, setLeaving] = useState<string | null>(null)
  const [touchedCurrency, setTouchedCurrency] = useState(false)

  useEffect(() => {
    document.title = 'Welcome · Wealth Hub'
  }, [])
  useEffect(() => {
    if (user?.name && !name) setName(user.name)
  }, [user?.name, name])
  // The saved currency arrives after the first render; adopt it unless a choice was already made.
  useEffect(() => {
    if (!touchedCurrency && settings?.displayCurrency) setCurrency(settings.displayCurrency)
  }, [settings?.displayCurrency, touchedCurrency])
  // Leave only once the session carries the flag, so the shell never bounces back here.
  useEffect(() => {
    if (leaving && user?.onboardedAt) navigate(leaving, { replace: true })
  }, [leaving, user?.onboardedAt, navigate])

  async function finish(then: string) {
    setBusy(true)
    setErr(null)
    try {
      if (currency !== settings?.displayCurrency) await updateSettings.mutateAsync({ displayCurrency: currency })
      await update({ name: name.trim() || user?.name || 'You', onboarded: true })
      setLeaving(then)
    } catch (x) {
      setErr(errorText(x, 'Could not save. Try again.'))
      setBusy(false)
    }
  }

  function next(e?: FormEvent) {
    e?.preventDefault()
    setStep((s) => Math.min(2, s + 1))
  }

  return (
    <div className="wh-onboard">
      <Lockup size={22} />
      <div className="wh-onboard-steps" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <i key={i} className={i <= step ? 'on' : undefined} />
        ))}
      </div>

      {step === 0 && (
        <form onSubmit={next} className="wh-form" style={{ gap: 20 }} aria-label="Your name">
          <div>
            <h1>What should we call you?</h1>
            <p className="lead" style={{ marginTop: 8 }}>
              Your name shows in the corner and on exports. Nothing else.
            </p>
          </div>
          <Field icon={ICONS.ui.person} label="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" autoFocus maxLength={80} variant="lg" />
          <div className="wh-form-actions">
            <Button type="submit" size="lg" disabled={!name.trim()} icon={ICONS.ui.forward}>
              Continue
            </Button>
          </div>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={next} className="wh-form" style={{ gap: 20 }} aria-label="Display currency">
          <div>
            <h1>One currency for everything</h1>
            <p className="lead" style={{ marginTop: 8 }}>
              Balances stay in the currency their source reports. Every total converts into this one at today's rate.
            </p>
          </div>
          <div className="wh-choice" role="radiogroup" aria-label="Display currency">
            {CURRENCIES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={currency === c.id}
                className={`wh-choice-btn${currency === c.id ? ' on' : ''}`}
                onClick={() => {
                  setTouchedCurrency(true)
                  setCurrency(c.id)
                }}
              >
                <Icon name={ICONS.account.exchange} size={18} />
                <b>{c.name}</b>
                <span>{c.note}</span>
              </button>
            ))}
          </div>
          <div className="wh-form-actions">
            <Button type="submit" size="lg" icon={ICONS.ui.forward}>
              Continue
            </Button>
            <Button variant="tertiary" onClick={() => setStep(0)}>
              Back
            </Button>
          </div>
        </form>
      )}

      {step === 2 && (
        <div className="wh-form" style={{ gap: 20 }}>
          <div>
            <h1>Start with your own accounts, or look around first</h1>
            <p className="lead" style={{ marginTop: 8 }}>
              Connect a bank, a broker, a pension or a hardware wallet, read-only. Or keep a sample household on while you explore; it sits beside anything you connect and switches off in Settings.
            </p>
          </div>
          <div className="wh-choice">
            <button type="button" className={`wh-choice-btn${!sampleOn ? ' on' : ''}`} onClick={() => sampleOn && toggleSample()} aria-pressed={!sampleOn}>
              <Icon name={ICONS.nav.connections} size={18} />
              <b>Just my accounts</b>
              <span>An empty ledger that fills as you connect.</span>
            </button>
            <button type="button" className={`wh-choice-btn${sampleOn ? ' on' : ''}`} onClick={() => !sampleOn && toggleSample()} aria-pressed={sampleOn}>
              <Icon name={ICONS.action.education} size={18} />
              <b>Show the sample household</b>
              <span>Example accounts and cash flow, clearly marked.</span>
            </button>
          </div>
          {err && <p className="wh-err">{err}</p>}
          <div className="wh-form-actions">
            <Button size="lg" icon={ICONS.action.add} disabled={busy} onClick={() => finish(R.connect)}>
              Connect an account
            </Button>
            <Button size="lg" variant="secondary" disabled={busy} onClick={() => finish(R.overview)}>
              Go to the overview
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
