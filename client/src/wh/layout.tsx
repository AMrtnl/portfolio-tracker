import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { ICONS, type IconName } from './icons'

/* ---------------- Card ---------------- */

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  /** 'pad' 24 px all round; 'list' for hairline rows; 'table' for a header row and rows; 'pad-sm' 16 px. */
  kind?: 'pad' | 'pad-sm' | 'list' | 'table' | 'bare'
  children: ReactNode
}

/** A card. Cards are for things you can act on. */
export function Card({ as: Tag = 'section', kind = 'pad', className, children, ...rest }: CardProps) {
  return (
    <Tag className={`wh-card${kind === 'bare' ? '' : ` ${kind}`}${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </Tag>
  )
}

export function CardHead({ title, action, small, className, id }: { title: ReactNode; action?: ReactNode; small?: boolean; className?: string; id?: string }) {
  return (
    <div className={`wh-card-head${className ? ` ${className}` : ''}`}>
      <h2 id={id} className={`wh-card-title${small ? ' sm' : ''}`}>
        {title}
      </h2>
      {action}
    </div>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`wh-eyebrow${className ? ` ${className}` : ''}`}>{children}</div>
}

/* ---------------- Rows ---------------- */

type Tone = 'gain' | 'owed' | 'muted' | 'ink'

const toneClass = (t?: Tone) => (t && t !== 'ink' ? ` wh-${t}` : '')

export interface RowProps {
  token?: ReactNode
  title: ReactNode
  sub?: ReactNode
  /** The figure on the right. */
  value?: ReactNode
  valueTone?: Tone
  /** The small line under the figure: a change, "owed", a date. */
  delta?: ReactNode
  deltaTone?: Tone
  /** Replaces value and delta with anything else on the right. */
  right?: ReactNode
  /** After the figure: a chevron, a button. */
  trailing?: ReactNode
  to?: string
  href?: string
  onClick?: () => void
  className?: string
  ariaLabel?: string
}

/** A hairline row: token, name and note, figure and its change. Rows are for things you read down. */
export function Row({ token, title, sub, value, valueTone, delta, deltaTone, right, trailing, to, href, onClick, className, ariaLabel }: RowProps) {
  const interactive = Boolean(to || href || onClick)
  const cls = `wh-row${interactive ? ' tap' : ''}${className ? ` ${className}` : ''}`
  const body = (
    <>
      {token}
      <span className="wh-row-text">
        <span className="wh-row-title">{title}</span>
        {sub != null && <span className="wh-row-sub">{sub}</span>}
      </span>
      {right ?? (
        (value != null || delta != null) && (
          <span className="wh-row-num">
            {value != null && <span className={`wh-row-value${toneClass(valueTone)}`}>{value}</span>}
            {delta != null && <span className={`wh-row-delta${toneClass(deltaTone)}`}>{delta}</span>}
          </span>
        )
      )}
      {trailing}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={cls} onClick={onClick} aria-label={ariaLabel}>
        {body}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={cls} onClick={onClick} aria-label={ariaLabel}>
        {body}
      </a>
    )
  }
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={ariaLabel}>
        {body}
      </button>
    )
  }
  return <div className={cls}>{body}</div>
}

/** The chevron that ends a row you can open. */
export function RowChevron() {
  return <Icon name={ICONS.ui.chevronRight} size={16} className="wh-row-chev" />
}

/** A line of evidence: the icon for the kind of fact, the label, the figure. */
export function EvidenceRow({ icon, label, value, tone, className }: { icon: IconName; label: ReactNode; value: ReactNode; tone?: Tone; className?: string }) {
  return (
    <div className={`wh-ev${className ? ` ${className}` : ''}`}>
      <Icon name={icon} size={18} />
      <span className="wh-ev-label">{label}</span>
      <span className={`wh-ev-value${toneClass(tone)}`}>{value}</span>
    </div>
  )
}

/* ---------------- Notes ---------------- */

interface NoteProps {
  tone: 'risk' | 'insight' | 'info' | 'plain'
  icon?: IconName
  title?: ReactNode
  children: ReactNode
  className?: string
  role?: string
}

/** A risk in red, an insight in amber, both with their icon. Risks read in the same size type as the upside. */
export function Note({ tone, icon, title, children, className, role }: NoteProps) {
  const glyph = icon ?? (tone === 'risk' ? ICONS.evidence.risk : tone === 'insight' ? ICONS.evidence.insight : ICONS.evidence.assumption)
  return (
    <div className={`wh-note ${tone}${className ? ` ${className}` : ''}`} role={role}>
      <Icon name={glyph} size={18} />
      <div>
        {title && <div className="wh-note-title">{title}</div>}
        <div className="wh-note-body">{children}</div>
      </div>
    </div>
  )
}

/* ---------------- Grow card ---------------- */

interface GrowCardProps {
  label?: string
  title: ReactNode
  /** The saving, already formatted with its sign: "+2,270". Gold, once per screen. */
  saving: ReactNode
  unit: ReactNode
  to?: string
  onClick?: () => void
  className?: string
}

/** The one top Grow opportunity. One per screen. */
export function GrowCard({ label = 'Top Grow opportunity', title, saving, unit, to, onClick, className }: GrowCardProps) {
  const body = (
    <>
      <span className="wh-grow-tile">
        <Icon name={ICONS.nav.grow} size={22} filled />
      </span>
      <span className="wh-grow-text">
        <span className="wh-grow-label">{label}</span>
        <span className="wh-grow-title" style={{ display: 'block' }}>
          {title}
        </span>
      </span>
      <span className="wh-grow-num">
        <span className="wh-grow-saving" style={{ display: 'block' }}>
          {saving}
        </span>
        <span className="wh-grow-unit">{unit}</span>
      </span>
    </>
  )
  const cls = `wh-grow${className ? ` ${className}` : ''}`
  if (to) {
    return (
      <Link to={to} className={cls} onClick={onClick}>
        {body}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {body}
      </button>
    )
  }
  return <div className={cls}>{body}</div>
}

/* ---------------- The figure on a plate ---------------- */

interface PlateProps {
  image?: string
  alt: string
  position?: string
  label: ReactNode
  figure: ReactNode
  children?: ReactNode
  height?: number
  className?: string
}

/** The total sits on a marble plate over the picture. The picture and the number are one object. */
export function Plate({ image, alt, position = '46% 36%', label, figure, children, height = 170, className }: PlateProps) {
  return (
    <div className={`wh-plate${className ? ` ${className}` : ''}`} style={{ minHeight: height, height }}>
      {image && <img src={image} alt={alt} style={{ objectPosition: position }} />}
      <div className="wh-plate-panel">
        <div className="wh-plate-label">{label}</div>
        <div className="wh-figure lg">{figure}</div>
        {children}
      </div>
    </div>
  )
}

/* ---------------- Stat ---------------- */

export function Stat({ icon, label, value, tone, className, style }: { icon: IconName; label: ReactNode; value: ReactNode; tone?: Tone; className?: string; style?: CSSProperties }) {
  return (
    <div className={`wh-stat${className ? ` ${className}` : ''}`} style={style}>
      <Icon name={icon} size={18} />
      <div>
        <div className="wh-stat-label">{label}</div>
        <div className={`wh-stat-value${toneClass(tone)}`}>{value}</div>
      </div>
    </div>
  )
}
