import { useEffect } from 'react'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { Button } from '@/wh/controls'
import { R } from '@/routes'

const POINTS: Array<[string, string]> = [
  ['Read-only, every source', 'Brokers and exchanges are linked through a read-only portal. The connection cannot place an order or move cash, and you can revoke it on the broker’s side at any time.'],
  ['Wallets by public key only', 'Hardware wallets are watched from an address or an account key. Wealth Hub never asks for a recovery phrase and stores nothing that can sign.'],
  ['Secrets encrypted at rest', 'Anything that must be kept, such as an exchange wallet you chose to connect, is encrypted with AES-256-GCM using a key held only on the server.'],
  ['Your password, hashed', 'Passwords are hashed with scrypt and a unique salt. Sessions are signed, HttpOnly cookies that expire and are revoked when you change your password.'],
  ['One person, one directory', 'Every account’s data lives in its own directory on the server. Nothing is pooled and nothing is shared between people.'],
  ['Honest numbers', 'A source that fails to sync shows as failed. A currency without a rate stays unconverted. History is recorded once a day and never backfilled.'],
  ['Export and delete', 'Settings exports every account, setting, transaction, goal and daily figure as one JSON file. Deleting the account removes it all.'],
  ['No trackers', 'The product runs without advertising or analytics scripts. Logos load from the institution’s own domain and nothing else leaves the page.'],
]

export function Security() {
  useEffect(() => {
    document.title = 'Security · Wealth Hub'
  }, [])
  return (
    <main>
      <section className="site-section">
        <div className="site-wrap">
          <p className="site-kicker">Security</p>
          <h1 className="site-h1" style={{ fontSize: 48 }}>
            Can look. Cannot move.
          </h1>
          <p className="site-lead">The whole product is built around one rule: Wealth Hub reads your figures and never touches your money. Here is what that means in practice.</p>
          <div className="site-list">
            {POINTS.map(([b, s]) => (
              <div key={b} className="site-list-item">
                <Icon name={ICONS.status.readOnly} size={18} />
                <div>
                  <b>{b}</b>
                  <span>{s}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="site-section white">
        <div className="site-wrap site-center">
          <h2 className="site-h2">Questions about security?</h2>
          <p className="site-lead">Everything above is how the product is written, not a promise on a page. The source is open to read.</p>
          <div className="site-cta">
            <Button to={R.signup} icon={ICONS.ui.forward}>
              Create an account
            </Button>
            <Button variant="secondary" href="https://github.com/AMrtnl/portfolio-tracker" target="_blank" rel="noreferrer" icon={ICONS.ui.openInNew}>
              Read the source
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
