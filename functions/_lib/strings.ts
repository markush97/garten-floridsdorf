/**
 * Trims a string and returns `null` when the result is empty (or when
 * the input already was null/undefined). Used to normalise optional
 * text inputs before writing them to the database.
 */
export function normalizeOptional(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
