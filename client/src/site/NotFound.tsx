import { useEffect } from 'react'
import { Button } from '@/wh/controls'
import { ICONS } from '@/wh/icons'
import { R } from '@/routes'

export function NotFound() {
  useEffect(() => {
    document.title = 'Not found · Wealth Hub'
  }, [])
  return (
    <main>
      <section className="site-section">
        <div className="site-wrap site-center">
          <p className="site-kicker">404</p>
          <h1 className="site-h1" style={{ fontSize: 40 }}>
            Nothing at this address.
          </h1>
          <p className="site-lead">The page may have moved, or the link was never right. The overview is a safe place to start.</p>
          <div className="site-cta">
            <Button to={R.overview} icon={ICONS.ui.forward}>
              Go to the overview
            </Button>
            <Button variant="secondary" to={R.home}>
              Home
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
