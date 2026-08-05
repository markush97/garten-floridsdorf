import { z } from 'zod'
import { timeOfDaySchema } from './event'

// Calendar date in YYYY-MM-DD form (Vienna wall date).
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datum (JJJJ-MM-TT)')

const optionalShortText = z
  .preprocess(
    (v) => (v == null ? '' : v),
    z
      .string()
      .max(500)
      .transform((v) => v.trim())
      .transform((v) => (v.length === 0 ? null : v)),
  )
  .nullish()

const optionalLongText = z
  .preprocess(
    (v) => (v == null ? '' : v),
    z
      .string()
      .max(5000)
      .transform((v) => v.trim())
      .transform((v) => (v.length === 0 ? null : v)),
  )
  .nullish()

// ── Member calendar events ──────────────────────────────────────────────────

/**
 * Cross-field rule for the event period, exported as a pure function
 * so the query layer can re-check MERGED values on PATCH (the zod
 * schema can't see unchanged fields). Returns a German message or
 * null.
 */
export function calendarEventPeriodIssue(v: {
  start_date: string
  end_date: string | null
  start_time: string | null
  end_time: string | null
}): string | null {
  if (v.end_date !== null && v.end_date < v.start_date) {
    return 'Das Enddatum liegt vor dem Startdatum.'
  }
  if (v.end_time !== null && v.start_time === null) {
    return 'Eine End-Uhrzeit braucht auch eine Start-Uhrzeit.'
  }
  const singleDay = v.end_date === null || v.end_date === v.start_date
  if (singleDay && v.start_time && v.end_time && v.end_time <= v.start_time) {
    return 'Die End-Uhrzeit liegt vor der Start-Uhrzeit.'
  }
  return null
}

const calendarEventPeriodFields = {
  start_date: isoDateSchema,
  end_date: isoDateSchema.nullish(),
  start_time: timeOfDaySchema.nullish(),
  end_time: timeOfDaySchema.nullish(),
}

export const createCalendarEventInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Bitte einen Titel eingeben.').max(200),
    description: optionalLongText,
    location: optionalShortText,
    ...calendarEventPeriodFields,
  })
  .superRefine((v, ctx) => {
    const issue = calendarEventPeriodIssue({
      start_date: v.start_date,
      end_date: v.end_date ?? null,
      start_time: v.start_time ?? null,
      end_time: v.end_time ?? null,
    })
    if (issue) ctx.addIssue({ code: 'custom', message: issue })
  })

// The period rule is re-checked on the merged row in the query layer,
// so the update schema only validates field shapes.
export const updateCalendarEventInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Bitte einen Titel eingeben.')
    .max(200)
    .optional(),
  description: optionalLongText,
  location: optionalShortText,
  start_date: isoDateSchema.optional(),
  end_date: isoDateSchema.nullish(),
  start_time: timeOfDaySchema.nullish(),
  end_time: timeOfDaySchema.nullish(),
})

// ── Exclusive bookings ──────────────────────────────────────────────────────

// The Statuten rules (lead time, billed days) live in
// `_lib/booking.ts` and run in the query layer — the contract only
// validates field shapes.
export const createBookingInputSchema = z.object({
  start_date: isoDateSchema,
  start_time: timeOfDaySchema,
  end_date: isoDateSchema,
  end_time: timeOfDaySchema,
  note: optionalShortText,
  // Reserve in another member's name — admins only, enforced in the
  // route. Null/absent books for the signed-in member.
  for_user_id: z.number().int().positive().nullish(),
})

export const updateBookingInputSchema = z.object({
  start_date: isoDateSchema.optional(),
  start_time: timeOfDaySchema.optional(),
  end_date: isoDateSchema.optional(),
  end_time: timeOfDaySchema.optional(),
  note: optionalShortText,
})

// ── Merged calendar response ────────────────────────────────────────────────

/** Admin-managed Vereinstermin — read-only in the calendar. */
export const calendarTerminEntrySchema = z.object({
  kind: z.literal('termin'),
  id: z.number(),
  slug: z.string(),
  title: z.string(),
  date: z.string(),
  time: z.string().nullable(),
  location: z.string().nullable(),
})

export const calendarEventEntrySchema = z.object({
  kind: z.literal('event'),
  id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  start_date: z.string(),
  end_date: z.string().nullable(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  created_by_user_id: z.number().nullable(),
  created_by_name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const calendarBookingEntrySchema = z.object({
  kind: z.literal('booking'),
  id: z.number(),
  user_id: z.number().nullable(),
  user_name: z.string(),
  start_at: z.string(),
  end_at: z.string(),
  // Vienna wall times derived server-side from the UTC instants so
  // the client never re-implements the timezone conversion.
  start_date: z.string(),
  start_time: z.string(),
  end_date: z.string(),
  end_time: z.string(),
  billed_days: z.number(),
  note: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const calendarEntrySchema = z.discriminatedUnion('kind', [
  calendarTerminEntrySchema,
  calendarEventEntrySchema,
  calendarBookingEntrySchema,
])

export const calendarResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  entries: z.array(calendarEntrySchema),
})

export type CreateCalendarEventInput = z.infer<
  typeof createCalendarEventInputSchema
>
export type UpdateCalendarEventInput = z.infer<
  typeof updateCalendarEventInputSchema
>
export type CreateBookingInput = z.infer<typeof createBookingInputSchema>
export type UpdateBookingInput = z.infer<typeof updateBookingInputSchema>
export type CalendarTerminEntry = z.infer<typeof calendarTerminEntrySchema>
export type CalendarEventEntry = z.infer<typeof calendarEventEntrySchema>
export type CalendarBookingEntry = z.infer<typeof calendarBookingEntrySchema>
export type CalendarEntry = z.infer<typeof calendarEntrySchema>
export type CalendarResponse = z.infer<typeof calendarResponseSchema>

/** A member option for the "reserve for" picker. */
export type CalendarMember = {
  user_id: number
  name: string
}

// ── Personal iCal feed token ────────────────────────────────────────────────

/** Shape of `GET /me/calendar-token`. */
export type CalendarFeedTokenStatus = {
  exists: boolean
  token_fingerprint: string | null
  created_at: string | null
  last_used_at: string | null
}

/** Shape of `POST /me/calendar-token` — the plaintext appears exactly once. */
export type CreateCalendarFeedTokenResponse = {
  url: string
  token_fingerprint: string
}
