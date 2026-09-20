import { useEffect, useState } from 'react'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { Button, Segmented } from '@/wh/controls'
import { useAuth } from '@/auth/AuthContext'
import { useBilling, useCheckout, type PlanId } from '@/hooks/useBilling'
import { R } from '@/routes'

const PLANS: Array<{ id: PlanId; name: string; price: number; blurb: string; features: string[]; featured?: boolean }> = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    blurb: 'For one household that wants the picture.',
    features: ['Up to 3 live connections', 'Unlimited accounts by hand', 'Net worth, holdings, allocation', 'Cash flow and subscriptions', 'Export any time'],
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 8,
    blurb: 'For a full ledger that keeps itself up to date.',
    features: ['Unlimited live connections', 'Grow: ranked opportunities with evidence', 'Look-through exposure of every fund', 'Daily history and benchmarks', 'Priority support'],
    featured: true,
  },
  {
    id: 'family',
    name: 'Family',
    price: 14,
    blurb: 'For two people, one shared picture.',
    features: ['Everything in Plus', 'Two sign-ins, one ledger', 'Shared goals and budgets', 'Separate or combined views'],
  },
]

export function Pricing() {
  const { status } = useAuth()
  const signedIn = status === 'in'
  const billing = useBilling(signedIn)
  const checkout = useCheckout()
  const [interval, setInterval] = useState<'month' | 'year'>('month')
  const preview = billing.data?.preview ?? true
  const canPay = signedIn && billing.data?.stripeConfigured && !preview
  const current = billing.data?.plan

  useEffect(() => {
    document.title = 'Pricing · Wealth Hub'
  }, [])

  function cta(p: (typeof PLANS)[number]) {
    if (!signedIn) return { label: p.id === 'free' ? 'Start free' : `Start ${p.name}`, to: R.signup }
    if (current === p.id) return { label: 'Your plan', to: R.settings, quiet: true }
    if (p.id === 'free') return { label: 'Included', to: R.settings, quiet: true }
    if (canPay) return { label: `Start ${p.name}`, plan: p.id as Exclude<PlanId, 'free'> }
    return { label: preview ? 'Free during preview' : 'Open the app', to: R.overview }
  }

  return (
    <main>
      <section className="site-section">
        <div className="site-wrap site-center">
          <p className="site-kicker">Pricing</p>
          <h1 className="site-h1" style={{ fontSize: 48 }}>
            Simple, in your currency.
          </h1>
          <p className="site-lead">Prices in Swiss francs, cancel any time. While Wealth Hub is in preview every plan is free and nothing asks for a card.</p>
          <div style={{ maxWidth: 320, margin: '0 auto 8px' }}>
            <Segmented
              options={[
                { value: 'month', label: 'Monthly' },
                { value: 'year', label: 'Yearly, two months free' },
              ]}
              value={interval}
              onChange={setInterval}
              label="Billing interval"
            />
          </div>
          <div className="site-plans">
            {PLANS.map((p) => {
              const c = cta(p)
              const price = interval === 'year' ? p.price * 10 : p.price
              return (
                <div key={p.id} className={`site-plan${p.featured ? ' featured' : ''}`}>
                  {p.featured && <span className="site-plan-badge">Most chosen</span>}
                  <div className="site-plan-name">{p.name}</div>
                  <div className="site-plan-price">
                    CHF {price}
                    <small>{p.price === 0 ? 'forever' : interval === 'year' ? 'a year' : 'a month'}</small>
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
                  {'plan' in c && c.plan ? (
                    <Button variant={p.featured ? 'primary' : 'secondary'} full disabled={checkout.isPending} onClick={() => checkout.mutate({ plan: c.plan!, interval }, { onSuccess: (d) => window.location.assign(d.url) })}>
                      {c.label}
                    </Button>
                  ) : (
                    <Button to={c.to} variant={c.quiet ? 'tertiary' : p.featured ? 'primary' : 'secondary'} full>
                      {c.label}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
          {checkout.isError && <p className="wh-err">Checkout could not be opened. Try again from Settings.</p>}
          <p className="site-fine">Plans apply when the preview ends. Anyone who signs up during the preview keeps Plus free for a year.</p>
        </div>
      </section>
      <section className="site-section white">
        <div className="site-wrap">
          <h2 className="site-h2">Questions</h2>
          <div className="site-faq" style={{ marginLeft: 0 }}>
            <details>
              <summary>Can Wealth Hub move my money?</summary>
              <p>No. Bank links are read-only open banking consents, broker and exchange links are opened in read-only mode, wallets are watched from a public key, and there is no order, transfer or withdrawal code path in the product.</p>
            </details>
            <details>
              <summary>Is my bank supported?</summary>
              <p>Banks link through GoCardless open banking, which covers more than 2,500 institutions across the United Kingdom and the European Economic Area. Swiss retail banks are outside open banking for now: you enter the balance by hand and Wealth Hub reminds you when it looks old. Pick your country on the Connect page to see the list.</p>
            </details>
            <details>
              <summary>Which currency are the totals in?</summary>
              <p>The one you pick: Swiss franc, euro, US dollar or pound sterling. Balances stay stored in the currency their source reports and convert at a real quoted rate. When no rate is available the figure is shown unconverted, never guessed.</p>
            </details>
            <details>
              <summary>What counts as a live connection?</summary>
              <p>A bank, broker or exchange link, or a watched wallet: anything that refreshes on its own. Accounts you keep by hand never count against the limit.</p>
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
