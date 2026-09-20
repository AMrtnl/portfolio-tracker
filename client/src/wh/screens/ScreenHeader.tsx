import type { ReactNode } from 'react'
import { useDesktop } from '@/wh/useMediaQuery'

interface ScreenHeaderProps {
  title: string
  subtitle?: ReactNode
  /** Controls on the right: a segmented range, round buttons. */
  actions?: ReactNode
  /** Something before the title on the phone: a back button. */
  lead?: ReactNode
  /** Phone only: replaces the title with a mark or a lockup. */
  phoneLead?: ReactNode
  /** Phone only: a short line centred between the lead and the actions, "Grow, 1 of 4". */
  phoneMid?: ReactNode
  /** Phone only: the title sits on its own line under the buttons, as on a pushed screen. */
  stacked?: boolean
}

/** The title of a screen. Desktop: title and subtitle above the grid. Phone: title beside its round buttons. */
export function ScreenHeader({ title, subtitle, actions, lead, phoneLead, phoneMid, stacked }: ScreenHeaderProps) {
  const desktop = useDesktop()
  if (!desktop) {
    if (stacked) {
      return (
        <header className="wh-screenhead phone stacked">
          <div className="wh-screenhead-lead">{lead}</div>
          {actions && <div className="wh-screenhead-actions">{actions}</div>}
          <h1 className="wh-title phone">{title}</h1>
        </header>
      )
    }
    return (
      <header className="wh-screenhead phone">
        <div className="wh-screenhead-lead">
          {lead}
          {phoneLead ?? (phoneMid ? null : <h1 className="wh-title phone">{title}</h1>)}
          {phoneMid && <span className="wh-screenhead-mid">{phoneMid}</span>}
        </div>
        {actions && <div className="wh-screenhead-actions">{actions}</div>}
      </header>
    )
  }
  return (
    <header className="wh-screenhead">
      <div className="wh-screenhead-text">
        <h1 className="wh-title">{title}</h1>
        {subtitle && <p className="wh-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="wh-screenhead-actions">{actions}</div>}
    </header>
  )
}
