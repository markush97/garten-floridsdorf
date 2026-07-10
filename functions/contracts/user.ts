import { z } from 'zod'

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
})

export const updateUserInputSchema = createUserInputSchema.partial()

export type User = z.infer<typeof userSchema>
export type CreateUserInput = z.infer<typeof createUserInputSchema>
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>
