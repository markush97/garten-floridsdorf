import type { ZodError } from 'zod'

export const ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  GONE: 'GONE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number

  constructor(code: ErrorCode, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
    this.name = 'AppError'
  }
}

export function makeError(code: ErrorCode, message: string) {
  return { code, message }
}

/**
 * `ZodError.message` is the JSON-stringified issue array, not a
 * string fit for display — this pulls out the first issue's own
 * human-readable message (the one each schema authored) instead.
 */
export function zodErrorMessage(error: ZodError): string {
  return error.issues[0]?.message ?? 'Ungültige Eingabe.'
}
