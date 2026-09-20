import { Mark } from '@/wh/Mark'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { Token } from '@/wh/Token'
import { Card, Eyebrow, Row } from '@/wh/layout'
import { ALLOCATION_COLORS, AreaChart, CashflowChart, CreepBars, Meter, Sparkline, Tessera } from '@/wh/charts'
import fixture from '@/wh/fixtures/demo-data.json'
import '@/wh/pages/brand.css'

const NET_WORTH = Array.from({ length: 24 }, (_, i) => 1_207_000 + i * 3_380 + Math.sin(i / 2.1) * 9_000 - Math.cos(i / 5) * 6_000)
const ALL_WORLD = [150, 152, 151, 154, 156, 155, 158, 160, 159, 163, 166, 170, 172, 175, 178, 177, 181, 184]
const APPLE = [98, 97, 99, 96, 95, 96, 94, 93, 95, 92, 91, 93, 92, 90, 91, 92]

const SECTORS: Array<{ name: string; pct: number; icon: (typeof ICONS.sector)[keyof typeof ICONS.sector] }> = [
  { name: 'Technology', pct: 24, icon: ICONS.sector.technology },
  { name: 'Financials', pct: 17, icon: ICONS.sector.financials },
  { name: 'Health care', pct: 14, icon: ICONS.sector.healthCare },
  { name: 'Industrials', pct: 11, icon: ICONS.sector.industrials },
]

const ALLOCATION = [
  { label: 'Property', percent: 44, color: ALLOCATION_COLORS.property },
  { label: 'Equities and funds', percent: 34, color: ALLOCATION_COLORS.equitiesAndFunds },
  { label: 'Pension', percent: 9, color: ALLOCATION_COLORS.pension },
  { label: 'Cash', percent: 7, color: ALLOCATION_COLORS.cash },
  { label: 'Crypto', percent: 6, color: ALLOCATION_COLORS.crypto },
]

function Panel() {
  const cf = fixture.cashflow
  return (
    <div className="wh-chartgrid">
      <div className="wh-brandcol">
        <Eyebrow>Position over time</Eyebrow>
        <Card kind="pad-sm" style={{ borderRadius: 22 }}>
          <AreaChart values={NET_WORTH} width={340} height={120} unit="CHF" />
        </Card>
        <p className="wh-caption">How is it going? A smooth rounded line over a dot-screen fill. Today is a gold point that breathes slowly. On hover the line glows, a nod to the first Wealth Hub.</p>
      </div>
      <div className="wh-brandcol">
        <Eyebrow>In, out and forecast</Eyebrow>
        <Card kind="pad-sm" style={{ borderRadius: 22 }}>
          <CashflowChart months={cf.months} ins={cf.in} outs={cf.out} position={cf.cashPosition} forecastFrom={cf.forecastFromIndex} width={900} height={120} labels={false} />
        </Card>
        <p className="wh-caption">Where is the cash heading? Rounded paired bars, a position line, a marble band for the forecast.</p>
      </div>
      <div className="wh-brandcol">
        <Eyebrow>Creep</Eyebrow>
        <Card kind="pad-sm" style={{ borderRadius: 22 }}>
          <CreepBars values={fixture.subscriptions.history12m} width={330} height={120} />
        </Card>
        <p className="wh-caption">Is it growing quietly? A mini chart, so it is pixel: tile stacks that deepen, the latest in gold.</p>
      </div>
      <div className="wh-brandcol">
        <Eyebrow>Share</Eyebrow>
        <Card kind="bare" style={{ padding: '8px 16px', borderRadius: 22 }}>
          {SECTORS.map((s) => (
            <div key={s.name} className="wh-meterrow">
              <Icon name={s.icon} size={18} className="wh-ultra" />
              <span className="wh-meterrow-label">{s.name}</span>
              <Meter pct={s.pct} />
              <span className="wh-meterrow-pct">{s.pct}%</span>
            </div>
          ))}
        </Card>
        <p className="wh-caption">What is it made of? A meter of twenty slim upright bars per row, never a pie.</p>
      </div>
      <div className="wh-brandcol">
        <Eyebrow>Allocation</Eyebrow>
        <Card kind="pad-sm" style={{ borderRadius: 22 }}>
          <Tessera parts={ALLOCATION} />
        </Card>
        <p className="wh-caption">How is the whole divided? A hundred tesserae.</p>
      </div>
      <div className="wh-brandcol">
        <Eyebrow>Trend in a row</Eyebrow>
        <Card kind="bare" style={{ padding: '8px 16px', borderRadius: 22 }}>
          <Row
            className="compact"
            token={<Token name="Vanguard" classId="funds" size={36} remote={false} />}
            title="All-World"
            sub="ETF"
            right={
              <>
                <Sparkline values={ALL_WORLD} />
                <span className="wh-row-num" style={{ minWidth: 64 }}>
                  <span className="wh-row-value" style={{ fontSize: 15 }}>184,200</span>
                  <span className="wh-row-delta wh-gain" style={{ fontSize: 12 }}>+8.2%</span>
                </span>
              </>
            }
          />
          <Row
            className="compact"
            token={<Token name="Apple" symbol="AAPL" classId="equities" size={36} remote={false} />}
            title="Apple"
            sub="Equity"
            right={
              <>
                <Sparkline values={APPLE} />
                <span className="wh-row-num" style={{ minWidth: 64 }}>
                  <span className="wh-row-value" style={{ fontSize: 15 }}>92,200</span>
                  <span className="wh-row-delta wh-owed" style={{ fontSize: 12 }}>−1.8%</span>
                </span>
              </>
            }
          />
        </Card>
        <p className="wh-caption">Which way is each one going? A pixel sparkline, red only when it ends lower.</p>
      </div>
    </div>
  )
}

/** /brand/charts: the Phase 3 acceptance page. Six charts, no library, on a light and a dark ground. */
export default function ChartsPage() {
  return (
    <div className="wh-brandpage">
      <header>
        <Mark width={41} decorative />
        <h1 className="wh-serif">Data graphics</h1>
        <p>
          Two registers. The big charts, the ones a screen is built around, are drawn smooth and rounded so they read calmly. The small ones, sparklines, meters and
          creep bars, are drawn on the pixel grid of the pictures. Ultramarine is the measure. Green and red appear only for money in and money out, gain and loss.
          Gold marks today. Forecasts are the same shape at lower strength on a marble band, never a different colour.
        </p>
      </header>
      {(['light', 'dark'] as const).map((g) => (
        <section key={g} className="wh-groundpanel" data-ground={g} aria-label={`${g} ground`}>
          <h2 className="wh-serif wh-groundtitle">{g === 'light' ? 'Light ground' : 'Dark ground'}</h2>
          <div className="wh-brandpanel">
            <Panel />
          </div>
        </section>
      ))}
    </div>
  )
}
