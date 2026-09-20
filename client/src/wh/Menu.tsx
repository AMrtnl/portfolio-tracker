import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './icons'

export interface MenuItem {
  key: string
  label: string
  icon?: IconName
  sub?: string
  onSelect: () => void
  /** Rendered pressed: a toggle that is on. */
  on?: boolean
  disabled?: boolean
}

interface MenuProps {
  /** The control that opens the menu. Receives the aria props to spread. */
  trigger: (props: { onClick: () => void; 'aria-haspopup': 'menu'; 'aria-expanded': boolean; 'aria-controls': string }) => ReactNode
  items: Array<MenuItem | 'rule'>
  label: string
  align?: 'left' | 'right'
  /** Open above the trigger, for a menu at the foot of a sidebar. */
  up?: boolean
  /** Free content above the items, for a control that is not a menu item. */
  head?: ReactNode
}

/** A small card of choices under a button. Escape, outside click and a choice close it; arrows move. */
export function Menu({ trigger, items, label, align = 'right', up = false, head }: MenuProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
      if (!btns.length) return
      e.preventDefault()
      const i = btns.indexOf(document.activeElement as HTMLButtonElement)
      const next = e.key === 'ArrowDown' ? (i + 1) % btns.length : (i - 1 + btns.length) % btns.length
      btns[next].focus()
    }
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open])

  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
  }, [open])

  return (
    <div className="wh-menuwrap" ref={ref}>
      {trigger({ onClick: () => setOpen((v) => !v), 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': id })}
      {open && (
        <div id={id} role="menu" aria-label={label} className={`wh-menu ${align}${up ? ' up' : ''}`}>
          {head}
          {items.map((it, i) =>
            it === 'rule' ? (
              <hr key={`rule-${i}`} className="wh-menu-rule" />
            ) : (
              <button
                key={it.key}
                type="button"
                role="menuitem"
                className={`wh-menu-item${it.on ? ' on' : ''}`}
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false)
                  it.onSelect()
                }}
              >
                {it.icon && <Icon name={it.icon} size={18} />}
                <span className="wh-menu-text">
                  <span>{it.label}</span>
                  {it.sub && <span className="wh-menu-sub">{it.sub}</span>}
                </span>
                {it.on && <Icon name="check" size={16} />}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
