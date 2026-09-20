import { useEffect } from 'react'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { Token } from '@/wh/Token'
import { Lockup } from '@/wh/Mark'
import { DotField } from '@/wh/effects/DotField'
import { Button } from '@/wh/controls'
import { useAuth } from '@/auth/AuthContext'
import { R } from '@/routes'
import { CashflowPreview, GrowPreview, HoldingsPreview, OverviewPreview } from './Preview'

const WORKS_WITH: Array<{ name: string; domain?: string; classId: 'broker' | 'exchange' | 'wallet' | 'bank' | 'pension' }> = [
  { name: 'Interactive Brokers', domain: 'interactivebrokers.com', classId: 'broker' },
  { name: 'Charles Schwab', domain: 'schwab.com', classId: 'broker' },
  { name: 'DEGIRO', domain: 'degiro.com', classId: 'broker' },
  { name: 'Coinbase', domain: 'coinbase.com', classId: 'exchange' },
  { name: 'Kraken', domain: 'kraken.com', classId: 'exchange' },
  { name: 'Ledger', domain: 'ledger.com', classId: 'wallet' },
  { name: 'UBS', domain: 'ubs.com', classId: 'bank' },
  { name: 'Revolut', domain: 'revolut.com', classId: 'bank' },
  { name: 'VIAC', domain: 'viac.ch', classId: 'pension' },
]

export function Landing() {
  const { status } = useAuth()
  const signedIn = status === 'in'
  useEffect(() => {
    document.title = 'Wealth Hub · Every account, one clear picture'
  }, [])
  return (
    <main>
      <section className="site-hero">
        <div className="site-wrap site-center">
          <p className="site-kicker">Personal wealth, in one ledger</p>
          <h1 className="site-h1">Every account. One clear picture.</h1>
          <p className="site-lead">Wealth Hub brings your banks, brokers, pensions, property and crypto together, read-only, in your currency. What you own, what you owe, and what is worth changing.</p>
          <div className="site-cta">
            {signedIn ? (
              <Button size="lg" to={R.overview} icon={ICONS.ui.forward}>
                Open Wealth Hub
              </Button>
            ) : (
              <>
                <Button size="lg" to={R.signup} icon={ICONS.ui.forward}>
                  Get started
                </Button>
                <Button size="lg" variant="secondary" to={R.security}>
                  How it stays safe
                </Button>
              </>
            )}
          </div>
          <p className="site-fine">Free while in preview. No card, no trading permissions, no recovery phrases. Ever.</p>
          <DotField className="site-garden" image="/wh/images/garden-dots-marble.png" darkImage="/wh/images/garden-dots-night.png" position={[46, 46]} spacing={5} alt="A classical garden with a temple, a statue and cypresses, drawn in blue dots">
            <div className="site-garden-lockup" aria-hidden="true">
              <Lockup size={22} />
            </div>
            <div className="site-garden-line" aria-hidden="true">
              Own the whole picture.
            </div>
          </DotField>
          <div className="site-frame" aria-label="The overview, on a sample household">
            <div className="site-frame-bar" aria-hidden="true">
              <i />
              <i />
              <i />
              <span>Overview · sample household</span>
            </div>
            <div className="site-frame-body">
              <OverviewPreview />
            </div>
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap">
          <p className="site-kicker">The whole picture</p>
          <h2 className="site-h2">Built to be read in ten seconds.</h2>
          <p className="site-lead">Three figures at the top, every source underneath, and a chart that only draws what actually happened. Nothing is estimated, rounded up or invented.</p>
          <div className="site-grid">
            <div className="site-feature">
              <span className="site-feature-icon">
                <Icon name={ICONS.nav.holdings} size={20} />
              </span>
              <h3 className="site-h3">Every position, one list</h3>
              <p className="site-p">Funds, stocks, cash and coins from every account, with the class, the place it is held and the last thirty days.</p>
              <div className="site-feature-art">
                <HoldingsPreview />
              </div>
            </div>
            <div className="site-feature">
              <span className="site-feature-icon">
                <Icon name={ICONS.nav.cashflow} size={20} />
              </span>
              <h3 className="site-h3">Where the month went</h3>
              <p className="site-p">Paste a bank statement and every line is categorised. Recurring charges surface on their own, with the price rises.</p>
              <div className="site-feature-art">
                <CashflowPreview />
              </div>
            </div>
            <div className="site-feature">
              <span className="site-feature-icon">
                <Icon name={ICONS.nav.grow} size={20} />
              </span>
              <h3 className="site-h3">Grow, with the evidence</h3>
              <p className="site-p">Fees above the median, cash far above target, a stock that dominates. Each one says why, states its assumptions, and names the risks.</p>
              <div className="site-feature-art">
                <GrowPreview />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="site-section white">
        <div className="site-wrap site-center">
          <p className="site-kicker">Connections</p>
          <h2 className="site-h2">Search your bank. We pick the safest way in.</h2>
          <p className="site-lead">Brokers and exchanges link through a read-only portal. Hardware wallets connect by public key. Banks that no aggregator covers yet are kept by hand, with a reminder when the figure looks old.</p>
          <div className="site-logos" aria-label="Works with">
            {WORKS_WITH.map((w) => (
              <span key={w.name} className="site-logo">
                <Token name={w.name} domain={w.domain} classId={w.classId} size={26} />
                {w.name}
              </span>
            ))}
          </div>
          <p className="site-fine">And any other account, property or debt, by hand.</p>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap">
          <div className="site-grid two" style={{ marginTop: 0, alignItems: 'center' }}>
            <div>
              <p className="site-kicker">Trust</p>
              <h2 className="site-h2">Built like a bank, not like an app.</h2>
              <p className="site-lead">Wealth Hub can look, never move. There is no trading permission to grant, no recovery phrase to type, and everything you enter can be exported or deleted in one click.</p>
              <div className="site-cta">
                <Button variant="secondary" to={R.security} icon={ICONS.status.readOnly}>
                  Read the security notes
                </Button>
              </div>
            </div>
            <div className="site-list" style={{ marginTop: 0, gridTemplateColumns: '1fr' }}>
              {[
                ['Read-only by design', 'Broker and exchange links are opened in read mode. Wallets are watched from a public key.'],
                ['Encrypted at rest', 'Anything secret is encrypted with a key that never leaves the server.'],
                ['Your data, your file', 'Export a single JSON of everything, or delete the account and it is gone.'],
                ['Analysis, not advice', 'Grow explains its reasoning and its risks. It never tells you what to do.'],
              ].map(([b, s]) => (
                <div key={b} className="site-list-item">
                  <Icon name={ICONS.status.fresh} size={18} />
                  <div>
                    <b>{b}</b>
                    <span>{s}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="site-section white">
        <div className="site-wrap site-center">
          <h2 className="site-h2">Start with the sample household. Replace it with your own.</h2>
          <p className="site-lead">Create an account, look around with realistic figures, then connect your first source. Two minutes, no card.</p>
          <div className="site-cta">
            <Button size="lg" to={signedIn ? R.overview : R.signup} icon={ICONS.ui.forward}>
              {signedIn ? 'Open Wealth Hub' : 'Create your account'}
            </Button>
            <Button size="lg" variant="secondary" to={R.pricing}>
              See pricing
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
