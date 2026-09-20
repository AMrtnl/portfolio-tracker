import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { Button, Segmented } from '@/wh/controls'
import { Card, Note } from '@/wh/layout'
import { Meter } from '@/wh/charts'
import { useBilling, useCheckout, usePortal, type PlanId } from '@/hooks/useBilling'
import { R } from '@/routes'

const PLAN_LINES: Record<PlanId, string[]> = {
  free: ['Up to 3 live connections', 'Unlimited accounts by hand', 'Net worth, holdings, cash flow, subscriptions'],
  plus: ['Unlimited live connections', 'Grow with evidence and risks', 'Look-through exposure', 'Daily history and benchmarks'],
  family: ['Everything in Plus', 'Two sign-ins, one ledger', 'Shared goals and budgets'],
}

/** A plan's slots are used up: say so, once, with the way forward. */
export function UpgradeNote() {
  return (
    <Note tone="insight" icon={ICONS.nav.grow} title="This plan's live connections are used up">
      Free includes three live connections. Plus has no limit, along with Grow and exposure.{' '}
      <a href={R.settings} className="wh-link" style={{ fontSize: 13 }}>
        See plans
      </a>
    </Note>
  )
}

/** The plan section in Settings: what you are on, what it includes, what to do next. */
export function PlanCard() {
  const billing = useBilling()
  const checkout = useCheckout()
  const portal = usePortal()
  const [interval, setInterval] = useState<'month' | 'year'>('month')
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()
  const back = params.get('billing')
  useEffect(() => {
    // Back from Stripe: the webhook lands a moment later, so read the plan again shortly.
    if (!back) return
    const t = window.setTimeout(() => qc.invalidateQueries({ queryKey: ['billing'] }), 2500)
    return () => window.clearTimeout(t)
  }, [back, qc])
  const b = billing.data
  if (!b) {
    return (
      <Card kind="pad">
        <span className="wh-skeleton" style={{ display: 'block', width: 180, height: 16 }} />
      </Card>
    )
  }
  const spec = b.plans[b.plan]
  const used = b.usage.liveConnections
  const cap = b.entitlements.liveConnections
  const price = (p: PlanId) => (interval === 'year' ? b.plans[p].priceChf * 10 : b.plans[p].priceChf)
  const err = checkout.error ?? portal.error

  return (
    <Card kind="pad">
      {back === 'success' && (
        <div style={{ marginBottom: 14 }}>
          <Note tone="insight" icon={ICONS.ui.check} title="Thank you">
            Your plan updates the moment Stripe confirms the payment, usually within a few seconds.{' '}
            <button type="button" className="wh-link" onClick={() => setParams({}, { replace: true })}>
              Dismiss
            </button>
          </Note>
        </div>
      )}
      {back === 'cancelled' && (
        <div style={{ marginBottom: 14 }}>
          <Note tone="plain" title="Checkout was cancelled">
            Nothing was charged. Your plan is unchanged.{' '}
            <button type="button" className="wh-link" onClick={() => setParams({}, { replace: true })}>
              Dismiss
            </button>
          </Note>
        </div>
      )}
      <div className="wh-card-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="wh-eyebrow">Current plan</div>
          <div className="wh-serif" style={{ fontSize: 34, marginTop: 4 }}>
            {spec.name}
            {b.preview && <span className="wh-chip stone plain" style={{ marginLeft: 10, verticalAlign: 'middle', fontFamily: 'var(--wh-sans)', fontSize: 12 }}>Preview, free</span>}
            {b.source === 'stripe' && b.renewsAt && (
              <span className="wh-chip neutral plain" style={{ marginLeft: 10, verticalAlign: 'middle', fontFamily: 'var(--wh-sans)', fontSize: 12 }}>
                Renews {new Date(b.renewsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </div>
        {b.stripeConfigured && b.source === 'stripe' && (
          <Button size="sm" variant="secondary" icon={ICONS.ui.openInNew} disabled={portal.isPending} onClick={() => portal.mutate(undefined, { onSuccess: (d) => window.location.assign(d.url) })}>
            Manage billing
          </Button>
        )}
      </div>

      <div className="wh-meterrow" style={{ marginTop: 14, borderBottom: 0 }}>
        <Icon name={ICONS.nav.connections} size={18} />
        <span className="wh-meterrow-label">Live connections</span>
        <Meter pct={cap ? Math.min(100, (used / cap) * 100) : used > 0 ? 100 : 0} color={cap && used >= cap ? 'var(--wh-stone)' : undefined} label={`${used} of ${cap ?? 'unlimited'}`} />
        <span className="wh-meterrow-pct">{cap == null ? `${used}, no limit` : `${used} of ${cap}`}</span>
      </div>

      <ul className="wh-plan-lines">
        {PLAN_LINES[b.plan].map((l) => (
          <li key={l}>
            <Icon name={ICONS.ui.check} size={15} />
            {l}
          </li>
        ))}
      </ul>

      {b.preview ? (
        <p className="wh-caption" style={{ marginTop: 14 }}>
          Every plan is free while Wealth Hub is in preview, and everyone who signs up during the preview keeps Plus free for a year afterwards.
        </p>
      ) : b.stripeConfigured && b.plan === 'free' ? (
        <div className="wh-stack" style={{ marginTop: 16 }}>
          <div style={{ maxWidth: 260 }}>
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
          <div className="wh-form-actions">
            <Button icon={ICONS.nav.grow} disabled={checkout.isPending} onClick={() => checkout.mutate({ plan: 'plus', interval }, { onSuccess: (d) => window.location.assign(d.url) })}>
              Plus, CHF {price('plus')} a {interval}
            </Button>
            <Button variant="secondary" disabled={checkout.isPending} onClick={() => checkout.mutate({ plan: 'family', interval }, { onSuccess: (d) => window.location.assign(d.url) })}>
              Family, CHF {price('family')} a {interval}
            </Button>
          </div>
        </div>
      ) : !b.stripeConfigured ? (
        <p className="wh-caption" style={{ marginTop: 14 }}>
          Billing is not switched on for this deployment. Plans are shown for information.
        </p>
      ) : null}
      {err && <p className="wh-err" style={{ marginTop: 10 }}>{(err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'That did not work. Try again.'}</p>}
    </Card>
  )
}

/** The plan chip in the account menu. */
export function PlanChip() {
  const { data } = useBilling()
  if (!data) return null
  return (
    <span className={`wh-chip ${data.preview ? 'stone' : data.plan === 'free' ? 'neutral' : 'gain'} plain`} style={{ fontSize: 11 }}>
      {data.plans[data.plan].name}
      {data.preview ? ' · preview' : ''}
    </span>
  )
}
