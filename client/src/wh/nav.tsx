import type { MouseEvent, ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './icons'

export interface NavItem {
  key: string
  label: string
  icon: IconName
  href: string
  active?: boolean
  /** Gold count beside the label: things waiting. */
  count?: number
  onSelect?: (e: MouseEvent<HTMLAnchorElement>) => void
}

/** Phone: five tabs in a floating capsule; the active tab opens into ultramarine with its name. */
export function TabBar({ items, label = 'Primary', className, fixed = true }: { items: NavItem[]; label?: string; className?: string; fixed?: boolean }) {
  return (
    <nav className={`wh-tabbar${className ? ` ${className}` : ''}`} aria-label={label} style={fixed ? undefined : { position: 'relative', left: 0, right: 0, bottom: 0 }}>
      {items.map((it) => (
        <a key={it.key} href={it.href} onClick={it.onSelect} className={`wh-tab${it.active ? ' on' : ''}`} aria-current={it.active ? 'page' : undefined} aria-label={it.active ? undefined : it.label}>
          <Icon name={it.icon} size={22} filled={it.active} />
          <span className="wh-tab-label">{it.label}</span>
        </a>
      ))}
    </nav>
  )
}

/** Desktop: a sidebar item; the active one is an ultramarine capsule. */
export function SidebarItem({ item, trailing }: { item: NavItem; trailing?: ReactNode }) {
  return (
    <a href={item.href} onClick={item.onSelect} className={`wh-side${item.active ? ' on' : ''}`} aria-current={item.active ? 'page' : undefined}>
      <Icon name={item.icon} size={19} filled={item.active} />
      <span className="wh-side-label">{item.label}</span>
      {item.count != null && item.count > 0 && <span className="wh-count">{item.count}</span>}
      {trailing}
    </a>
  )
}

/** A capsule of sections, for headers that have no sidebar. */
export function NavPill({ items, label = 'Sections', className }: { items: NavItem[]; label?: string; className?: string }) {
  return (
    <nav className={`wh-navpill${className ? ` ${className}` : ''}`} aria-label={label}>
      {items.map((it) => (
        <a key={it.key} href={it.href} onClick={it.onSelect} className={`wh-navpill-item${it.active ? ' on' : ''}`} aria-current={it.active ? 'page' : undefined}>
          {it.label}
          {it.count != null && it.count > 0 && <span className="wh-count">{it.count}</span>}
        </a>
      ))}
    </nav>
  )
}
