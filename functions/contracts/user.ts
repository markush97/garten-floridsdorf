import { z } from 'zod'
import { usernameSchema } from './auth'

// Optional, lightly validated contact fields. Empty strings (and pure
// whitespace) are normalized to `null` so consumers don't have to guess.
const optionalContactString = z
  .preprocess(
    (v) => (v == null ? '' : v),
    z
      .string()
      .max(200)
      .transform((v) => v.trim())
      .transform((v) => (v.length === 0 ? null : v))
      .refine((v) => v === null || v.length >= 2, {
        message: 'Bitte mindestens 2 Zeichen eingeben.',
      }),
  )
  .nullish()

const optionalDescription = z
  .preprocess(
    (v) => (v == null ? '' : v),
    z
      .string()
      .max(2000)
      .transform((v) => v.trim())
      .transform((v) => (v.length === 0 ? null : v)),
  )
  .nullish()

// Never includes `password_hash` — the queries select these columns
// explicitly so the hash can't leak into an API response.
export const userSchema = z.object({
  id: z.number(),
  slug: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  description: z.string().nullable(),
  username: z.string().nullable(),
  role: z.enum(['member', 'admin']),
  is_kassier: z.boolean(),
  activated_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const createUserInputSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  email: optionalContactString,
  phone: optionalContactString,
  description: optionalDescription,
  role: z.enum(['member', 'admin']).optional(),
  is_kassier: z.boolean().optional(),
})

export const updateUserInputSchema = createUserInputSchema.partial()

// ── Profile self-service (`/api/me/*`) ─────────────────────────────────────

const optionalEmail = z
  .preprocess(
    (v) => (v == null ? '' : v),
    z
      .string()
      .max(200)
      .transform((v) => v.trim().toLowerCase())
      .transform((v) => (v.length === 0 ? null : v))
      .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
        message: 'Ungültige E-Mail-Adresse.',
      }),
  )
  .nullish()

/** What a member sees and edits about themselves. */
export const myProfileSchema = userSchema.extend({
  address: z.string().nullable(),
  notify_calendar_email: z.boolean(),
})

export const updateMyProfileInputSchema = z.object({
  first_name: z.string().trim().min(1).max(100).optional(),
  last_name: z.string().trim().min(1).max(100).optional(),
  username: usernameSchema.optional(),
  email: optionalEmail,
  phone: optionalContactString,
  address: optionalContactString,
  description: optionalDescription,
  notify_calendar_email: z.boolean().optional(),
})

export const changePasswordInputSchema = z.object({
  current_password: z
    .string()
    .min(1, 'Bitte das aktuelle Passwort eingeben.')
    .max(200),
  new_password: z.string().min(8, 'Passwort: mindestens 8 Zeichen').max(200),
})

export type User = z.infer<typeof userSchema>
export type CreateUserInput = z.infer<typeof createUserInputSchema>
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>
export type MyProfile = z.infer<typeof myProfileSchema>
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileInputSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>
