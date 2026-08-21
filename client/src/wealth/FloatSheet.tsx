import { useEffect, type ReactNode } from 'react'
import { ChevronLeft, X } from 'lucide-react'

/**
 * Centered floating sheet over a blurred backdrop — the one modal chrome
 * for the app (quick views, add flows). Esc and backdrop click dismiss;
 * `onEscape` lets a caller step back through inner navigation instead.
 */
export function FloatSheet({
  open,
  title,
  onClose,
  onBack,
  onEscape,
  children,
}: {
  open: boolean
  title?: string
  onClose: () => void
  /** Shows a Back control in the header when set. */
  onBack?: () => void
  /** Defaults to onClose. */
  onEscape?: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const handler = onEscape ?? onClose
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose, onEscape])

  if (!open) return null

  return (
    <div className="a-qlook" onClick={onClose}>
      <aside
        className="a-qpanel"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Detail'}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="a-qhead">
          {onBack ? (
            <button type="button" className="a-back" onClick={onBack}>
              <ChevronLeft size={19} strokeWidth={2.5} />
              Back
            </button>
          ) : title ? (
            <h2 className="a-qtitle">{title}</h2>
          ) : (
            <span />
          )}
          {onBack && title ? <h2 className="a-qtitle mid">{title}</h2> : null}
          <button type="button" className="a-navbtn" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={2.5} />
          </button>
        </header>
        {children}
      </aside>
    </div>
  )
}
