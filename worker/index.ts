import { and, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  requireAdmin,
  setAdminCookie,
  signAdminToken,
  verifyPassword,
} from '../functions/_lib/auth'
import { createDb } from '../functions/_lib/db'
import { AppError, makeError } from '../functions/_lib/errors'
import {
  createEventAgendaItemInputSchema,
  createEventAgendaVoteInputSchema,
  createEventAttendeeInputSchema,
  createEventInputSchema,
  isAllowedAttachmentContentType,
  MAX_ATTACHMENT_SIZE_BYTES,
  reorderEventAgendaItemsInputSchema,
  updateAttendeeVoteInputSchema,
  updateEventAgendaItemInputSchema,
  updateEventAgendaVoteInputSchema,
  updateEventAttachmentInputSchema,
  updateEventAttendeesInputSchema,
  updateEventInputSchema,
} from '../functions/contracts/event'
import {
  addPollOptionsInputSchema,
  adminLoginInputSchema,
  createPollInputSchema,
  finalizePollInputSchema,
  submitVotesInputSchema,
} from '../functions/contracts/poll'
import {
  createUserInputSchema,
  updateUserInputSchema,
} from '../functions/contracts/user'
import {
  addActualAttendee,
  addAgendaItem,
  addAgendaVote,
  addAttachment,
  addPlannedAttendee,
  createEvent,
  deleteAgendaItem,
  deleteAgendaVote,
  deleteAttachment,
  deleteEvent,
  findAttachmentOrThrow,
  findEventBySlugOrThrow,
  findEventForPoll,
  findEventWithDetails,
  listAllEvents,
  removeActualAttendee,
  removePlannedAttendee,
  reorderAgendaItems,
  replaceActualAttendees,
  replacePlannedAttendees,
  setAttendeeVote,
  updateAgendaItem,
  updateAgendaVote,
  updateAttachment,
  updateEvent,
} from '../functions/db/queries/events'
import {
  addPollOptions,
  createPollWithOptions,
  deletePoll,
  finalizePoll,
  findActivePollWithDetails,
  findNextLockedEvent,
  findPollWithDetailsBySlug,
  listAllPolls,
  upsertVotes,
} from '../functions/db/queries/polls'
import {
  createUser,
  deleteUser,
  findUserBySlugOrThrow,
  listAllUsers,
  updateUser,
} from '../functions/db/queries/users'
import { ip_vote_counts } from '../functions/db/schema'

type AppEnv = {
  Bindings: {
    DB: D1Database
    ADMIN_PASSWORD: string
    JWT_SECRET: string
    ATTACHMENTS: R2Bucket
  }
}

const app = new Hono<AppEnv>().basePath('/api')

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(
      makeError(err.code, err.message),
      err.status as 400 | 401 | 403 | 404 | 409 | 429 | 500,
    )
  }
  console.error('[worker]', err)
  if (err instanceof Error && err.cause) {
    console.error('[worker] cause:', err.cause)
  }
  const detail = err instanceof Error ? err.message : String(err)
  const causeDetail =
    err instanceof Error && err.cause instanceof Error
      ? ` | cause: ${err.cause.message}`
      : ''
  return c.json(
    makeError(
      'INTERNAL_ERROR',
      `Interner Serverfehler: ${detail}${causeDetail}`,
    ),
    500,
  )
})

// ── Public endpoints ────────────────────────────────────────────────────────

app.get('/polls/active', async (c) => {
  const db = createDb(c.env.DB)
  const poll = await findActivePollWithDetails(db)
  if (!poll) {
    return c.json(makeError('NOT_FOUND', 'Keine aktive Umfrage'), 404)
  }
  return c.json(poll)
})

app.get('/polls/next', async (c) => {
  const db = createDb(c.env.DB)
  const event = await findNextLockedEvent(db)
  if (!event) {
    return c.json(makeError('NOT_FOUND', 'Kein bevorstehender Termin'), 404)
  }
  return c.json({
    poll_id: event.pollId,
    slug: event.slug,
    title: event.title,
    option: event.option,
  })
})

app.get('/polls/:slug', async (c) => {
  const slug = c.req.param('slug')
  const db = createDb(c.env.DB)
  const poll = await findPollWithDetailsBySlug(db, slug)
  return c.json(poll)
})

app.post('/polls/:slug/votes', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()
  const parsed = submitVotesInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  const db = createDb(c.env.DB)
  const poll = await findPollWithDetailsBySlug(db, slug)

  const VOTE_LIMIT = 5
  const ip =
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  const existing = await db
    .select({ count: ip_vote_counts.count })
    .from(ip_vote_counts)
    .where(and(eq(ip_vote_counts.ip, ip), eq(ip_vote_counts.poll_id, poll.id)))
    .get()
  if ((existing?.count ?? 0) >= VOTE_LIMIT) {
    throw new AppError(
      'RATE_LIMITED',
      'Zu viele Abstimmungen von dieser IP-Adresse. Bitte später erneut versuchen.',
      429,
    )
  }

  await upsertVotes(db, poll.id, parsed.data.voter_name, parsed.data.responses)

  await db
    .insert(ip_vote_counts)
    .values({ ip, poll_id: poll.id, count: 1 })
    .onConflictDoUpdate({
      target: [ip_vote_counts.ip, ip_vote_counts.poll_id],
      set: { count: sql`${ip_vote_counts.count} + 1` },
    })

  return c.json(await findPollWithDetailsBySlug(db, slug))
})

// ── Admin endpoints ─────────────────────────────────────────────────────────

app.post('/admin/login', async (c) => {
  const body = await c.req.json()
  const parsed = adminLoginInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  const ok = await verifyPassword(parsed.data.password, c.env.ADMIN_PASSWORD)
  if (!ok) {
    return c.json(makeError('UNAUTHORIZED', 'Falsches Passwort'), 401)
  }
  const token = await signAdminToken(c.env.JWT_SECRET)
  setAdminCookie(c, token)
  return c.json({ ok: true })
})

app.use('/admin/*', requireAdmin)

app.get('/admin/polls', async (c) => {
  const db = createDb(c.env.DB)
  const allPolls = await listAllPolls(db)
  return c.json(allPolls)
})

app.post('/admin/polls', async (c) => {
  const body = await c.req.json()
  const parsed = createPollInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  const db = createDb(c.env.DB)
  const poll = await createPollWithOptions(db, parsed.data)
  return c.json(poll, 201)
})

app.patch('/admin/polls/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const body = await c.req.json()
  const parsed = finalizePollInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  const db = createDb(c.env.DB)
  const poll = await finalizePoll(db, id, parsed.data)
  return c.json(poll)
})

app.post('/admin/polls/:id/options', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const body = await c.req.json()
  const parsed = addPollOptionsInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  const db = createDb(c.env.DB)
  const poll = await addPollOptions(db, id, parsed.data)
  return c.json(poll)
})

app.delete('/admin/polls/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  await deletePoll(db, id)
  return c.json({ ok: true })
})

app.get('/admin/users', async (c) => {
  const db = createDb(c.env.DB)
  return c.json(await listAllUsers(db))
})

app.post('/admin/users', async (c) => {
  const body = await c.req.json()
  const parsed = createUserInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  const db = createDb(c.env.DB)
  const user = await createUser(db, parsed.data)
  return c.json(user, 201)
})

app.get('/admin/users/:slug', async (c) => {
  const slug = c.req.param('slug')
  const db = createDb(c.env.DB)
  const user = await findUserBySlugOrThrow(db, slug)
  return c.json(user)
})

app.patch('/admin/users/:slug', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()
  const parsed = updateUserInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  const db = createDb(c.env.DB)
  // Resolve slug → id once so the update query hits the same row.
  const existing = await findUserBySlugOrThrow(db, slug)
  const user = await updateUser(db, existing.id, parsed.data)
  return c.json(user)
})

app.delete('/admin/users/:slug', async (c) => {
  const slug = c.req.param('slug')
  const db = createDb(c.env.DB)
  const existing = await findUserBySlugOrThrow(db, slug)
  await deleteUser(db, existing.id)
  return c.json({ ok: true })
})

// ── Events ────────────────────────────────────────────────────────────────

app.get('/admin/events', async (c) => {
  const db = createDb(c.env.DB)
  return c.json(await listAllEvents(db))
})

app.get('/admin/events/by-poll/:pollId', async (c) => {
  const pollId = Number(c.req.param('pollId'))
  if (!Number.isInteger(pollId) || pollId <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const event = await findEventForPoll(db, pollId)
  return c.json(event)
})

app.post('/admin/events', async (c) => {
  const body = await c.req.json()
  const parsed = createEventInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  const db = createDb(c.env.DB)
  const event = await createEvent(db, parsed.data)
  return c.json(event, 201)
})

app.get('/admin/events/:slug', async (c) => {
  const slug = c.req.param('slug')
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  return c.json(await findEventWithDetails(db, event.id))
})

app.patch('/admin/events/:slug', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()
  const parsed = updateEventInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  await updateEvent(db, event.id, parsed.data)
  return c.json(await findEventWithDetails(db, event.id))
})

app.delete('/admin/events/:slug', async (c) => {
  const slug = c.req.param('slug')
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  await deleteEvent(db, event.id)
  return c.json({ ok: true })
})

app.put('/admin/events/:slug/planned-attendees', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()
  const parsed = updateEventAttendeesInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  return c.json(await replacePlannedAttendees(db, event.id, parsed.data))
})

app.put('/admin/events/:slug/actual-attendees', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()
  const parsed = updateEventAttendeesInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  return c.json(await replaceActualAttendees(db, event.id, parsed.data))
})

app.post('/admin/events/:slug/planned-attendees/single', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()
  const parsed = createEventAttendeeInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  return c.json(await addPlannedAttendee(db, event.id, parsed.data), 201)
})

app.post('/admin/events/:slug/actual-attendees/single', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()
  const parsed = createEventAttendeeInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  return c.json(await addActualAttendee(db, event.id, parsed.data), 201)
})

app.delete('/admin/events/:slug/planned-attendees/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  await removePlannedAttendee(db, event.id, id)
  return c.json({ ok: true })
})

app.delete('/admin/events/:slug/actual-attendees/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  await removeActualAttendee(db, event.id, id)
  return c.json({ ok: true })
})

// ── Agenda items + votes ──────────────────────────────────────────────────

app.post('/admin/events/:slug/agenda-items', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()
  const parsed = createEventAgendaItemInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  const item = await addAgendaItem(db, event.id, parsed.data)
  return c.json(item, 201)
})

app.patch('/admin/events/:slug/agenda-items/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const body = await c.req.json()
  const parsed = updateEventAgendaItemInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  const item = await updateAgendaItem(db, event.id, id, parsed.data)
  return c.json(item)
})

app.delete('/admin/events/:slug/agenda-items/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  await deleteAgendaItem(db, event.id, id)
  return c.json({ ok: true })
})

app.put('/admin/events/:slug/agenda-items/order', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()
  const parsed = reorderEventAgendaItemsInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  return c.json(await reorderAgendaItems(db, event.id, parsed.data.order))
})

app.post('/admin/events/:slug/agenda-items/:id/votes', async (c) => {
  const slug = c.req.param('slug')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const body = await c.req.json()
  const parsed = createEventAgendaVoteInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  return c.json(await addAgendaVote(db, event.id, id, parsed.data), 201)
})

app.patch('/admin/events/:slug/agenda-votes/:voteId', async (c) => {
  const slug = c.req.param('slug')
  const voteId = Number(c.req.param('voteId'))
  if (!Number.isInteger(voteId) || voteId <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const body = await c.req.json()
  const parsed = updateEventAgendaVoteInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  // Slug is part of the URL for consistency; we don't need to load the
  // event here, the vote query is enough.
  void (await findEventBySlugOrThrow(createDb(c.env.DB), slug))
  const db = createDb(c.env.DB)
  return c.json(await updateAgendaVote(db, voteId, parsed.data))
})

app.delete('/admin/events/:slug/agenda-votes/:voteId', async (c) => {
  const slug = c.req.param('slug')
  const voteId = Number(c.req.param('voteId'))
  if (!Number.isInteger(voteId) || voteId <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  void (await findEventBySlugOrThrow(createDb(c.env.DB), slug))
  const db = createDb(c.env.DB)
  await deleteAgendaVote(db, voteId)
  return c.json({ ok: true })
})

app.put(
  '/admin/events/:slug/agenda-votes/:voteId/attendees/:attendeeId',
  async (c) => {
    const slug = c.req.param('slug')
    const voteId = Number(c.req.param('voteId'))
    const attendeeId = Number(c.req.param('attendeeId'))
    if (
      !Number.isInteger(voteId) ||
      voteId <= 0 ||
      !Number.isInteger(attendeeId) ||
      attendeeId <= 0
    ) {
      return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
    }
    const body = await c.req.json()
    const parsed = updateAttendeeVoteInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
    }
    void (await findEventBySlugOrThrow(createDb(c.env.DB), slug))
    const db = createDb(c.env.DB)
    return c.json(await setAttendeeVote(db, voteId, attendeeId, parsed.data))
  },
)

// ── Attachments ───────────────────────────────────────────────────────────

/**
 * Sanitises a user-supplied filename for use in the `Content-Disposition`
 * header. We strip control chars, keep the extension, and fall back to
 * a safe default if everything else is removed.
 */
function safeFilename(input: string): string {
  // We whitelist rather than blacklist: any char that's not a letter,
  // digit, dot, underscore or hyphen gets squashed to `_`. This is
  // bulletproof against control chars, quotes, backslashes and
  // directory-traversal sequences in one go.
  const cleaned = input
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 200)
  return cleaned.length > 0 ? cleaned : 'anhang'
}

app.post('/admin/events/:slug/attachments', async (c) => {
  const slug = c.req.param('slug')
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  const body = await c.req.parseBody()
  const file = body.file
  const caption = body.caption
  const agendaItemIdRaw = body.agenda_item_id

  if (!(file instanceof File)) {
    return c.json(
      makeError('VALIDATION_ERROR', 'Datei fehlt (Feld „file“).'),
      400,
    )
  }
  if (!isAllowedAttachmentContentType(file.type)) {
    return c.json(
      makeError(
        'VALIDATION_ERROR',
        'Dateityp nicht erlaubt. Erlaubt: Bilder und PDF.',
      ),
      400,
    )
  }
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return c.json(
      makeError(
        'VALIDATION_ERROR',
        `Datei zu groß (max ${Math.round(MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024)} MB).`,
      ),
      400,
    )
  }

  // Scope the agenda item to this event.
  let agendaItemId: number | null = null
  if (typeof agendaItemIdRaw === 'string' && agendaItemIdRaw.length > 0) {
    const parsed = Number(agendaItemIdRaw)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return c.json(makeError('VALIDATION_ERROR', 'Ungültige Agenda-ID'), 400)
    }
    agendaItemId = parsed
  }

  // Generate a stable, collision-resistant R2 key.
  const safeName = safeFilename(file.name)
  const key = `events/${event.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`

  await c.env.ATTACHMENTS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalFilename: safeName },
  })

  const captionText = typeof caption === 'string' ? caption : null
  const row = await addAttachment(db, event.id, {
    filename: safeName,
    content_type: file.type,
    r2_key: key,
    size: file.size,
    agenda_item_id: agendaItemId,
    caption: captionText,
  })
  return c.json(row, 201)
})

app.get('/admin/events/:slug/attachments/:id/download', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const row = await findAttachmentOrThrow(db, id)
  const object = await c.env.ATTACHMENTS.get(row.r2_key)
  if (!object) {
    return c.json(
      makeError('NOT_FOUND', 'Datei nicht im Speicher gefunden.'),
      404,
    )
  }
  const isInline = row.content_type.startsWith('image/')
  const disposition = `${isInline ? 'inline' : 'attachment'}; filename="${safeFilename(row.filename)}"`
  const headers = new Headers()
  headers.set('Content-Type', row.content_type)
  headers.set('Content-Length', String(row.size))
  headers.set('Content-Disposition', disposition)
  headers.set('Cache-Control', 'private, max-age=300')
  return new Response(object.body, { headers })
})

app.patch('/admin/events/:slug/attachments/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const body = await c.req.json()
  const parsed = updateEventAttachmentInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  void (await findEventBySlugOrThrow(createDb(c.env.DB), c.req.param('slug')))
  const db = createDb(c.env.DB)
  const row = await updateAttachment(db, id, parsed.data)
  return c.json(row)
})

app.delete('/admin/events/:slug/attachments/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  void (await findEventBySlugOrThrow(createDb(c.env.DB), c.req.param('slug')))
  const db = createDb(c.env.DB)
  await deleteAttachment(db, c.env.ATTACHMENTS, id)
  return c.json({ ok: true })
})

export default app
