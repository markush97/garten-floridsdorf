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
        response: z.enum(['yes', 'no', 'maybe']),
        comment: z.string().max(500).optional(),
      }),
    )
    .min(1),
})

export const adminLoginInputSchema = z.object({
  password: z.string().min(1),
})

export const finalizePollInputSchema = z.object({
  final_option_id: z.number().nullable().optional(),
  closed: z.boolean().optional(),
})

export type PollOption = z.infer<typeof pollOptionSchema>
export type Vote = z.infer<typeof voteSchema>
export type Poll = z.infer<typeof pollSchema>
export type CreatePollInput = z.infer<typeof createPollInputSchema>
export type SubmitVotesInput = z.infer<typeof submitVotesInputSchema>
export type FinalizePollInput = z.infer<typeof finalizePollInputSchema>
