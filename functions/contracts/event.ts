import { z } from 'zod'

// Time of day in 24h HH:mm format (e.g. "14:30"). Mirrors the poll
// option validation so the same input rules apply across the app.
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Ungültige Uhrzeit (HH:mm)')

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
      .max(50_000)
      .transform((v) => v.trim())
      .transform((v) => (v.length === 0 ? null : v)),
  )
  .nullish()

// ── Event core ────────────────────────────────────────────────────────────

export const eventSchema = z.object({
  id: z.number(),
  slug: z.string(),
  poll_id: z.number().nullable(),
  title: z.string(),
  scheduled_date: z.string(),
  scheduled_time: z.string().nullable(),
  location: z.string().nullable(),
  agenda: z.string().nullable(),
  transcription: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const createEventInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  scheduled_date: z.string().min(1),
  scheduled_time: timeOfDaySchema.nullish(),
  location: optionalShortText,
  agenda: optionalLongText,
  transcription: optionalLongText,
  poll_id: z.number().int().positive().nullish(),
})

export const updateEventInputSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  scheduled_date: z.string().min(1).optional(),
  scheduled_time: timeOfDaySchema.nullish(),
  location: optionalShortText,
  agenda: optionalLongText,
  transcription: optionalLongText,
})

// ── Planned / actual attendees ────────────────────────────────────────────

export const eventAttendeeSchema = z.object({
  id: z.number(),
  event_id: z.number(),
  user_id: z.number().nullable(),
  name: z.string(),
  sort_order: z.number(),
})

export const createEventAttendeeInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  user_id: z.number().int().positive().nullish(),
})

export const updateEventAttendeesInputSchema = z.object({
  attendees: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        user_id: z.number().int().positive().nullish(),
      }),
    )
    .max(500),
})

// ── Agenda items ──────────────────────────────────────────────────────────

export const AGENDA_STATUSES = ['open', 'discussed', 'skipped'] as const
export const agendaStatusSchema = z.enum(AGENDA_STATUSES)

export const eventAgendaItemSchema = z.object({
  id: z.number(),
  event_id: z.number(),
  title: z.string(),
  notes: z.string().nullable(),
  status: agendaStatusSchema,
  sort_order: z.number(),
})

export const createEventAgendaItemInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: optionalLongText,
  status: agendaStatusSchema.optional(),
})

export const updateEventAgendaItemInputSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  notes: optionalLongText,
  status: agendaStatusSchema.optional(),
})

export const reorderEventAgendaItemsInputSchema = z.object({
  order: z.array(z.number().int().positive()).min(1).max(200),
})

// ── Agenda votes ──────────────────────────────────────────────────────────

export const AGENDA_VOTE_TYPES = ['yn', 'options'] as const
export const agendaVoteTypeSchema = z.enum(AGENDA_VOTE_TYPES)

export const AGENDA_COUNTING_MODES = ['anonymous', 'per_attendee'] as const
export const agendaCountingModeSchema = z.enum(AGENDA_COUNTING_MODES)

export const eventAgendaVoteOptionSchema = z.object({
  id: z.number(),
  vote_id: z.number(),
  label: z.string(),
  count: z.number(),
  sort_order: z.number(),
})

export const eventAgendaVoteSchema = z.object({
  id: z.number(),
  agenda_item_id: z.number(),
  question: z.string(),
  vote_type: agendaVoteTypeSchema,
  counting_mode: agendaCountingModeSchema,
  result_note: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  options: z.array(eventAgendaVoteOptionSchema),
  attendee_votes: z.array(
    z.object({
      attendee_id: z.number(),
      option_id: z.number().nullable(),
      response: z.boolean().nullable(),
    }),
  ),
})

export const createEventAgendaVoteInputSchema = z
  .object({
    question: z.string().trim().min(1).max(300),
    vote_type: agendaVoteTypeSchema,
    counting_mode: agendaCountingModeSchema,
    result_note: optionalLongText,
    options: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(200),
        }),
      )
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (
      val.vote_type === 'options' &&
      (!val.options || val.options.length < 2)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message:
          'Bei einer Optionsabstimmung sind mindestens 2 Optionen nötig.',
      })
    }
  })

export const updateEventAgendaVoteInputSchema = z.object({
  question: z.string().trim().min(1).max(300).optional(),
  result_note: optionalLongText,
  options: z
    .array(
      z.object({
        id: z.number().int().positive().optional(),
        label: z.string().trim().min(1).max(200),
        count: z.number().int().min(0).optional(),
      }),
    )
    .optional(),
})

export const updateAttendeeVoteInputSchema = z.object({
  option_id: z.number().int().positive().nullable(),
  response: z.boolean().nullable(),
})

// ── Attachments ───────────────────────────────────────────────────────────

/** Hard cap on a single attachment. The worker also enforces this. */
export const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024

/** Content types we accept for event attachments. Other types are rejected
 *  with a 415 by the worker. We use literal prefixes for image/* and
 *  exact matches for document types. */
export const ATTACHMENT_IMAGE_PREFIX = 'image/'
export const ATTACHMENT_PDF_TYPE = 'application/pdf'

/** Returns true when the content type is allowed for upload. Kept here
 *  (not in the worker) so client-side pre-flight checks share the same
 *  rule as the server. */
export function isAllowedAttachmentContentType(contentType: string): boolean {
  if (contentType.startsWith(ATTACHMENT_IMAGE_PREFIX)) return true
  if (contentType === ATTACHMENT_PDF_TYPE) return true
  return false
}

export const eventAttachmentSchema = z.object({
  id: z.number(),
  event_id: z.number(),
  agenda_item_id: z.number().nullable(),
  filename: z.string(),
  content_type: z.string(),
  size: z.number(),
  r2_key: z.string(),
  caption: z.string().nullable(),
  uploaded_by_user_id: z.number().nullable(),
  created_at: z.string(),
})

/** The metadata the client can patch after a successful upload — currently
 *  just the caption and (optionally) which agenda item it's attached to. */
export const updateEventAttachmentInputSchema = z
  .object({
    caption: optionalLongText,
    agenda_item_id: z.number().int().positive().nullable().optional(),
  })
  .strict()

// ── Composite "with details" response ────────────────────────────────────

export const eventWithDetailsSchema = eventSchema.extend({
  planned_attendees: z.array(eventAttendeeSchema),
  actual_attendees: z.array(eventAttendeeSchema),
  attachments: z.array(eventAttachmentSchema),
  agenda_items: z.array(
    eventAgendaItemSchema.extend({
      votes: z.array(eventAgendaVoteSchema),
      attachments: z.array(eventAttachmentSchema),
    }),
  ),
})

// ── Inferred types ────────────────────────────────────────────────────────

export type Event = z.infer<typeof eventSchema>
export type CreateEventInput = z.infer<typeof createEventInputSchema>
export type UpdateEventInput = z.infer<typeof updateEventInputSchema>
export type EventAttendee = z.infer<typeof eventAttendeeSchema>
export type CreateEventAttendeeInput = z.infer<
  typeof createEventAttendeeInputSchema
>
export type UpdateEventAttendeesInput = z.infer<
  typeof updateEventAttendeesInputSchema
>
export type AgendaStatus = z.infer<typeof agendaStatusSchema>
export type EventAgendaItem = z.infer<typeof eventAgendaItemSchema>
export type CreateEventAgendaItemInput = z.infer<
  typeof createEventAgendaItemInputSchema
>
export type UpdateEventAgendaItemInput = z.infer<
  typeof updateEventAgendaItemInputSchema
>
export type AgendaVoteType = z.infer<typeof agendaVoteTypeSchema>
export type AgendaCountingMode = z.infer<typeof agendaCountingModeSchema>
export type EventAgendaVote = z.infer<typeof eventAgendaVoteSchema>
export type EventAgendaVoteOption = z.infer<typeof eventAgendaVoteOptionSchema>
export type CreateEventAgendaVoteInput = z.infer<
  typeof createEventAgendaVoteInputSchema
>
export type UpdateEventAgendaVoteInput = z.infer<
  typeof updateEventAgendaVoteInputSchema
>
export type UpdateAttendeeVoteInput = z.infer<
  typeof updateAttendeeVoteInputSchema
>
export type EventWithDetails = z.infer<typeof eventWithDetailsSchema>
export type EventAttachment = z.infer<typeof eventAttachmentSchema>
export type UpdateEventAttachmentInput = z.infer<
  typeof updateEventAttachmentInputSchema
>
