import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { Lockup } from '@/wh/Mark'
import { LivingMark } from '@/wh/LivingMark'
import { DotField } from '@/wh/effects/DotField'
import { Button, Field } from '@/wh/controls'
import { useAuth, errorText } from '@/auth/AuthContext'
import { R, safeNext } from '@/routes'
import './site.css'

/** The garden, drawn as a screen of dots that answers the pointer, with the line on a plate. */
function Side() {
  return (
    <aside className="auth-side" aria-hidden="true">
      <DotField image="/wh/images/garden-dots-marble.png" darkImage="/wh/images/garden-dots-night.png" position={[46, 50]} />
      <div className="auth-side-lockup">
        <Lockup size={22} />
      </div>
      <div className="auth-side-line">Own the whole picture.</div>
    </aside>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-main" style={{ position: 'relative' }}>
        <Link to={R.home} className="auth-back wh-btn tertiary sm" aria-label="Back to the site">
          <Icon name={ICONS.ui.back} size={16} />
          Wealth Hub
        </Link>
        <div className="auth-card">{children}</div>
      </div>
      <Side />
    </div>
  )
}

function Strip() {
  return (
    <div className="auth-strip">
      <span>
        <Icon name={ICONS.status.readOnly} size={16} />
        Read-only
      </span>
      <span>
        <Icon name={ICONS.action.export} size={16} />
        Export any time
      </span>
      <span>
        <Icon name={ICONS.action.education} size={16} />
        Analysis, not advice
      </span>
    </div>
  )
}

function Reveal({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="wh-round flat" style={{ width: 32, height: 32 }} onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
      <Icon name={show ? ICONS.ui.hide : ICONS.ui.show} size={18} />
    </button>
  )
}

export function SignIn() {
  const [params] = useSearchParams()
  const { status, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const next = safeNext(params.get('next'))

  useEffect(() => {
    document.title = 'Sign in · Wealth Hub'
  }, [])

  if (status === 'in') return <Navigate to={next} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      // The session update lands a tick later and the redirect above follows it.
      await login(email.trim(), password)
    } catch (x) {
      setErr(errorText(x, 'Sign in did not work. Try again.'))
      setBusy(false)
    }
  }

  return (
    <Frame>
      <LivingMark width={96} decorative />
      <div>
        <h1>Welcome back</h1>
        <p className="site-p">Sign in to your ledger. Nothing on this side can move your money.</p>
      </div>
      <form onSubmit={submit} className="wh-form" aria-label="Sign in" style={{ gap: 14 }}>
        <Field icon={ICONS.action.email} label="Email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} variant="lg" />
        <Field icon={ICONS.ui.lock} label="Password" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} variant="lg" trailing={<Reveal show={show} onToggle={() => setShow((v) => !v)} />} />
        {err && (
          <p className="wh-err" role="alert">
            {err}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={busy || !email || !password} icon={ICONS.ui.forward}>
          {busy ? 'Signing in' : 'Sign in'}
        </Button>
      </form>
      <p className="auth-foot">
        New here? <Link to={R.signup}>Create an account</Link>
      </p>
      <Strip />
    </Frame>
  )
}

export function SignUp() {
  const { status, signup, signupWith } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Create an account · Wealth Hub'
  }, [])

  if (status === 'in') return <Navigate to={R.welcome} replace />

  const closed = signup === 'closed'
  const invited = signup === 'invite'
  const ok = email.trim().length > 3 && password.length >= 10 && (!invited || invite.trim().length > 0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ok) return
    setBusy(true)
    setErr(null)
    try {
      await signupWith({ email: email.trim(), password, name: name.trim() || undefined, inviteCode: invited ? invite.trim() : undefined })
    } catch (x) {
      setErr(errorText(x, 'Could not create the account. Try again.'))
      setBusy(false)
    }
  }

  return (
    <Frame>
      <LivingMark width={96} decorative />
      <div>
        <h1>Create your account</h1>
        <p className="site-p">Two minutes, no card. Start with a sample household, then connect your own.</p>
      </div>
      {closed ? (
        <p className="wh-note plain" style={{ display: 'block' }}>
          Sign-ups are closed on this deployment. If someone runs it for you, ask them for access.
        </p>
      ) : (
        <form onSubmit={submit} className="wh-form" aria-label="Create an account" style={{ gap: 14 }}>
          <Field icon={ICONS.ui.person} label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} variant="lg" maxLength={80} placeholder="Optional" />
          <Field icon={ICONS.action.email} label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} variant="lg" />
          <Field icon={ICONS.ui.lock} label="Password" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} variant="lg" hint="At least 10 characters. A sentence works well." trailing={<Reveal show={show} onToggle={() => setShow((v) => !v)} />} />
          {invited && <Field icon={ICONS.action.passkey} label="Invite code" required value={invite} onChange={(e) => setInvite(e.target.value)} variant="lg" hint="This deployment is invite-only. The person who runs it has the code." autoComplete="off" />}
          {err && (
            <p className="wh-err" role="alert">
              {err}
            </p>
          )}
          <Button type="submit" size="lg" full disabled={busy || !ok} icon={ICONS.ui.forward}>
            {busy ? 'Creating' : 'Create account'}
          </Button>
          <p className="site-fine" style={{ marginTop: 0 }}>
            By continuing you agree to the <Link to={R.terms}>terms</Link> and the <Link to={R.privacy}>privacy notes</Link>.
          </p>
        </form>
      )}
      <p className="auth-foot">
        Already have an account? <Link to={R.login}>Sign in</Link>
      </p>
      <Strip />
    </Frame>
  )
}
