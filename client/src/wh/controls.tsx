import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { ICONS, type IconName } from './icons'

/* ---------------- Buttons ---------------- */

type Variant = 'primary' | 'secondary' | 'tertiary'

interface ButtonBase {
  variant?: Variant
  /** Every button carries an icon. Primary always does. */
  icon?: IconName
  iconFilled?: boolean
  size?: 'md' | 'sm'
  full?: boolean
  className?: string
  children: ReactNode
}

type ButtonProps = ButtonBase &
  (
    | ({ to: string; href?: never } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>)
    | ({ href: string; to?: never; target?: string; rel?: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>)
    | ({ to?: never; href?: never } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>)
  )

/** Primary is ultramarine, one per screen, always with an icon. Secondary is a white pill. Tertiary is ultramarine text. */
export function Button({ variant = 'primary', icon, iconFilled, size = 'md', full, className, children, ...rest }: ButtonProps) {
  const cls = `wh-btn ${variant}${size === 'sm' ? ' sm' : ''}${full ? ' full' : ''}${className ? ` ${className}` : ''}`
  const iconSize = size === 'sm' ? 20 : 22
  const body = (
    <>
      {icon && <Icon name={icon} size={iconSize} filled={iconFilled} />}
      {children}
    </>
  )
  if ('to' in rest && rest.to) {
    const { to, ...linkRest } = rest
    return (
      <Link to={to} className={cls} {...(linkRest as object)}>
        {body}
      </Link>
    )
  }
  if ('href' in rest && rest.href) {
    const { href, target, rel, ...aRest } = rest
    return (
      <a href={href} target={target} rel={rel} className={cls} {...(aRest as object)}>
        {body}
      </a>
    )
  }
  const { type = 'button', ...btnRest } = rest as ButtonHTMLAttributes<HTMLButtonElement>
  return (
    <button type={type} className={cls} {...btnRest}>
      {body}
    </button>
  )
}

interface RoundButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName
  /** Required: an icon-only control always has a name. */
  label: string
  tint?: boolean
  flat?: boolean
  filled?: boolean
  to?: string
}

/** A 44 px white circle with one icon. */
export function RoundButton({ icon, label, tint, flat, filled, to, className, type = 'button', ...rest }: RoundButtonProps) {
  const cls = `wh-round${tint ? ' tint' : ''}${flat ? ' flat' : ''}${className ? ` ${className}` : ''}`
  if (to) {
    return (
      <Link to={to} className={cls} aria-label={label} title={label}>
        <Icon name={icon} size={22} filled={filled} />
      </Link>
    )
  }
  return (
    <button type={type} className={cls} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={22} filled={filled} />
    </button>
  )
}

/** Ultramarine text with a chevron: "All 8 ›". */
export function TextLink({ to, onClick, children, chevron = true, className }: { to?: string; onClick?: () => void; children: ReactNode; chevron?: boolean; className?: string }) {
  const body = (
    <>
      {children}
      {chevron && <Icon name={ICONS.ui.chevronRight} size={18} />}
    </>
  )
  const cls = `wh-link${className ? ` ${className}` : ''}`
  if (to) {
    return (
      <Link to={to} className={cls} onClick={onClick}>
        {body}
      </Link>
    )
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {body}
    </button>
  )
}

/* ---------------- Segmented control ---------------- */

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

interface SegmentedProps<T extends string> {
  options: ReadonlyArray<SegmentOption<T>>
  value: T
  onChange: (value: T) => void
  /** Names the group for readers. */
  label: string
  className?: string
}

/** The active segment lifts to white. It is never coloured. Arrow keys move between segments. */
export function Segmented<T extends string>({ options, value, onChange, label, className }: SegmentedProps<T>) {
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.value === value)
    if (i < 0) return
    let next = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + options.length) % options.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = options.length - 1
    else return
    e.preventDefault()
    onChange(options[next].value)
    const btn = e.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next]
    btn?.focus()
  }
  return (
    <div className={`wh-seg${className ? ` ${className}` : ''}`} role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            className={`wh-seg-btn${on ? ' on' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------- Chips and pills ---------------- */

/** A change, always with its arrow: green is gain, red is loss. */
export function ChangeChip({ value, suffix = '%', digits = 1, className }: { value: number; suffix?: string; digits?: number; className?: string }) {
  const up = value >= 0
  return (
    <span className={`wh-chip ${up ? 'gain' : 'owed'}${className ? ` ${className}` : ''}`}>
      <Icon name={up ? ICONS.status.up : ICONS.status.down} size={18} />
      {Math.abs(value).toFixed(digits)}
      {suffix}
    </span>
  )
}

type PillTone = 'ok' | 'bad' | 'warn' | 'neutral' | 'tint'

interface StatusPillProps {
  tone: PillTone
  icon: IconName
  children: ReactNode
  onClick?: () => void
  className?: string
  title?: string
}

/** A status with its icon: healthy in green, broken in red, never colour alone. */
export function StatusPill({ tone, icon, children, onClick, className, title }: StatusPillProps) {
  const cls = `wh-pill ${tone}${className ? ` ${className}` : ''}`
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} title={title}>
        <Icon name={icon} size={18} />
        {children}
      </button>
    )
  }
  return (
    <span className={cls} title={title}>
      <Icon name={icon} size={18} />
      {children}
    </span>
  )
}

/** The gold count on a sidebar item or a tab: how many things wait. */
export function Count({ n, className }: { n: number; className?: string }) {
  return <span className={`wh-count${className ? ` ${className}` : ''}`}>{n}</span>
}

/* ---------------- Field ---------------- */

interface FieldBase {
  icon: IconName
  label?: string
  hint?: string
  variant?: 'md' | 'lg'
  invalid?: boolean
  className?: string
  trailing?: ReactNode
}

type InputField = FieldBase & { as?: 'input' } & Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'size'>
type SelectField = FieldBase & { as: 'select'; children: ReactNode } & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'size'>
type TextareaField = FieldBase & { as: 'textarea' } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>
export type FieldProps = InputField | SelectField | TextareaField

/** Every field leads with an icon that says what goes in it. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(props, ref) {
  const { icon, label, hint, variant = 'md', invalid, className, trailing, ...rest } = props
  const auto = useId()
  const id = (rest as { id?: string }).id ?? `f-${auto}`
  const multi = rest.as === 'textarea'
  const wrapCls = `wh-field${variant === 'lg' ? ' lg' : ''}${multi ? ' multi' : ''}${invalid ? ' invalid' : ''}`
  let control: ReactNode
  if (rest.as === 'select') {
    const { as: _as, children, ...selectRest } = rest
    control = (
      <select id={id} {...selectRest}>
        {children}
      </select>
    )
  } else if (rest.as === 'textarea') {
    const { as: _as, ...taRest } = rest
    control = <textarea id={id} {...taRest} />
  } else {
    const { as: _as, ...inputRest } = rest as InputField
    control = <input ref={ref} id={id} {...inputRest} />
  }
  return (
    <div className={`wh-fieldset${className ? ` ${className}` : ''}`}>
      {label && (
        <label htmlFor={id} className="wh-label">
          {label}
        </label>
      )}
      <div className={wrapCls}>
        <Icon name={icon} size={22} />
        {control}
        {trailing}
      </div>
      {hint && <p className="wh-hint">{hint}</p>}
    </div>
  )
})
