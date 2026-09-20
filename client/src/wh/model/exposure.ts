import { useMemo } from 'react'
import { useAllocation, useConcentration } from '@/hooks/useAnalytics'
import { useDemo } from '@/wealth/DemoContext'
import { DEMO_EXPOSURE_INSIGHT } from '@/wealth/demo'
import { ICONS, type IconName } from '@/wh/icons'
import { useBook } from './book'
import { countryCode } from './classify'

export interface ExposureRow {
  key: string
  label: string
  pct: number
  icon?: IconName
  /** A two- or three-letter code drawn in a small tile instead of an icon. */
  code?: string
}

const SECTOR_ICON: Array<[RegExp, IconName]> = [
  [/tech/i, ICONS.sector.technology],
  [/financ/i, ICONS.sector.financials],
  [/health/i, ICONS.sector.healthCare],
  [/industr|material/i, ICONS.sector.industrials],
  [/staple|defensive/i, ICONS.sector.consumerStaples],
  [/discretion|cyclical|consumer/i, ICONS.sector.consumerDiscretionary],
  [/energy|utilit/i, ICONS.sector.energy],
  [/estate/i, ICONS.assetClass.property],
  [/communic|telecom/i, ICONS.kind.telecom],
  [/diversified|fund|world/i, ICONS.sector.diversified],
  [/crypto/i, ICONS.assetClass.crypto],
  [/cash/i, ICONS.assetClass.cash],
]

export function sectorIcon(label: string): IconName {
  for (const [re, icon] of SECTOR_ICON) if (re.test(label)) return icon
  return ICONS.sector.other
}

const CURRENCY_NAME: Record<string, string> = { CHF: 'Swiss franc', USD: 'US dollar', EUR: 'Euro', GBP: 'Pound sterling', JPY: 'Yen', BTC: 'Bitcoin', ETH: 'Ether', CRYPTO: 'Crypto' }

const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/** Look-through of every fund: sector, country and currency as shares, plus one plain-language insight. */
export function useExposure(): { sector: ExposureRow[]; country: ExposureRow[]; currency: ExposureRow[]; insight: string | null; loading: boolean } {
  const { enabled: sampleOn } = useDemo()
  const book = useBook()
  const sector = useAllocation('sector')
  const region = useAllocation('region')
  const currency = useAllocation('currency')
  const { data: concentration } = useConcentration()
  return useMemo(() => {
    const rows = (segs: Array<{ key: string; label: string; percent: number }> | undefined) => (segs ?? []).filter((s) => s.percent > 0)
    const sectorRows: ExposureRow[] = rows(sector.data?.segments).map((s) => ({ key: s.key, label: sentence(s.label), pct: s.percent, icon: sectorIcon(s.label) }))
    const countryRows: ExposureRow[] = rows(region.data?.segments).map((s) => ({ key: s.key, label: sentence(s.label), pct: s.percent, code: countryCode(s.label === 'Other' ? 'other' : s.key.length <= 3 ? s.key : s.label) }))
    const currencyRows: ExposureRow[] = rows(currency.data?.segments).map((s) => {
      const code = s.key.toUpperCase()
      return { key: s.key, label: CURRENCY_NAME[code] ?? sentence(s.label), pct: s.percent, code: code === 'CRYPTO' ? 'BTC' : code.slice(0, 3) }
    })
    let insight: string | null = null
    if (sampleOn && !book.hasLive) insight = DEMO_EXPOSURE_INSIGHT
    else {
      const flag = concentration?.flags?.find((f) => f.level === 'high' || f.level === 'warn')
      insight = flag?.message ?? null
    }
    return { sector: sectorRows, country: countryRows, currency: currencyRows, insight, loading: sector.isLoading || region.isLoading || currency.isLoading }
  }, [sector.data, region.data, currency.data, sector.isLoading, region.isLoading, currency.isLoading, concentration, sampleOn, book.hasLive])
}
