/** Money helpers for the Kassa module. Amounts are integer euro cents. */

const EURO_FORMAT = new Intl.NumberFormat('de-AT', {
  style: 'currency',
  currency: 'EUR',
})

/** Formats integer euro cents as an Austrian currency string, e.g. "1.234,50 €". */
export function formatEuro(cents: number): string {
  return EURO_FORMAT.format(cents / 100)
}

/**
 * Parses a euro amount typed by the user into integer cents, or null
 * if it isn't a valid non-negative number. Accepts both Austrian
 * ("1.234,50") and plain ("1234.50", "12", "12,5") notations: a comma
 * is always the decimal separator (dots are then thousands); without a
 * comma a dot is treated as the decimal separator.
 */
export function parseEuroToCents(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return null
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
    : trimmed.replace(/\s/g, '')
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}
