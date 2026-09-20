import { useEffect } from 'react'

const UPDATED = '20 September 2026'

function Privacy() {
  return (
    <>
      <h1>Privacy</h1>
      <p className="site-fine">Last updated {UPDATED}</p>
      <h2>What Wealth Hub stores</h2>
      <p>Your email address, your name, a hash of your password, and the financial figures you connect or enter: account names, balances, positions, transactions, subscriptions, goals and one net-worth value per day. Connected brokers are referenced by an identifier; their sign-in details never reach Wealth Hub.</p>
      <h2>Where it lives</h2>
      <p>On the server that runs your Wealth Hub deployment, in a directory that belongs to your account alone. Anything secret is encrypted at rest. Nothing is sold, shared or used for advertising.</p>
      <h2>Third parties</h2>
      <ul>
        <li>
          <strong>SnapTrade</strong> provides the read-only broker and exchange links. When you connect one, SnapTrade holds the authorisation and Wealth Hub reads balances and positions through it.
        </li>
        <li>
          <strong>Market data</strong> (quotes, foreign-exchange rates, sector classification) is fetched from public market-data services for the symbols you hold.
        </li>
        <li>
          <strong>Public blockchain nodes</strong> answer balance queries for watched wallets. Only the public address or key is sent.
        </li>
        <li>
          <strong>Institution logos</strong> are loaded from the institution’s own domain for the token beside its name.
        </li>
      </ul>
      <h2>Your rights</h2>
      <p>Export everything from Settings at any time. Delete your account from Settings and every record is removed at once. Questions go to the address in the footer of the deployment you use.</p>
    </>
  )
}

function Terms() {
  return (
    <>
      <h1>Terms</h1>
      <p className="site-fine">Last updated {UPDATED}</p>
      <h2>What Wealth Hub is</h2>
      <p>A read-only view of your own finances. It aggregates figures you connect or enter and presents analysis of them. It does not hold, move or invest money and cannot place orders.</p>
      <h2>Not advice</h2>
      <p>Everything the product shows, including the Grow section, is educational analysis of your own figures under stated assumptions. It is not financial, tax or legal advice, and results are not guaranteed. Decisions are yours.</p>
      <h2>Accuracy</h2>
      <p>Figures come from the sources you connect and the numbers you type. Wealth Hub reports failures as failures and never invents a value, but it cannot verify what a source reports. Check anything that matters against the source itself.</p>
      <h2>Your account</h2>
      <p>Keep your password to yourself. You are responsible for what is done with your sign-in. You can delete the account at any time from Settings.</p>
      <h2>Changes</h2>
      <p>These terms may change as the product does. The date above says when they last did.</p>
    </>
  )
}

export function Legal({ kind }: { kind: 'privacy' | 'terms' }) {
  useEffect(() => {
    document.title = `${kind === 'privacy' ? 'Privacy' : 'Terms'} · Wealth Hub`
  }, [kind])
  return (
    <main>
      <section className="site-section tight">
        <div className="site-wrap">
          <article className="site-prose">{kind === 'privacy' ? <Privacy /> : <Terms />}</article>
        </div>
      </section>
    </main>
  )
}
