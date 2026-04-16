import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { Check, Sparkles, Zap, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const ICONS = [Zap, Sparkles, Building2]

export function Pricing() {
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => axios.get('/api/billing/plans').then(r => r.data),
  })

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => axios.get('/api/billing/subscription').then(r => r.data),
  })

  const checkout = useMutation({
    mutationFn: (planId: string) =>
      axios.post('/api/billing/checkout', { planId }).then(r => r.data),
    onSuccess: (data) => { if (data.url) window.location.href = data.url },
  })

  const currentPlan = subscription?.plan ?? 'free'

  return (
    <div className="p-5 max-w-5xl mx-auto fade-up">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
          style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid var(--gold-border)' }}>
          <Sparkles className="w-3 h-3" /> Simple Pricing
        </div>
        <h1 className="text-3xl font-bold mb-3">Choose your plan</h1>
        <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Start free. Upgrade when you need more power.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0,1,2].map(i => <div key={i} className="card p-6 space-y-4"><div className="skeleton h-6 w-20"/><div className="skeleton h-10 w-24"/><div className="skeleton h-32"/></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan: any, i: number) => {
            const Icon = ICONS[i] ?? Sparkles
            const isCurrent = currentPlan === plan.id
            const isPro = plan.popular

            return (
              <div
                key={plan.id}
                className={cn('relative flex flex-col p-6 rounded-2xl transition-all duration-200', isPro ? 'glass-gold' : 'card')}
                style={isPro ? {} : {}}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg,var(--gold-light),var(--gold))', color: '#07090E' }}>
                    Most Popular
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl" style={{ background: isPro ? 'var(--gold-dim)' : 'var(--bg-elevated)', border: isPro ? '1px solid var(--gold-border)' : '1px solid var(--glass-border)' }}>
                    <Icon className="w-4 h-4" style={{ color: isPro ? 'var(--gold)' : 'var(--text-secondary)' }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ fontFamily: 'Space Grotesk' }}>{plan.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{plan.description}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <span className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
                    {plan.price === 0 ? 'Free' : `$${plan.price}`}
                  </span>
                  {plan.price > 0 && <span className="text-sm ml-1" style={{ color: 'var(--text-muted)' }}>/month</span>}
                </div>

                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f: string) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: isPro ? 'var(--gold)' : 'var(--gain)' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full py-2.5 text-center text-sm font-semibold rounded-xl"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)' }}>
                    Current plan
                  </div>
                ) : plan.price === 0 ? (
                  <div className="w-full py-2.5 text-center text-sm font-semibold rounded-xl"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--glass-border)' }}>
                    Free forever
                  </div>
                ) : (
                  <button
                    className={cn('w-full py-2.5 text-sm font-semibold rounded-xl', isPro ? 'btn-gold' : 'btn-outline')}
                    onClick={() => checkout.mutate(plan.id)}
                    disabled={checkout.isPending}
                  >
                    {checkout.isPending ? 'Redirecting…' : `Get ${plan.name}`}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-center text-xs mt-8" style={{ color: 'var(--text-muted)' }}>
        Payments handled securely by LemonSqueezy. Cancel anytime.
      </p>
    </div>
  )
}
