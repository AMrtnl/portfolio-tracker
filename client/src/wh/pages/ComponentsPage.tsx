import { useState } from 'react'
import { Mark } from '@/wh/Mark'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { Token, type ClassId } from '@/wh/Token'
import { Button, ChangeChip, Field, RoundButton, Segmented, StatusPill } from '@/wh/controls'
import { Card, Eyebrow, EvidenceRow, GrowCard, Note, Plate, Row } from '@/wh/layout'
import { NavPill, SidebarItem, TabBar, type NavItem } from '@/wh/nav'
import '@/wh/pages/brand.css'

const RANGES = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
  { value: 'All', label: 'All' },
] as const

const TABS: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: ICONS.nav.overview, href: '#', active: true },
  { key: 'holdings', label: 'Holdings', icon: ICONS.nav.holdings, href: '#' },
  { key: 'exposure', label: 'Exposure', icon: ICONS.nav.exposure, href: '#' },
  { key: 'cashflow', label: 'Cash flow', icon: ICONS.nav.cashflow, href: '#' },
  { key: 'grow', label: 'Grow', icon: ICONS.nav.grow, href: '#' },
]

const noop = (e: { preventDefault: () => void }) => e.preventDefault()

function Controls() {
  const [range, setRange] = useState<(typeof RANGES)[number]['value']>('1Y')
  return (
    <div className="wh-brandpanel">
      <div className="wh-brandcols">
        <div className="wh-brandcol" style={{ flex: 1.6 }}>
          <Eyebrow>Buttons</Eyebrow>
          <div className="wh-brandrow">
            <Button icon={ICONS.nav.connections}>Connect an account</Button>
            <Button variant="secondary" icon={ICONS.action.evidence}>
              See the evidence
            </Button>
            <Button variant="tertiary">Not now</Button>
          </div>
          <p className="wh-caption">Primary is ultramarine, one per screen, and always carries an icon. Secondary is a white pill. Tertiary is ultramarine text.</p>
        </div>
        <div className="wh-brandcol">
          <Eyebrow>Range control</Eyebrow>
          <div style={{ maxWidth: 340 }}>
            <Segmented options={RANGES} value={range} onChange={setRange} label="Range" />
          </div>
          <p className="wh-caption">The active segment lifts to white. It is never coloured.</p>
        </div>
      </div>

      <div className="wh-brandcols">
        <div className="wh-brandcol">
          <Eyebrow>Round buttons</Eyebrow>
          <div className="wh-brandrow" style={{ gap: 10 }}>
            <RoundButton icon={ICONS.action.search} label="Search" />
            <RoundButton icon={ICONS.action.filter} label="Filter" />
            <RoundButton icon={ICONS.ui.notifications} label="Alerts" />
            <RoundButton icon={ICONS.action.share} label="Share" />
            <RoundButton icon={ICONS.ui.back} label="Back" />
          </div>
        </div>
        <div className="wh-brandcol" style={{ flex: 1.4 }}>
          <Eyebrow>Status and change</Eyebrow>
          <div className="wh-brandrow" style={{ gap: 10 }}>
            <ChangeChip value={6.4} />
            <ChangeChip value={-1.8} />
            <StatusPill tone="ok" icon={ICONS.status.synced}>
              8 synced
            </StatusPill>
            <StatusPill tone="bad" icon={ICONS.status.needsSignIn}>
              UBS needs sign-in
            </StatusPill>
          </div>
          <p className="wh-caption">Green is gain or healthy. Red is owed, cost, loss or broken. Always with an arrow or icon, never colour alone.</p>
        </div>
      </div>

      <div className="wh-brandcols" style={{ alignItems: 'flex-start' }}>
        <div className="wh-brandcol" style={{ flex: '0 0 350px' }}>
          <Eyebrow>Tab bar, iPhone</Eyebrow>
          <div style={{ width: 350, position: 'relative', padding: '8px 0 12px' }}>
            <TabBar items={TABS.map((t) => ({ ...t, onSelect: noop }))} fixed={false} label="Tabs" />
          </div>
          <p className="wh-caption">The active tab opens into an ultramarine pill with its name.</p>
        </div>
        <div className="wh-brandcol" style={{ flex: '0 0 250px' }}>
          <Eyebrow>Sidebar, Mac</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 230 }}>
            <SidebarItem item={{ key: 'o', label: 'Overview', icon: ICONS.nav.overview, href: '#', active: true, onSelect: noop }} />
            <SidebarItem item={{ key: 'g', label: 'Grow', icon: ICONS.nav.grow, href: '#', count: 3, onSelect: noop }} />
            <SidebarItem item={{ key: 'h', label: 'Holdings', icon: ICONS.nav.holdings, href: '#', onSelect: noop }} />
          </div>
        </div>
        <div className="wh-brandcol">
          <Eyebrow>Field</Eyebrow>
          <Field icon={ICONS.action.email} type="email" defaultValue="alex@example.ch" aria-label="Email" />
          <p className="wh-caption">Every field leads with an icon that says what goes in it.</p>
        </div>
      </div>

      <div className="wh-brandcols">
        <div className="wh-brandcol">
          <Eyebrow>Navigation pill, web</Eyebrow>
          <div style={{ display: 'flex' }}>
            <NavPill
              items={[
                { key: 'o', label: 'Overview', icon: ICONS.nav.overview, href: '#', active: true, onSelect: noop },
                { key: 'h', label: 'Holdings', icon: ICONS.nav.holdings, href: '#', onSelect: noop },
                { key: 'g', label: 'Grow', icon: ICONS.nav.grow, href: '#', onSelect: noop },
                { key: 'c', label: 'Connections', icon: ICONS.nav.connections, href: '#', onSelect: noop },
              ]}
            />
          </div>
          <p className="wh-caption">The same sections as the sidebar, in a pill under the top bar.</p>
        </div>
      </div>
    </div>
  )
}

function Data() {
  return (
    <div className="wh-brandpanel">
      <div className="wh-brandcols" style={{ alignItems: 'flex-start' }}>
        <div className="wh-brandcol" style={{ gap: 26 }}>
          <div className="wh-brandcol">
            <Eyebrow>List rows</Eyebrow>
            <Card kind="list">
              <Row
                token={<Token name="Interactive Brokers" classId="broker" remote={false} />}
                title="Interactive Brokers"
                sub="Brokerage"
                value="412,300"
                delta="+8.4%"
                deltaTone="gain"
              />
              <Row token={<Token name="Apple" symbol="AAPL" classId="equities" remote={false} />} title="Apple" sub="IBKR, 410 shares" value="92,200" delta="−1.8%" deltaTone="owed" />
              <Row token={<Token classId="mortgage" classOnly />} title="Mortgage" sub="UBS, fixed to 2031" value="−221,000" valueTone="owed" delta="owed" deltaTone="muted" />
            </Card>
          </div>
          <div className="wh-brandcol">
            <Eyebrow>Evidence rows</Eyebrow>
            <Card kind="list">
              <EvidenceRow icon={ICONS.grow.fees} label="Current weighted fee" value="0.71%" tone="owed" />
              <EvidenceRow icon={ICONS.evidence.comparison} label="Comparable median" value="0.16%" />
              <EvidenceRow icon={ICONS.evidence.breakEven} label="Cost repaid in" value="about 3 months" />
            </Card>
            <p className="wh-caption">Each line leads with an icon for the kind of fact it is.</p>
          </div>
          <div className="wh-brandcol">
            <Eyebrow>Risk note</Eyebrow>
            <Note tone="risk" title="Risks and trade-offs">
              Switching can trigger taxes. Modelled, not guaranteed.
            </Note>
          </div>
          <div className="wh-brandcol">
            <Eyebrow>Insight</Eyebrow>
            <Note tone="insight">Apple is 18% of your equities: held directly, and again inside the All-World fund and the UBS fund.</Note>
          </div>
        </div>
        <div className="wh-brandcol" style={{ gap: 26 }}>
          <div className="wh-brandcol">
            <Eyebrow>The figure</Eyebrow>
            <Plate image="/wh/images/garden-dots-marble.png" alt="" label="Net worth" figure="CHF 1,284,650" />
            <p className="wh-caption">The total sits on a marble plate over the dot screen. The picture and the number are one object.</p>
          </div>
          <div className="wh-brandcol">
            <Eyebrow>Grow card</Eyebrow>
            <GrowCard title="Reduce avoidable fund fees" saving="+2,270" unit="CHF a year" />
            <p className="wh-caption">Ultramarine, with the saving in gold. One per screen.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

const LOGO_TOKENS: Array<{ name: string; symbol?: string; classId: ClassId; how: string }> = [
  { name: 'Apple', symbol: 'AAPL', classId: 'equities', how: 'by ticker' },
  { name: 'Bitcoin', symbol: 'BTC', classId: 'bitcoin', how: 'by asset' },
  { name: 'Ethereum', symbol: 'ETH', classId: 'crypto', how: 'by asset' },
  { name: 'Revolut', classId: 'bank', how: 'by domain' },
  { name: 'Netflix', classId: 'subscription', how: 'by merchant' },
  { name: 'Spotify', classId: 'subscription', how: 'by merchant' },
  { name: 'YouTube', classId: 'subscription', how: 'by merchant' },
  { name: 'iCloud+', classId: 'subscription', how: 'by merchant' },
  { name: 'Claude', classId: 'subscription', how: 'by merchant' },
  { name: 'Notion', classId: 'subscription', how: 'by merchant' },
]

const MONO_TOKENS: Array<{ name: string; classId: ClassId; how: string }> = [
  { name: 'UBS', classId: 'bank', how: 'bank' },
  { name: 'Interactive Brokers', classId: 'broker', how: 'broker' },
  { name: 'Ledger', classId: 'wallet', how: 'hardware wallet' },
  { name: 'Vanguard', classId: 'funds', how: 'fund house' },
  { name: 'iShares', classId: 'funds', how: 'fund house' },
  { name: 'Pillar 3a', classId: 'pension', how: 'pension' },
  { name: 'Swisscom', classId: 'telecom', how: 'telecom' },
]

const CLASS_TOKENS: Array<{ classId: ClassId; name: string; how: string }> = [
  { classId: 'equities', name: 'Equities', how: 'ultramarine' },
  { classId: 'funds', name: 'Funds', how: 'ultramarine' },
  { classId: 'cash', name: 'Cash', how: 'green' },
  { classId: 'property', name: 'Property', how: 'stone' },
  { classId: 'collectibles', name: 'Collectibles', how: 'stone' },
  { classId: 'pension', name: 'Pension', how: 'olive' },
  { classId: 'bonds', name: 'Bonds', how: 'olive' },
  { classId: 'mortgage', name: 'Mortgage', how: 'red, owed' },
  { classId: 'loan', name: 'Car loan', how: 'red, owed' },
  { classId: 'subscription', name: 'Subscription', how: 'ultramarine' },
]

function Tokens() {
  return (
    <div className="wh-brandpanel">
      <div className="wh-brandcol">
        <Eyebrow>Logo tokens, real marks</Eyebrow>
        <div className="wh-tokengrid">
          {LOGO_TOKENS.map((t) => (
            <div key={t.name} className="wh-tokencell">
              <Token name={t.name} symbol={t.symbol} classId={t.classId} remote={false} />
              <div>
                <div className="wh-tokenname">{t.name}</div>
                <div className="wh-tokenhow">{t.how}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="wh-brandcol">
        <Eyebrow>Monogram fallback, in the brand colour</Eyebrow>
        <div className="wh-tokengrid">
          {MONO_TOKENS.map((t) => (
            <div key={t.name} className="wh-tokencell">
              <Token name={t.name} classId={t.classId} remote={false} />
              <div>
                <div className="wh-tokenname">{t.name}</div>
                <div className="wh-tokenhow">{t.how}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="wh-brandcol">
        <Eyebrow>Class tokens</Eyebrow>
        <div className="wh-tokengrid">
          {CLASS_TOKENS.map((t) => (
            <div key={t.classId} className="wh-tokencell">
              <Token classId={t.classId} classOnly />
              <div>
                <div className="wh-tokenname">{t.name}</div>
                <div className="wh-tokenhow">{t.how}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="wh-brandcols" style={{ borderTop: '1px solid var(--wh-rule)', paddingTop: 26 }}>
        <div className="wh-brandcol" style={{ flex: 1.5 }}>
          <Eyebrow>Anatomy</Eyebrow>
          <div style={{ display: 'flex', gap: 26, alignItems: 'center' }}>
            <Token name="Apple" symbol="AAPL" classId="equities" size={84} remote={false} />
            <div className="wh-caption" style={{ fontSize: 13, lineHeight: 1.6 }}>
              Tile: radius 32%, filled with the brand colour at 13%
              <br />
              Ring: the brand colour at 30%, 1.5 px
              <br />
              Logo: 50% of the tile, in the brand colour
              <br />
              Badge: class tint and icon, 2 px white ring
            </div>
          </div>
        </div>
        <div className="wh-brandcol">
          <Eyebrow>Order of fallback</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
            <span className="wh-brandrow" style={{ gap: 10 }}>
              <Icon name={ICONS.ui.one} size={22} className="wh-ultra" />
              Logo from the service
            </span>
            <span className="wh-brandrow" style={{ gap: 10 }}>
              <Icon name={ICONS.ui.two} size={22} className="wh-ultra" />
              Monogram in the brand colour
            </span>
            <span className="wh-brandrow" style={{ gap: 10 }}>
              <Icon name={ICONS.ui.three} size={22} className="wh-ultra" />
              Class token alone
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** /brand/components: the Phase 2 acceptance page. Every primitive, on a light ground and on a dark one. */
export default function ComponentsPage() {
  const [ground, setGround] = useState<'light' | 'dark' | 'both'>('both')
  const grounds = ground === 'both' ? (['light', 'dark'] as const) : ([ground] as const)
  return (
    <div className="wh-brandpage">
      <header>
        <Mark width={41} decorative />
        <h1 className="wh-serif">Components</h1>
        <p>
          The interface is made of the same things as the brand: marble ground, white cards with generous corners, ultramarine for the one thing to do next, and an
          icon on everything you can touch. Every row starts with a token. A suggestion never appears without its reason and its risk.
        </p>
        <div style={{ maxWidth: 300 }}>
          <Segmented
            options={[
              { value: 'both', label: 'Both' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={ground}
            onChange={setGround}
            label="Ground"
          />
        </div>
      </header>
      {grounds.map((g) => (
        <section key={g} className="wh-groundpanel" data-ground={g} aria-label={`${g} ground`}>
          <h2 className="wh-serif wh-groundtitle">{g === 'light' ? 'Light ground' : 'Dark ground'}</h2>
          <h3 className="wh-brandh3">Controls</h3>
          <Controls />
          <h3 className="wh-brandh3">Data</h3>
          <Data />
          <h3 className="wh-brandh3">Tokens and logos</h3>
          <Tokens />
        </section>
      ))}
    </div>
  )
}
