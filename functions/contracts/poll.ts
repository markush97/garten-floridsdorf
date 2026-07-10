import { z } from 'zod'

// Time of day in 24h HH:mm format (e.g. "14:30").
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Ungültige Uhrzeit (HH:mm)')

export const pollOptionSchema = z.object({
  id: z.number(),
  poll_id: z.number(),
  label: z.string(),
  date: z.string(),
  time: z.string().nullable(),
  sort_order: z.number(),
})

export const voteSchema = z.object({
  id: z.number(),
  poll_id: z.number(),
  option_id: z.number(),
  voter_name: z.string(),
  response: z.enum(['yes', 'no', 'maybe']),
  comment: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const pollSchema = z.object({
  id: z.number(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
  final_option_id: z.number().nullable(),
  created_at: z.string(),
  closed_at: z.string().nullable(),
  options: z.array(pollOptionSchema),
  votes: z.array(voteSchema),
})

export const createPollInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional(),
  options: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        date: z.string().min(1),
        time: timeOfDaySchema.optional(),
      }),
    )
    .min(1)
    .max(20),
})

export const submitVotesInputSchema = z.object({
  voter_name: z.string().min(1).max(100),
  responses: z
    .array(
      z.object({
        option_id: z.number().int().positive(),
        // `null` clears any existing vote for this option ("keine Angabe").
        response: z.enum(['yes', 'no', 'maybe']).nullable(),
        comment: z.string().max(500).optional(),
      }),
    )
    .min(1),
})

export const finalizePollInputSchema = z.object({
  final_option_id: z.number().nullable().optional(),
  closed: z.boolean().optional(),
})

export const addPollOptionsInputSchema = z.object({
  options: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        date: z.string().min(1),
        time: timeOfDaySchema.optional(),
      }),
    )
    .min(1)
    .max(20),
})

export type PollOption = z.infer<typeof pollOptionSchema>
export type Vote = z.infer<typeof voteSchema>
export type Poll = z.infer<typeof pollSchema>
export type CreatePollInput = z.infer<typeof createPollInputSchema>
export type SubmitVotesInput = z.infer<typeof submitVotesInputSchema>
export type FinalizePollInput = z.infer<typeof finalizePollInputSchema>
export type AddPollOptionsInput = z.infer<typeof addPollOptionsInputSchema>

export const nextEventSchema = z.object({
  poll_id: z.number(),
  slug: z.string(),
  title: z.string(),
  option: pollOptionSchema,
})
export type NextEvent = z.infer<typeof nextEventSchema>

/**
 * A share token that grants access to view and vote on a single poll
 * without logging in. Mirrors `eventShareTokenSchema` in
 * `functions/contracts/event.ts`.
 */
export const pollShareTokenSchema = z.object({
  id: z.number(),
  poll_id: z.number(),
  // Never the raw token. We expose a short fingerprint prefix so the
  // admin can tell tokens apart in the list view without seeing the
  // secret itself.
  token_fingerprint: z.string(),
  label: z.string().nullable(),
  created_at: z.string(),
  expires_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
  last_hit_at: z.string().nullable(),
})

export const createPollShareTokenInputSchema = z
  .object({
    label: z
      .union([z.string().max(200), z.null()])
      .transform((v) => (v == null ? null : v.trim()))
      .transform((v) => (v == null || v.length === 0 ? null : v))
      .optional(),
    expires_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum im Format YYYY-MM-DD')
      .nullable()
      .optional(),
  })
  .strict()

/**
 * The full response shape returned when the admin creates a new
 * share token. Includes the plaintext token exactly once — the
 * admin UI must show it then forget it.
 */
export const createPollShareTokenResponseSchema = z.object({
  token: pollShareTokenSchema,
  plaintext: z.string().regex(/^[A-Za-z0-9_-]+$/),
})

export type PollShareToken = z.infer<typeof pollShareTokenSchema>
export type CreatePollShareTokenInput = z.infer<
  typeof createPollShareTokenInputSchema
>
export type CreatePollShareTokenResponse = z.infer<
  typeof createPollShareTokenResponseSchema
>
