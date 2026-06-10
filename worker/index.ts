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

export default app
