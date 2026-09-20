import { useEffect } from 'react'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { Button } from '@/wh/controls'
import { useAuth } from '@/auth/AuthContext'
import { R } from '@/routes'

const PLANS = [
  {
    name: 'Free',
    price: '0',
    period: 'forever',
    blurb: 'For one household that wants the picture.',
    features: ['Up to 3 connected sources', 'Unlimited accounts by hand', 'Net worth, holdings, allocation', 'Cash flow and subscriptions', 'Export any time'],
    cta: 'Start free',
  },
  {
    name: 'Plus',
    price: '8',
    period: 'a month',
    blurb: 'For a full ledger that keeps itself up to date.',
    features: ['Unlimited connected sources', 'Grow: ranked opportunities with evidence', 'Look-through exposure of every fund', 'Daily history and benchmarks', 'Priority support'],
    cta: 'Start Plus',
    featured: true,
  },
  {
    name: 'Family',
    price: '14',
    period: 'a month',
    blurb: 'For two people, one shared picture.',
    features: ['Everything in Plus', 'Two sign-ins, one ledger', 'Shared goals and budgets', 'Separate or combined views'],
    cta: 'Start Family',
  },
]

export function Pricing() {
  const { status } = useAuth()
  const to = status === 'in' ? R.overview : R.signup
  useEffect(() => {
    document.title = 'Pricing · Wealth Hub'
  }, [])
  return (
    <main>
      <section className="site-section">
        <div className="site-wrap site-center">
          <p className="site-kicker">Pricing</p>
          <h1 className="site-h1" style={{ fontSize: 48 }}>
            Simple, in your currency.
          </h1>
          <p className="site-lead">Prices in CHF, billed monthly, cancel any time. While Wealth Hub is in preview every plan is free and nothing asks for a card.</p>
          <div className="site-plans">
            {PLANS.map((p) => (
              <div key={p.name} className={`site-plan${p.featured ? ' featured' : ''}`}>
                {p.featured && <span className="site-plan-badge">Most chosen</span>}
                <div className="site-plan-name">{p.name}</div>
                <div className="site-plan-price">
                  CHF {p.price}
                  <small>{p.period}</small>
                </div>
                <p className="site-p" style={{ marginTop: 0 }}>
                  {p.blurb}
                </p>
                <ul>
                  {p.features.map((f) => (
                    <li key={f}>
                      <Icon name={ICONS.ui.check} size={16} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button to={to} variant={p.featured ? 'primary' : 'secondary'} full>
                  {p.cta}
                </Button>
              </div>
            ))}
          </div>
          <p className="site-fine">Plans apply when the preview ends. Anyone who signs up during the preview keeps Plus free for a year.</p>
        </div>
      </section>
      <section className="site-section white">
        <div className="site-wrap">
          <h2 className="site-h2">Questions</h2>
          <div className="site-faq" style={{ marginLeft: 0 }}>
            <details>
              <summary>Can Wealth Hub move my money?</summary>
              <p>No. Broker and exchange links are opened in read-only mode, wallets are watched from a public key, and there is no order, transfer or withdrawal code path in the product.</p>
            </details>
            <details>
              <summary>Is my Swiss bank supported?</summary>
              <p>Most Swiss retail banks are not available through any aggregator yet. You enter the balance by hand and Wealth Hub reminds you when it looks old. Brokers such as Interactive Brokers and DEGIRO link directly.</p>
            </details>
            <details>
              <summary>Which currency are the totals in?</summary>
              <p>The one you pick: Swiss franc, euro, US dollar or pound sterling. Balances stay stored in the currency their source reports and convert at a real quoted rate. When no rate is available the figure is shown unconverted, never guessed.</p>
            </details>
            <details>
              <summary>What happens to my data if I leave?</summary>
              <p>Export everything as one JSON file from Settings, then delete the account. Deletion removes every connection, balance and setting at once.</p>
            </details>
            <details>
              <summary>Is this financial advice?</summary>
              <p>No. Grow is educational analysis of your own figures. Every suggestion states its reasoning, its assumptions and its risks so you can decide.</p>
            </details>
          </div>
        </div>
      </section>
    </main>
  )
}
