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
  adminLoginInputSchema,
  createPollInputSchema,
  finalizePollInputSchema,
  submitVotesInputSchema,
} from '../functions/contracts/poll'
import {
  createPollWithOptions,
  deletePoll,
  finalizePoll,
  findActivePollWithDetails,
  findPollWithDetails,
  listAllPolls,
  upsertVotes,
} from '../functions/db/queries/polls'

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
      err.status as 400 | 401 | 403 | 404 | 409 | 500,
    )
  }
  console.error(err)
  return c.json(makeError('INTERNAL_ERROR', 'Interner Serverfehler'), 500)
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

app.get('/polls/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const poll = await findPollWithDetails(db, id)
  return c.json(poll)
})

app.post('/polls/:id/votes', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const body = await c.req.json()
  const parsed = submitVotesInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(makeError('VALIDATION_ERROR', parsed.error.message), 400)
  }
  const db = createDb(c.env.DB)
  await upsertVotes(db, id, parsed.data.voter_name, parsed.data.responses)
  const poll = await findPollWithDetails(db, id)
  return c.json(poll)
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

app.delete('/admin/polls/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  await deletePoll(db, id)
  return c.json({ ok: true })
})

export default app
