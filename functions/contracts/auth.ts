import { z } from 'zod'

// Lowercase letters, digits, and ._- in the middle; 3–30 chars.
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/,
    'Benutzername: 3–30 Zeichen, Kleinbuchstaben, Ziffern, ._-',
  )

const passwordSchema = z
  .string()
  .min(8, 'Passwort: mindestens 8 Zeichen')
  .max(200)

export const loginInputSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1).max(200),
})

export const magicLinkRequestInputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
})

export const acceptInviteInputSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
})

export type LoginInput = z.infer<typeof loginInputSchema>
export type MagicLinkRequestInput = z.infer<typeof magicLinkRequestInputSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteInputSchema>

/** Shape of `GET /auth/me` and of the login responses. */
export type SessionUser = {
  user_id: number | null
  name: string
  role: 'member' | 'admin'
  // Whether this user may accept (approve) bills in the Kassa module.
  // Always true for admins; members need the `is_kassier` flag.
  is_kassier: boolean
}

/** Public preview of a pending invite (`GET /auth/invite/:token`). */
export type InvitePreview = {
  first_name: string
  last_name: string
}
