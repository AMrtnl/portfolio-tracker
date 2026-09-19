/**
 * The Wealth Hub icon map, from the handoff (reference/screens/Icons.html).
 * Material Symbols Rounded names, weight 400, outlined at rest and filled
 * when active or inside a token. Never under 16 px. Colour inherits from text.
 *
 * scripts/fetch-fonts.mjs subsets the icon font to the names in this file:
 * add a name here, re-run the script, commit both.
 */
export const ICONS = {
  nav: {
    overview: 'home',
    holdings: 'pie_chart',
    exposure: 'public',
    cashflow: 'swap_vert',
    subscriptions: 'autorenew',
    grow: 'potted_plant',
    performance: 'monitoring',
    activity: 'receipt_long',
    connections: 'link',
    planning: 'calendar_month',
  },
  assetClass: {
    equities: 'show_chart',
    funds: 'pie_chart',
    cash: 'payments',
    crypto: 'currency_bitcoin',
    property: 'home',
    pension: 'savings',
    bonds: 'receipt_long',
    collectibles: 'diamond',
  },
  account: {
    bank: 'account_balance',
    broker: 'candlestick_chart',
    hardwareWallet: 'key',
    exchange: 'currency_exchange',
    mortgage: 'real_estate_agent',
    carLoan: 'directions_car',
    cardDebt: 'credit_card',
    csvImport: 'upload_file',
  },
  activity: {
    buy: 'shopping_cart',
    sell: 'sell',
    dividend: 'redeem',
    fee: 'percent',
    transfer: 'swap_horiz',
    deposit: 'call_received',
    withdrawal: 'call_made',
    interest: 'local_atm',
  },
  grow: {
    fees: 'percent',
    idleCash: 'payments',
    staking: 'bolt',
    concentration: 'donut_small',
    taxWrapper: 'gavel',
    debt: 'credit_card_off',
    subscription: 'autorenew',
    overlap: 'content_copy',
  },
  evidence: {
    holdings: 'inventory_2',
    comparison: 'balance',
    return: 'trending_up',
    horizon: 'calendar_month',
    breakEven: 'schedule',
    modelledGain: 'paid',
    risk: 'warning',
    assumption: 'info',
  },
  status: {
    synced: 'cloud_done',
    syncing: 'sync',
    needsSignIn: 'sync_problem',
    offline: 'cloud_off',
    fresh: 'check_circle',
    stale: 'schedule',
    failed: 'error',
    readOnly: 'verified_user',
  },
  action: {
    add: 'add',
    search: 'search',
    filter: 'tune',
    share: 'ios_share',
    export: 'download',
    edit: 'edit',
    scan: 'qr_code_scanner',
    passkey: 'passkey',
  },
  /** Chrome, not meaning: the few glyphs every interface needs to move and close. */
  ui: {
    back: 'arrow_back',
    forward: 'arrow_forward',
    up: 'arrow_upward',
    down: 'arrow_downward',
    chevronLeft: 'chevron_left',
    chevronRight: 'chevron_right',
    expand: 'expand_more',
    collapse: 'expand_less',
    close: 'close',
    check: 'check',
    remove: 'remove',
    more: 'more_horiz',
    menu: 'menu',
    settings: 'settings',
    notifications: 'notifications',
    show: 'visibility',
    hide: 'visibility_off',
    openInNew: 'open_in_new',
    refresh: 'refresh',
    logout: 'logout',
    person: 'person',
    lock: 'lock',
    command: 'keyboard_command_key',
    gainArrow: 'north_east',
    lossArrow: 'south_east',
  },
} as const

type Values<T> = T[keyof T]
/** Every icon name the subset font carries. */
export type IconName = Values<{ [G in keyof typeof ICONS]: Values<(typeof ICONS)[G]> }>

/** All names, unique and sorted, as the font subset needs them. */
export const ICON_NAMES: readonly IconName[] = [
  ...new Set(Object.values(ICONS).flatMap((group) => Object.values(group) as IconName[])),
].sort()
