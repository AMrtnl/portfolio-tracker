import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Settings as SettingsIcon, Shield, Bell, DollarSign, User, Download, Trash2, Save, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const RISK_PROFILES = [
  { id: 'conservative', label: 'Conservative', desc: 'Capital preservation, low volatility. Max 20% in high-risk assets.' },
  { id: 'moderate', label: 'Moderate', desc: 'Balanced growth and protection. Max 50% in high-risk assets.' },
  { id: 'aggressive', label: 'Aggressive', desc: 'Maximum growth potential. Comfortable with high volatility and drawdowns.' },
]

const CURRENCIES = ['USD', 'EUR', 'CHF', 'GBP', 'JPY', 'AUD', 'CAD', 'BTC', 'ETH']

const ALERT_TYPES = [
  { id: 'price_alert', label: 'Price Alerts', desc: 'Notify when asset hits target price' },
  { id: 'portfolio_change', label: 'Portfolio Change', desc: 'Notify on significant portfolio value change' },
  { id: 'new_transaction', label: 'New Transactions', desc: 'Notify when new transactions are detected' },
  { id: 'weekly_summary', label: 'Weekly Summary', desc: 'Send weekly portfolio performance summary' },
]

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-2.5 mb-5">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function SaveButton({ onClick, isPending, saved }: { onClick: () => void; isPending: boolean; saved: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className={cn(
        'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
        saved
          ? 'bg-green-500/10 text-green-500 border border-green-500/30'
          : 'bg-primary text-primary-foreground hover:bg-primary/90'
      )}
    >
      {saved ? <><Check className="w-3.5 h-3.5" />Saved</> : isPending ? 'Saving…' : <><Save className="w-3.5 h-3.5" />Save</>}
    </button>
  )
}

export function Settings() {
  const qc = useQueryClient()

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => axios.get('/api/settings').then(r => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (data: any) => axios.patch('/api/settings', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })

  const [baseCurrency, setBaseCurrency] = useState('')
  const [riskProfile, setRiskProfile] = useState('')
  const [alertPrefs, setAlertPrefs] = useState<Record<string, boolean>>({})
  const [savedSection, setSavedSection] = useState<string | null>(null)

  const currentCurrency = baseCurrency || settings?.baseCurrency || 'USD'
  const currentRisk = riskProfile || settings?.riskProfile || 'moderate'
  const currentAlerts = { ...{ price_alert: true, portfolio_change: true, new_transaction: false, weekly_summary: true }, ...(settings?.alertPreferences ?? {}), ...alertPrefs }

  function save(section: string, data: any) {
    saveMutation.mutate(data, {
      onSuccess: () => {
        setSavedSection(section)
        setTimeout(() => setSavedSection(null), 2000)
      },
    })
  }

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => axios.get('/api/alerts').then(r => r.data),
  })

  const deleteAlert = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/alerts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })

  function exportData() {
    axios.get('/api/portfolio').then(r => {
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `finvault-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure your FinVault preferences and profile</p>
      </div>

      {/* Profile & Currency */}
      <Section title="Display Preferences" icon={User}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Base Currency</label>
            <p className="text-xs text-muted-foreground/70 mb-2">All portfolio values will be converted to this currency.</p>
            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map(c => (
                <button
                  key={c}
                  onClick={() => setBaseCurrency(c)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-sm border transition-colors',
                    currentCurrency === c
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-secondary'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <SaveButton
              onClick={() => save('currency', { baseCurrency: currentCurrency })}
              isPending={saveMutation.isPending}
              saved={savedSection === 'currency'}
            />
          </div>
        </div>
      </Section>

      {/* Risk Profile */}
      <Section title="Risk Profile" icon={Shield}>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground mb-3">
            Your risk profile affects AI advisor recommendations and rebalancing suggestions.
          </p>
          {RISK_PROFILES.map(r => (
            <button
              key={r.id}
              onClick={() => setRiskProfile(r.id)}
              className={cn(
                'w-full text-left p-4 rounded-lg border transition-colors',
                currentRisk === r.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-secondary/50'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{r.label}</span>
                {currentRisk === r.id && <Check className="w-4 h-4 text-primary" />}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
            </button>
          ))}
          <div className="flex justify-end mt-2">
            <SaveButton
              onClick={() => save('risk', { riskProfile: currentRisk })}
              isPending={saveMutation.isPending}
              saved={savedSection === 'risk'}
            />
          </div>
        </div>
      </Section>

      {/* Notification Preferences */}
      <Section title="Notification Preferences" icon={Bell}>
        <div className="space-y-3">
          {ALERT_TYPES.map(a => (
            <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium">{a.label}</p>
                <p className="text-xs text-muted-foreground">{a.desc}</p>
              </div>
              <button
                onClick={() => setAlertPrefs(p => ({ ...p, [a.id]: !currentAlerts[a.id] }))}
                className={cn(
                  'relative w-10 h-5.5 h-[22px] rounded-full transition-colors',
                  currentAlerts[a.id] ? 'bg-primary' : 'bg-secondary border border-border'
                )}
              >
                <span className={cn(
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  currentAlerts[a.id] ? 'translate-x-5' : 'translate-x-0.5'
                )} />
              </button>
            </div>
          ))}
          <div className="flex justify-end mt-2">
            <SaveButton
              onClick={() => save('alerts', { alertPreferences: currentAlerts })}
              isPending={saveMutation.isPending}
              saved={savedSection === 'alerts'}
            />
          </div>
        </div>
      </Section>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Section title="Active Price Alerts" icon={Bell}>
          <div className="space-y-2">
            {alerts.map((alert: any) => (
              <div key={alert.id} className="flex items-center justify-between p-3 bg-secondary/40 rounded-lg">
                <div>
                  <p className="text-sm font-medium capitalize">{alert.type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-muted-foreground">
                    {alert.asset && <span className="font-mono">{alert.asset} </span>}
                    threshold: {alert.threshold.toLocaleString()}
                    {alert.triggered && <span className="ml-2 text-amber-400">• Triggered</span>}
                  </p>
                </div>
                <button
                  onClick={() => deleteAlert.mutate(alert.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Data Management */}
      <Section title="Data & Privacy" icon={DollarSign}>
        <div className="space-y-4">
          <div className="p-4 bg-secondary/40 rounded-lg">
            <p className="text-sm font-medium mb-1">Credential Security</p>
            <p className="text-xs text-muted-foreground">
              All API keys and credentials are encrypted with AES-256 before being stored in the local SQLite database.
              Your credentials never leave your machine.
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-secondary/40 rounded-lg">
            <div>
              <p className="text-sm font-medium">Export Portfolio Data</p>
              <p className="text-xs text-muted-foreground">Download your full portfolio snapshot as JSON</p>
            </div>
            <button
              onClick={exportData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-secondary transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>

          <div className="p-4 bg-secondary/40 rounded-lg border border-border/50">
            <p className="text-sm font-medium text-destructive mb-1">Danger Zone</p>
            <p className="text-xs text-muted-foreground mb-3">
              Clear all AI conversation history. This cannot be undone.
            </p>
            <button
              onClick={() => {
                if (confirm('Delete all AI conversation history?')) {
                  axios.delete('/api/ai/history').then(() => qc.invalidateQueries({ queryKey: ['ai-history'] }))
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive text-sm hover:bg-destructive/10 transition-colors"
            >
              Clear AI History
            </button>
          </div>
        </div>
      </Section>

      {/* About */}
      <Section title="About FinVault" icon={SettingsIcon}>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between"><span>Version</span><span className="font-mono">1.0.0</span></div>
          <div className="flex justify-between"><span>AI Model</span><span className="font-mono">claude-sonnet-4-6</span></div>
          <div className="flex justify-between"><span>Database</span><span className="font-mono">SQLite (local)</span></div>
          <div className="flex justify-between"><span>Data residency</span><span>Local only</span></div>
        </div>
      </Section>
    </div>
  )
}
