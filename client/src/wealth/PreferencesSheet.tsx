import { Check } from '@phosphor-icons/react'
import { FloatSheet } from '@/wealth/FloatSheet'
import { usePrivacy } from '@/wealth/PrivacyContext'
import { useDemo } from '@/wealth/DemoContext'
import {
  useSettings,
  useUpdateSettings,
  type DisplayCurrency,
  type HeadlineMetric,
} from '@/hooks/useSettings'

const CURRENCY_NAMES: Record<DisplayCurrency, string> = {
  CHF: 'Swiss franc',
  EUR: 'Euro',
  USD: 'US dollar',
  GBP: 'Pound sterling',
}

export const HEADLINE_COPY: Record<HeadlineMetric, { label: string; sub: string }> = {
  net: { label: 'Net worth', sub: 'Everything you own, minus what you owe' },
  financial: { label: 'Financial assets', sub: 'Cash, stocks, bonds, crypto — what you could move' },
  gross: { label: 'Gross assets', sub: 'Everything you own, before debts' },
}

/** Display currency, headline figure, privacy, and the sample household. */
export function PreferencesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const { hidden, toggle: togglePrivacy } = usePrivacy()
  const { enabled: sampleOn, toggle: toggleSample } = useDemo()
  const display = settings?.displayCurrency ?? 'USD'
  const metric = settings?.headlineMetric ?? 'net'

  return (
    <FloatSheet open={open} onClose={onClose} title="Preferences">
      <p className="a-qlead">
        Every total is converted into the display currency at today&rsquo;s rate.
        Balances stay stored in the currency their source reports.
      </p>

      <div className="a-header">Display currency</div>
      <section className="a-gcard">
        {(settings?.currencies ?? ['CHF', 'EUR', 'USD', 'GBP']).map((c) => {
          const rate = settings?.rates?.[c]
          const active = c === display
          return (
            <button
              key={c}
              type="button"
              className={`a-arow tap ${active ? 'on' : ''}`}
              onClick={() => update.mutate({ displayCurrency: c })}
              disabled={update.isPending}
              aria-pressed={active}
            >
              <span className="a-ticker">{c}</span>
              <span className="a-atext">
                <b>{CURRENCY_NAMES[c]}</b>
                <em>
                  {active
                    ? 'Display currency'
                    : rate != null
                      ? `1 ${c} = ${rate.toFixed(3)} ${display}`
                      : 'No rate available right now'}
                </em>
              </span>
              {active && <Check size={16} weight="bold" className="a-rowcheck" />}
            </button>
          )
        })}
      </section>

      <div className="a-header">Headline figure</div>
      <section className="a-gcard">
        {(settings?.metrics ?? ['net', 'financial', 'gross']).map((m) => {
          const active = m === metric
          return (
            <button
              key={m}
              type="button"
              className={`a-arow tap ${active ? 'on' : ''}`}
              onClick={() => update.mutate({ headlineMetric: m })}
              disabled={update.isPending}
              aria-pressed={active}
            >
              <span className="a-atext">
                <b>{HEADLINE_COPY[m].label}</b>
                <em>{HEADLINE_COPY[m].sub}</em>
              </span>
              {active && <Check size={16} weight="bold" className="a-rowcheck" />}
            </button>
          )
        })}
      </section>

      <div className="a-header">Privacy &amp; sample</div>
      <section className="a-gcard pad">
        <div className="ui-switchrow">
          <span>
            Hide balances
            <em>Masks every figure until you show them again</em>
          </span>
          <button
            type="button"
            className={`ui-switch ${hidden ? 'on' : ''}`}
            onClick={togglePrivacy}
            role="switch"
            aria-checked={hidden}
            aria-label="Hide balances"
          >
            <span className="ui-switch-knob" />
          </button>
        </div>
        <div className="ui-switchrow">
          <span>
            Sample household
            <em>Example accounts and cash flow beside anything you connect</em>
          </span>
          <button
            type="button"
            className={`ui-switch ${sampleOn ? 'on' : ''}`}
            onClick={toggleSample}
            role="switch"
            aria-checked={sampleOn}
            aria-label="Sample household"
          >
            <span className="ui-switch-knob" />
          </button>
        </div>
      </section>

      {(settings?.warnings?.length ?? 0) > 0 && (
        <p className="a-insnote spaced">{settings!.warnings.join(' ')}</p>
      )}
    </FloatSheet>
  )
}
