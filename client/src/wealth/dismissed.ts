/** Recurring-charge suggestions the user waved away, kept per browser. */
export const DISMISSED_KEY = 'meridian.dismissedRecurring'

export function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function writeDismissed(keys: Set<string>): void {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...keys]))
  } catch {
    /* private mode */
  }
}
