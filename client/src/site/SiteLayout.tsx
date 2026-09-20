import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Lockup } from '@/wh/Mark'
import { Button } from '@/wh/controls'
import { useAuth } from '@/auth/AuthContext'
import { R } from '@/routes'
import './site.css'

export function SiteHeader() {
  const { status } = useAuth()
  const signedIn = status === 'in'
  return (
    <header className="site-header">
      <div className="site-wrap">
        <Link to={R.home} className="site-brand" aria-label="Wealth Hub, home">
          <Lockup size={21} />
        </Link>
        <nav className="site-nav" aria-label="Site">
          <NavLink to={R.home} end className={({ isActive }) => (isActive ? 'on' : undefined)}>
            Product
          </NavLink>
          <NavLink to={R.security} className={({ isActive }) => (isActive ? 'on' : undefined)}>
            Security
          </NavLink>
          <NavLink to={R.pricing} className={({ isActive }) => (isActive ? 'on' : undefined)}>
            Pricing
          </NavLink>
        </nav>
        <div className="site-actions">
          {signedIn ? (
            <Button size="sm" to={R.overview}>
              Open Wealth Hub
            </Button>
          ) : (
            <>
              <Button size="sm" variant="tertiary" to={R.login}>
                Sign in
              </Button>
              <Button size="sm" to={R.signup}>
                Get started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-wrap">
        <div className="site-footer-grid">
          <div>
            <Lockup size={20} />
            <p style={{ margin: '12px 0 0', maxWidth: '32ch', lineHeight: 1.5 }}>Every account, every asset, one clear picture. Read-only, in your currency.</p>
          </div>
          <div>
            <h4>Product</h4>
            <Link to={R.home}>Overview</Link>
            <Link to={R.security}>Security</Link>
            <Link to={R.pricing}>Pricing</Link>
          </div>
          <div>
            <h4>Account</h4>
            <Link to={R.login}>Sign in</Link>
            <Link to={R.signup}>Create an account</Link>
          </div>
          <div>
            <h4>Legal</h4>
            <Link to={R.privacy}>Privacy</Link>
            <Link to={R.terms}>Terms</Link>
          </div>
        </div>
        <div className="site-footer-note">
          <span>© {new Date().getFullYear()} Wealth Hub</span>
          <span>Educational analysis of your own figures, not financial advice.</span>
        </div>
      </div>
    </footer>
  )
}

export function SiteLayout() {
  const location = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])
  return (
    <div className="site">
      <SiteHeader />
      <Outlet />
      <SiteFooter />
    </div>
  )
}
