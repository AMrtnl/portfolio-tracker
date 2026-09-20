import { useMemo, useState, type CSSProperties } from 'react'
import { ICONS, type IconName } from './icons'
import { Icon } from './Icon'
import { luminance, resolveLogo, type LogoQuery } from './logoService'

/** What kind of thing a row is about. Decides the class tint and the badge (or the whole tile when no brand exists). */
export type ClassId =
  | 'equities'
  | 'funds'
  | 'cash'
  | 'crypto'
  | 'bitcoin'
  | 'property'
  | 'pension'
  | 'bonds'
  | 'collectibles'
  | 'bank'
  | 'broker'
  | 'wallet'
  | 'exchange'
  | 'mortgage'
  | 'loan'
  | 'card'
  | 'subscription'
  | 'telecom'
  | 'media'
  | 'health'
  | 'software'
  | 'import'
  | 'other'

type Tint = 'ultra' | 'gain' | 'stone' | 'olive' | 'owed' | 'night'

export const CLASS_STYLE: Record<ClassId, { icon: IconName; tint: Tint; label: string }> = {
  equities: { icon: ICONS.assetClass.equities, tint: 'ultra', label: 'Equity' },
  funds: { icon: ICONS.assetClass.funds, tint: 'ultra', label: 'Fund' },
  cash: { icon: ICONS.assetClass.cash, tint: 'gain', label: 'Cash' },
  crypto: { icon: ICONS.assetClass.crypto, tint: 'night', label: 'Crypto' },
  bitcoin: { icon: ICONS.assetClass.bitcoin, tint: 'stone', label: 'Bitcoin' },
  property: { icon: ICONS.assetClass.property, tint: 'stone', label: 'Property' },
  pension: { icon: ICONS.assetClass.pension, tint: 'olive', label: 'Pension' },
  bonds: { icon: ICONS.assetClass.bonds, tint: 'olive', label: 'Bonds' },
  collectibles: { icon: ICONS.assetClass.collectibles, tint: 'stone', label: 'Collectibles' },
  bank: { icon: ICONS.account.bank, tint: 'ultra', label: 'Bank' },
  broker: { icon: ICONS.account.broker, tint: 'ultra', label: 'Broker' },
  wallet: { icon: ICONS.account.hardwareWallet, tint: 'night', label: 'Hardware wallet' },
  exchange: { icon: ICONS.account.exchange, tint: 'ultra', label: 'Exchange' },
  mortgage: { icon: ICONS.account.mortgage, tint: 'owed', label: 'Mortgage' },
  loan: { icon: ICONS.account.carLoan, tint: 'owed', label: 'Loan' },
  card: { icon: ICONS.account.cardDebt, tint: 'owed', label: 'Card' },
  subscription: { icon: ICONS.nav.subscriptions, tint: 'ultra', label: 'Subscription' },
  telecom: { icon: ICONS.kind.telecom, tint: 'ultra', label: 'Telecom' },
  media: { icon: ICONS.kind.media, tint: 'ultra', label: 'Media' },
  health: { icon: ICONS.kind.health, tint: 'olive', label: 'Health' },
  software: { icon: ICONS.kind.software, tint: 'ultra', label: 'Software' },
  import: { icon: ICONS.account.csvImport, tint: 'ultra', label: 'Import' },
  other: { icon: ICONS.ui.more, tint: 'night', label: 'Other' },
}

export interface TokenProps extends LogoQuery {
  /** The class decides the tint and the badge. */
  classId: ClassId
  /** Tile size in px. Rows use 40. */
  size?: number
  /** Initials to show instead of the computed ones. */
  mono?: string
  /** Brand colour override, six hex digits. */
  hex?: string
  /** Let a remote logo service try after the bundled set. */
  remote?: boolean
  /** A class token with no brand at all: tinted tile, filled icon, no badge. */
  classOnly?: boolean
  className?: string
}

/**
 * The tile that starts every row. Three kinds behind one API, in fallback
 * order: the real logo in its brand colour, a monogram in the brand colour,
 * the class token alone. The layout never shifts between them.
 */
export function Token({
  classId,
  size = 40,
  mono,
  hex,
  remote = true,
  classOnly = false,
  className,
  name,
  symbol,
  domain,
  isin,
}: TokenProps) {
  const cls = CLASS_STYLE[classId] ?? CLASS_STYLE.other
  const [broken, setBroken] = useState<string | null>(null)
  const resolved = useMemo(
    () => (classOnly ? null : resolveLogo({ name, symbol, domain, isin }, { remote, mono, hex })),
    [classOnly, name, symbol, domain, isin, remote, mono, hex],
  )
  const logo = resolved?.logo && !(resolved.logo.kind === 'image' && broken === resolved.logo.url) ? resolved.logo : null
  const tint = `wh-tint-${cls.tint}`
  const style = { '--wh-token': `${size}px` } as CSSProperties

  if (!resolved) {
    return (
      <span className={`wh-token class ${tint}${className ? ` ${className}` : ''}`} style={style} aria-hidden="true">
        <span className="wh-token-tile">
          <Icon name={cls.icon} filled size={Math.max(16, Math.round(size * 0.54))} />
        </span>
      </span>
    )
  }

  const brandHex = resolved.hex
  const dark = brandHex ? luminance(brandHex) < 0.12 : false
  const brandStyle = brandHex ? ({ ...style, '--wh-brand': `#${brandHex}` } as CSSProperties) : style
  const monoText = resolved.mono
  const monoClass = monoText.length >= 4 ? ' xlong' : monoText.length === 3 ? ' long' : ''

  return (
    <span
      className={`wh-token brand ${tint}${brandHex ? '' : ' neutral'}${dark ? ' dark-brand' : ''}${className ? ` ${className}` : ''}`}
      style={brandHex ? brandStyle : ({ ...style, '--wh-brand': 'var(--wh-ink)' } as CSSProperties)}
      aria-hidden="true"
    >
      <span className="wh-token-tile">
        {logo?.kind === 'svg' ? (
          <svg className="wh-token-logo" viewBox="0 0 24 24" role="presentation">
            <path d={logo.path} />
          </svg>
        ) : logo?.kind === 'image' ? (
          <img
            className="wh-token-img"
            src={logo.url}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setBroken(logo.url)}
          />
        ) : (
          <span className={`wh-token-mono${monoClass}`}>{monoText}</span>
        )}
      </span>
      <span className="wh-token-badge">
        <Icon name={cls.icon} filled size={Math.max(14, Math.round(size * 0.24))} />
      </span>
    </span>
  )
}
