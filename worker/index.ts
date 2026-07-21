import { and, eq, sql } from 'drizzle-orm'
import { type Context, Hono } from 'hono'
import {
  type AuthVariables,
  clearSessionCookie,
  getSession,
  requireAdmin,
  requireAuth,
  type Session,
  setSessionCookie,
  signSessionToken,
} from '../functions/_lib/auth'
import { utcToBookingPeriod } from '../functions/_lib/booking'
import { feedEntriesFromCalendar } from '../functions/_lib/calendar-feed'
import {
  formatBookingWhen,
  formatEventWhen,
  formatTerminWhen,
  notifyCalendarChange,
} from '../functions/_lib/calendar-notifications'
import { dayjs, nowUtc, toVienna } from '../functions/_lib/dayjs'
import { createDb } from '../functions/_lib/db'
import { sendMagicLinkEmail } from '../functions/_lib/email'
import { AppError, makeError, zodErrorMessage } from '../functions/_lib/errors'
import {
  buildCalendarFeed,
  buildEventIcal,
  ICAL_CONTENT_TYPE,
} from '../functions/_lib/ical'
import { hashPassword, verifyPassword } from '../functions/_lib/password'
import { hashToken, isValidTokenShape } from '../functions/_lib/token'
import {
  acceptInviteInputSchema,
  loginInputSchema,
  magicLinkRequestInputSchema,
  type SessionUser,
} from '../functions/contracts/auth'
import {
  createBankEntryInputSchema,
  createExpenseInputSchema,
  rejectExpenseInputSchema,
  updateBankEntryInputSchema,
  updateExpenseInputSchema,
} from '../functions/contracts/bookkeeping'
import {
  type CalendarBookingEntry,
  type CalendarEntry,
  type CalendarEventEntry,
  type CalendarFeedTokenStatus,
  type CalendarTerminEntry,
  type CreateCalendarFeedTokenResponse,
  createBookingInputSchema,
  createCalendarEventInputSchema,
  updateBookingInputSchema,
  updateCalendarEventInputSchema,
} from '../functions/contracts/calendar'
import {
  createDocumentShareTokenInputSchema,
  createFolderInputSchema,
  isAllowedDocumentContentType,
  MAX_DOCUMENT_SIZE_BYTES,
  updateDocumentInputSchema,
  updateFolderInputSchema,
} from '../functions/contracts/document'
import {
  carryOverTaskInputSchema,
  createEventAgendaItemInputSchema,
  createEventAgendaVoteInputSchema,
  createEventAttendeeInputSchema,
  createEventDecisionInputSchema,
  createEventInputSchema,
  createEventShareTokenInputSchema,
  createEventTaskInputSchema,
  isAllowedAttachmentContentType,
  MAX_ATTACHMENT_SIZE_BYTES,
  reorderEventAgendaItemsInputSchema,
  updateAttendeeVoteInputSchema,
  updateEventAgendaItemInputSchema,
  updateEventAgendaVoteInputSchema,
  updateEventAttachmentInputSchema,
  updateEventAttendeesInputSchema,
  updateEventDecisionInputSchema,
  updateEventInputSchema,
  updateEventTaskInputSchema,
} from '../functions/contracts/event'
import {
  addPollOptionsInputSchema,
  createPollInputSchema,
  createPollShareTokenInputSchema,
  finalizePollInputSchema,
  submitVotesInputSchema,
} from '../functions/contracts/poll'
import {
  createTaskInputSchema,
  subtaskInputSchema,
  updateSubtaskInputSchema,
  updateTaskInputSchema,
  updateTaskSeriesInputSchema,
} from '../functions/contracts/task'
import {
  changePasswordInputSchema,
  createUserInputSchema,
  updateMyProfileInputSchema,
  updateUserInputSchema,
} from '../functions/contracts/user'
import {
  activateUser,
  consumeAuthToken,
  createAuthToken,
  enforceRateLimit,
  findActivatedUsersByEmail,
  findUserByUsername,
  resolveAuthToken,
} from '../functions/db/queries/auth'
import {
  cancelBooking,
  createBooking,
  findBookingOrThrow,
  updateBooking,
} from '../functions/db/queries/bookings'
import {
  approveExpense,
  canApproveExpenses,
  createBankEntry,
  createExpense,
  deleteBankEntry,
  deleteExpense,
  findExpenseOrThrow,
  getKassaOverview,
  listBankEntries,
  listExpenses,
  listMembers,
  rejectExpense,
  setExpenseReceipt,
  updateBankEntry,
  updateExpense,
} from '../functions/db/queries/bookkeeping'
import { getMergedCalendar } from '../functions/db/queries/calendar'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  findCalendarEventOrThrow,
  updateCalendarEvent,
} from '../functions/db/queries/calendar-events'
import {
  getFeedToken,
  resolveFeedToken,
  revokeFeedToken,
  rotateFeedToken,
} from '../functions/db/queries/calendar-feed-tokens'
import {
  createDocumentShareToken,
  isDocumentShareTokenActive,
  listDocumentShareTokens,
  listFolderShareTokens,
  resolveDocumentShareToken,
  revokeDocumentShareToken,
} from '../functions/db/queries/document-share-tokens'
import {
  addDocument,
  browseFolder,
  createFolder,
  deleteDocument,
  deleteFolder,
  findDocumentOrThrow,
  findFolderOrThrow,
  listAllFolders,
  updateDocument,
  updateFolder,
} from '../functions/db/queries/documents'
import {
  addActualAttendee,
  addAgendaItem,
  addAgendaVote,
  addAttachment,
  addDecision,
  addPlannedAttendee,
  addTask,
  carryOverTask,
  createEvent,
  deleteAgendaItem,
  deleteAgendaVote,
  deleteAttachment,
  deleteDecision,
  deleteEvent,
  deleteTask,
  findAttachmentOrThrow,
  findEventBySlugOrThrow,
  findEventForPoll,
  findEventWithDetails,
  findOpenTasksForCarryOver,
  listAllEvents,
  removeActualAttendee,
  removePlannedAttendee,
  reorderAgendaItems,
  replacePlannedAttendees,
  setAttendeeVote,
  updateAgendaItem,
  updateAgendaVote,
  updateAttachment,
  updateDecision,
  updateEvent,
  updateTask,
} from '../functions/db/queries/events'
import {
  createShareToken as createPollShareToken,
  isShareTokenActive as isPollShareTokenActive,
  listShareTokens as listPollShareTokens,
  resolveShareToken as resolvePollShareToken,
  revokeShareToken as revokePollShareToken,
} from '../functions/db/queries/poll-share-tokens'
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
  createShareToken,
  isShareTokenActive,
  listShareTokens,
  resolveShareToken,
  revokeShareToken,
} from '../functions/db/queries/share-tokens'
import {
  addSubtask,
  createTask,
  deleteSeries,
  deleteSubtask,
  deleteTask as deleteTaskItem,
  findSeriesOrThrow,
  findTaskOrThrow,
  listAssignableMembers,
  listTasks,
  updateSeries,
  updateSubtask,
  updateTask as updateTaskItem,
} from '../functions/db/queries/tasks'
import {
  createUser,
  deleteUser,
  findUserBySlugOrThrow,
  findUserCredentials,
  getProfileOrThrow,
  listAllUsers,
  updatePassword,
  updateProfile,
  updateUser,
} from '../functions/db/queries/users'
import {
  type BookingRow,
  type CalendarEventRow,
  type DocumentShareTokenRow,
  type ExpenseRow,
  ip_vote_counts,
} from '../functions/db/schema'

type AppEnv = {
  Bindings: {
    DB: D1Database
    ADMIN_PASSWORD?: string
    JWT_SECRET: string
    ATTACHMENTS: R2Bucket
    SMTP_RELAY_URL?: string
    SMTP_RELAY_TOKEN?: string
    EMAIL_FROM?: string
  }
  Variables: AuthVariables
}

function clientIp(c: Context<AppEnv>): string {
  return (
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

async function sessionUser(
  db: ReturnType<typeof createDb>,
  session: Session,
): Promise<SessionUser> {
  return {
    user_id: session.userId,
    name: session.name,
    role: session.role,
    // The bill-approval capability, read fresh from the DB so a
    // just-granted Kassier flag isn't stale until the next login.
    is_kassier: await canApproveExpenses(db, session),
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

/**
 * Votes and voter names are visible to anyone who can view a poll, so
 * unlike the read-only event/document share links, poll access is
 * gated: either a signed-in session (member or admin) or a valid,
 * non-revoked, non-expired share token issued for that specific poll.
 */
async function assertPollAccess(
  c: Context<AppEnv>,
  db: ReturnType<typeof createDb>,
  pollId: number,
) {
  const session = await getSession(c)
  if (session) return
  const token = c.req.query('token')
  if (!token || !isValidTokenShape(token)) {
    throw new AppError(
      'UNAUTHORIZED',
      'Anmeldung oder Einladungslink erforderlich',
      401,
    )
  }
  const resolved = await resolvePollShareToken(db, token)
  if (resolved.pollId !== pollId) {
    throw new AppError(
      'UNAUTHORIZED',
      'Anmeldung oder Einladungslink erforderlich',
      401,
    )
  }
}

app.get('/polls/active', async (c) => {
  const db = createDb(c.env.DB)
  const poll = await findActivePollWithDetails(db)
  if (!poll) {
    return c.json(makeError('NOT_FOUND', 'Keine aktive Umfrage'), 404)
  }
  await assertPollAccess(c, db, poll.id)
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
  await assertPollAccess(c, db, poll.id)
  return c.json(poll)
})

app.post('/polls/:slug/votes', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()
  const parsed = submitVotesInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const poll = await findPollWithDetailsBySlug(db, slug)
  await assertPollAccess(c, db, poll.id)

  const VOTE_LIMIT = 5
  const ip = clientIp(c)
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

// ── Auth ────────────────────────────────────────────────────────────────────

async function startSession(
  c: Context<AppEnv>,
  session: Session,
): Promise<SessionUser> {
  setSessionCookie(c, await signSessionToken(c.env.JWT_SECRET, session))
  return sessionUser(createDb(c.env.DB), session)
}

app.post('/auth/login', async (c) => {
  const parsed = loginInputSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  await enforceRateLimit(db, clientIp(c), 'login', 20, 15)
  const { username, password } = parsed.data
  const user = await findUserByUsername(db, username)
  if (user?.password_hash && user.activated_at) {
    if (await verifyPassword(password, user.password_hash)) {
      return c.json(
        await startSession(c, {
          userId: user.id,
          role: user.role,
          name: `${user.first_name} ${user.last_name}`,
        }),
      )
    }
  } else if (!user && username === 'admin' && c.env.ADMIN_PASSWORD) {
    // Bootstrap: until someone claims the "admin" username, the env
    // password signs in as a root admin so the first real accounts
    // can be invited. Compared via hashes to stay constant-time.
    const matches =
      (await hashToken(password)) === (await hashToken(c.env.ADMIN_PASSWORD))
    if (matches) {
      return c.json(
        await startSession(c, {
          userId: null,
          role: 'admin',
          name: 'Administrator',
        }),
      )
    }
  }
  return c.json(
    makeError('UNAUTHORIZED', 'Benutzername oder Passwort falsch'),
    401,
  )
})

/**
 * Requests a magic sign-in link. The response is identical whether
 * or not the address belongs to an account, so the endpoint can't
 * be used to enumerate members. A link is only sent when exactly
 * one activated account matches the address.
 */
app.post('/auth/magic-link', async (c) => {
  const parsed = magicLinkRequestInputSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  await enforceRateLimit(db, clientIp(c), 'magic-link', 5, 15)
  const matches = await findActivatedUsersByEmail(db, parsed.data.email)
  const target = matches.length === 1 ? matches[0] : undefined
  if (target?.email) {
    const { plaintext } = await createAuthToken(db, target.id, 'magic_link')
    const url = `${new URL(c.req.url).origin}/api/auth/magic/${plaintext}`
    try {
      await sendMagicLinkEmail(c.env, target.email, url)
    } catch (err) {
      // Swallow provider errors: a 500 here would reveal that the
      // address exists.
      console.error('[auth] magic-link mail failed', err)
    }
  }
  return c.json({ ok: true })
})

/**
 * The link from the magic e-mail. Signs the user in and redirects
 * into the app — invalid or expired links land on the login page
 * with an error flag instead of a JSON error.
 */
app.get('/auth/magic/:token', async (c) => {
  const token = c.req.param('token')
  if (!isValidTokenShape(token)) {
    return c.redirect('/login?magic=invalid')
  }
  const db = createDb(c.env.DB)
  try {
    const { token: row, user } = await resolveAuthToken(db, token, 'magic_link')
    await consumeAuthToken(db, row.id)
    await startSession(c, {
      userId: user.id,
      role: user.role,
      name: `${user.first_name} ${user.last_name}`,
    })
    return c.redirect(user.role === 'admin' ? '/admin/polls' : '/intern')
  } catch {
    return c.redirect('/login?magic=invalid')
  }
})

app.post('/auth/logout', async (c) => {
  clearSessionCookie(c)
  return c.json({ ok: true })
})

app.get('/auth/me', async (c) => {
  const session = await getSession(c)
  if (!session) {
    return c.json(makeError('UNAUTHORIZED', 'Nicht angemeldet'), 401)
  }
  return c.json(await sessionUser(createDb(c.env.DB), session))
})

/** Preview of a pending invite, for the greeting on the accept page. */
app.get('/auth/invite/:token', async (c) => {
  const token = c.req.param('token')
  if (!isValidTokenShape(token)) {
    return c.json(makeError('NOT_FOUND', 'Link ungültig'), 404)
  }
  const db = createDb(c.env.DB)
  const { user } = await resolveAuthToken(db, token, 'invite')
  return c.json({ first_name: user.first_name, last_name: user.last_name })
})

/**
 * Accepts an invite: the user picks username + password and is
 * signed in right away. Re-inviting an already-activated user is
 * the "lost password" flow — accepting resets the credentials.
 */
app.post('/auth/invite/:token', async (c) => {
  const token = c.req.param('token')
  if (!isValidTokenShape(token)) {
    return c.json(makeError('NOT_FOUND', 'Link ungültig'), 404)
  }
  const parsed = acceptInviteInputSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const { token: row, user } = await resolveAuthToken(db, token, 'invite')
  await activateUser(
    db,
    user.id,
    parsed.data.username,
    await hashPassword(parsed.data.password),
  )
  await consumeAuthToken(db, row.id)
  return c.json(
    await startSession(c, {
      userId: user.id,
      role: user.role,
      name: `${user.first_name} ${user.last_name}`,
    }),
    201,
  )
})

// ── Public share endpoint (no auth) ────────────────────────────────────────

/**
 * Returns the public, read-only event payload for a valid share
 * token. Used by the `/termine/:slug/:token` page.
 */
app.get('/share/:token', async (c) => {
  const token = c.req.param('token')
  if (!isValidTokenShape(token)) {
    return c.json(makeError('NOT_FOUND', 'Share-Link nicht gefunden.'), 404)
  }
  const db = createDb(c.env.DB)
  const resolved = await resolveShareToken(db, token)
  return c.json({
    title: resolved.event.title,
    scheduled_date: resolved.event.scheduled_date,
    scheduled_time: resolved.event.scheduled_time,
    location: resolved.event.location,
    agenda: resolved.event.agenda,
    slug: resolved.event.slug,
    label: resolved.label,
    agenda_items: resolved.agenda_items,
  })
})

// ── Documents & folders (all signed-in members) ────────────────────────────

function canManageDocumentTarget(
  session: Session,
  ownerUserId: number | null,
): boolean {
  if (session.role === 'admin') return true
  return session.userId !== null && ownerUserId === session.userId
}

function shapeDocumentShareToken(row: DocumentShareTokenRow) {
  return {
    id: row.id,
    document_id: row.document_id,
    folder_id: row.folder_id,
    token_fingerprint: row.token_hash.slice(0, 8),
    label: row.label,
    created_at: row.created_at,
    expires_at: row.expires_at,
    revoked_at: row.revoked_at,
    last_hit_at: row.last_hit_at,
    is_active: isDocumentShareTokenActive(row),
  }
}

// Flat list of every folder, for the "move to…" picker — the app
// builds paths client-side rather than driving a second in-dialog
// navigation UI.
app.get('/folders', requireAuth, async (c) => {
  const db = createDb(c.env.DB)
  return c.json(await listAllFolders(db))
})

app.get('/documents', requireAuth, async (c) => {
  const db = createDb(c.env.DB)
  const folderIdRaw = c.req.query('folder_id')
  let folderId: number | null = null
  if (folderIdRaw !== undefined) {
    const parsed = Number(folderIdRaw)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return c.json(makeError('VALIDATION_ERROR', 'Ungültige Ordner-ID'), 400)
    }
    folderId = parsed
  }
  return c.json(await browseFolder(db, folderId))
})

app.post('/folders', requireAuth, async (c) => {
  const parsed = createFolderInputSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const session = c.get('session')
  const row = await createFolder(db, parsed.data, {
    id: session.userId,
    name: session.name,
  })
  return c.json(row, 201)
})

app.patch('/folders/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const parsed = updateFolderInputSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const session = c.get('session')
  const existing = await findFolderOrThrow(db, id)
  if (!canManageDocumentTarget(session, existing.created_by_user_id)) {
    return c.json(makeError('FORBIDDEN', 'Keine Berechtigung'), 403)
  }
  return c.json(await updateFolder(db, id, parsed.data))
})

// Deletes the folder and everything nested under it.
app.delete('/folders/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const session = c.get('session')
  const existing = await findFolderOrThrow(db, id)
  if (!canManageDocumentTarget(session, existing.created_by_user_id)) {
    return c.json(makeError('FORBIDDEN', 'Keine Berechtigung'), 403)
  }
  await deleteFolder(db, c.env.ATTACHMENTS, id)
  return c.json({ ok: true })
})

app.post('/documents', requireAuth, async (c) => {
  const db = createDb(c.env.DB)
  const body = await c.req.parseBody()
  const file = body.file
  if (!(file instanceof File)) {
    return c.json(
      makeError('VALIDATION_ERROR', 'Datei fehlt (Feld „file“).'),
      400,
    )
  }
  if (!isAllowedDocumentContentType(file.type)) {
    return c.json(
      makeError(
        'VALIDATION_ERROR',
        'Dateityp nicht erlaubt. Erlaubt: PDF, Bilder, Office- und Textdateien.',
      ),
      400,
    )
  }
  if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return c.json(
      makeError(
        'VALIDATION_ERROR',
        `Datei zu groß (max ${Math.round(MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024)} MB).`,
      ),
      400,
    )
  }
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description =
    typeof body.description === 'string' ? body.description.trim() : ''
  let folderId: number | null = null
  if (typeof body.folder_id === 'string' && body.folder_id.length > 0) {
    const parsed = Number(body.folder_id)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return c.json(makeError('VALIDATION_ERROR', 'Ungültige Ordner-ID'), 400)
    }
    folderId = parsed
  }
  const safeName = safeFilename(file.name)
  const key = `documents/${Date.now()}-${crypto.randomUUID()}-${safeName}`
  await c.env.ATTACHMENTS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  })
  const session = c.get('session')
  const row = await addDocument(db, {
    title: title.length > 0 ? title.slice(0, 200) : safeName,
    filename: safeName,
    content_type: file.type,
    size: file.size,
    r2_key: key,
    description: description.length > 0 ? description.slice(0, 2000) : null,
    folder_id: folderId,
    uploaded_by_user_id: session.userId,
    uploaded_by_name: session.name,
  })
  return c.json(row, 201)
})

app.get('/documents/:id/download', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const row = await findDocumentOrThrow(db, id)
  const object = await c.env.ATTACHMENTS.get(row.r2_key)
  if (!object) {
    return c.json(
      makeError('NOT_FOUND', 'Datei nicht im Speicher gefunden.'),
      404,
    )
  }
  return new Response(object.body, {
    headers: buildDownloadHeaders(row),
  })
})

app.patch('/documents/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const parsed = updateDocumentInputSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const session = c.get('session')
  const existing = await findDocumentOrThrow(db, id)
  if (!canManageDocumentTarget(session, existing.uploaded_by_user_id)) {
    return c.json(makeError('FORBIDDEN', 'Keine Berechtigung'), 403)
  }
  return c.json(await updateDocument(db, id, parsed.data))
})

// Members may remove their own uploads; admins may remove any.
app.delete('/documents/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const session = c.get('session')
  const row = await findDocumentOrThrow(db, id)
  if (!canManageDocumentTarget(session, row.uploaded_by_user_id)) {
    return c.json(makeError('FORBIDDEN', 'Keine Berechtigung'), 403)
  }
  await deleteDocument(db, c.env.ATTACHMENTS, id)
  return c.json({ ok: true })
})

// ── Document & folder share links ───────────────────────────────────────────

app.get('/documents/:id/share-tokens', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  await findDocumentOrThrow(db, id)
  const rows = await listDocumentShareTokens(db, id)
  return c.json(rows.map(shapeDocumentShareToken))
})

app.post('/documents/:id/share-tokens', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const parsed = createDocumentShareTokenInputSchema.safeParse(
    await c.req.json(),
  )
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const { row, plaintext } = await createDocumentShareToken(
    db,
    { document_id: id, folder_id: null },
    parsed.data,
  )
  return c.json({ token: shapeDocumentShareToken(row), plaintext }, 201)
})

app.post(
  '/documents/:id/share-tokens/:tokenId/revoke',
  requireAuth,
  async (c) => {
    const id = Number(c.req.param('id'))
    const tokenId = Number(c.req.param('tokenId'))
    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      !Number.isInteger(tokenId) ||
      tokenId <= 0
    ) {
      return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
    }
    const db = createDb(c.env.DB)
    const row = await revokeDocumentShareToken(
      db,
      { document_id: id, folder_id: null },
      tokenId,
    )
    return c.json(shapeDocumentShareToken(row))
  },
)

app.get('/folders/:id/share-tokens', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  await findFolderOrThrow(db, id)
  const rows = await listFolderShareTokens(db, id)
  return c.json(rows.map(shapeDocumentShareToken))
})

app.post('/folders/:id/share-tokens', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const parsed = createDocumentShareTokenInputSchema.safeParse(
    await c.req.json(),
  )
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const { row, plaintext } = await createDocumentShareToken(
    db,
    { document_id: null, folder_id: id },
    parsed.data,
  )
  return c.json({ token: shapeDocumentShareToken(row), plaintext }, 201)
})

app.post(
  '/folders/:id/share-tokens/:tokenId/revoke',
  requireAuth,
  async (c) => {
    const id = Number(c.req.param('id'))
    const tokenId = Number(c.req.param('tokenId'))
    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      !Number.isInteger(tokenId) ||
      tokenId <= 0
    ) {
      return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
    }
    const db = createDb(c.env.DB)
    const row = await revokeDocumentShareToken(
      db,
      { document_id: null, folder_id: id },
      tokenId,
    )
    return c.json(shapeDocumentShareToken(row))
  },
)

// ── Public document/folder share endpoint (no auth) ─────────────────────────

app.get('/share/documents/:token', async (c) => {
  const token = c.req.param('token')
  if (!isValidTokenShape(token)) {
    return c.json(makeError('NOT_FOUND', 'Share-Link nicht gefunden.'), 404)
  }
  const db = createDb(c.env.DB)
  const resolved = await resolveDocumentShareToken(db, token)
  if (resolved.type === 'document') {
    return c.json({ type: 'document', document: resolved.document })
  }
  return c.json({
    type: 'folder',
    folder_name: resolved.folder_name,
    documents: resolved.documents,
  })
})

app.get('/share/documents/:token/download/:documentId', async (c) => {
  const token = c.req.param('token')
  const documentId = Number(c.req.param('documentId'))
  if (!isValidTokenShape(token) || !Number.isInteger(documentId)) {
    return c.json(makeError('NOT_FOUND', 'Datei nicht gefunden.'), 404)
  }
  const db = createDb(c.env.DB)
  const resolved = await resolveDocumentShareToken(db, token)
  const isAllowed =
    resolved.type === 'document'
      ? resolved.document.id === documentId
      : resolved.documents.some((d) => d.id === documentId)
  if (!isAllowed) {
    return c.json(makeError('NOT_FOUND', 'Datei nicht gefunden.'), 404)
  }
  const row = await findDocumentOrThrow(db, documentId)
  const object = await c.env.ATTACHMENTS.get(row.r2_key)
  if (!object) {
    return c.json(
      makeError('NOT_FOUND', 'Datei nicht im Speicher gefunden.'),
      404,
    )
  }
  return new Response(object.body, { headers: buildDownloadHeaders(row) })
})

// ── Events (all signed-in members — read-only) ─────────────────────────────

app.get('/events', requireAuth, async (c) => {
  const db = createDb(c.env.DB)
  return c.json(await listAllEvents(db))
})

app.get('/events/:slug', requireAuth, async (c) => {
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, c.req.param('slug'))
  return c.json(await findEventWithDetails(db, event.id))
})

// ── Calendar (all signed-in members) ────────────────────────────────────────

const ISO_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/

function requestOrigin(c: Context<AppEnv>): string {
  return new URL(c.req.url).origin
}

function shapeTerminEntry(termin: {
  id: number
  slug: string
  title: string
  scheduled_date: string
  scheduled_time: string | null
  location: string | null
}): CalendarTerminEntry {
  return {
    kind: 'termin',
    id: termin.id,
    slug: termin.slug,
    title: termin.title,
    date: termin.scheduled_date,
    time: termin.scheduled_time,
    location: termin.location,
  }
}

function shapeCalendarEventEntry(row: CalendarEventRow): CalendarEventEntry {
  return {
    kind: 'event',
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    start_date: row.start_date,
    end_date: row.end_date,
    start_time: row.start_time,
    end_time: row.end_time,
    created_by_user_id: row.created_by_user_id,
    created_by_name: row.created_by_name,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function shapeBookingEntry(row: BookingRow): CalendarBookingEntry {
  const period = utcToBookingPeriod(row.start_at, row.end_at)
  return {
    kind: 'booking',
    id: row.id,
    user_id: row.user_id,
    user_name: row.user_name,
    start_at: row.start_at,
    end_at: row.end_at,
    start_date: period.start_date,
    start_time: period.start_time,
    end_date: period.end_date,
    end_time: period.end_time,
    billed_days: row.billed_days,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function calendarEntrySortKey(entry: CalendarEntry): string {
  switch (entry.kind) {
    case 'termin':
      return `${entry.date}T${entry.time ?? '00:00'}`
    case 'event':
      return `${entry.start_date}T${entry.start_time ?? '00:00'}`
    case 'booking':
      return `${entry.start_date}T${entry.start_time}`
  }
}

app.get('/calendar', requireAuth, async (c) => {
  const from = c.req.query('from')
  const to = c.req.query('to')
  if (
    !from ||
    !to ||
    !ISO_DATE_SHAPE.test(from) ||
    !ISO_DATE_SHAPE.test(to) ||
    from > to
  ) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültiger Zeitraum'), 400)
  }
  if (dayjs.utc(to).diff(dayjs.utc(from), 'day') > 400) {
    return c.json(makeError('VALIDATION_ERROR', 'Zeitraum zu groß'), 400)
  }
  const db = createDb(c.env.DB)
  const merged = await getMergedCalendar(db, { from, to })
  const entries: CalendarEntry[] = [
    ...merged.termine.map(shapeTerminEntry),
    ...merged.events.map(shapeCalendarEventEntry),
    ...merged.bookings.map(shapeBookingEntry),
  ]
  entries.sort((a, b) =>
    calendarEntrySortKey(a).localeCompare(calendarEntrySortKey(b)),
  )
  return c.json({ from, to, entries })
})

app.post('/calendar/events', requireAuth, async (c) => {
  const session = c.get('session')
  const body = await c.req.json()
  const parsed = createCalendarEventInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const row = await createCalendarEvent(db, parsed.data, {
    id: session.userId,
    name: session.name,
  })
  c.executionCtx.waitUntil(
    notifyCalendarChange(
      db,
      c.env,
      {
        change: 'created',
        kind: 'event',
        title: row.title,
        whenText: formatEventWhen(row),
        actorName: session.name,
      },
      { actorUserId: session.userId, origin: requestOrigin(c) },
    ),
  )
  return c.json(shapeCalendarEventEntry(row), 201)
})

app.patch('/calendar/events/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const session = c.get('session')
  const body = await c.req.json()
  const parsed = updateCalendarEventInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const before = await findCalendarEventOrThrow(db, id)
  if (!canManageDocumentTarget(session, before.created_by_user_id)) {
    return c.json(makeError('FORBIDDEN', 'Keine Berechtigung'), 403)
  }
  const row = await updateCalendarEvent(db, id, parsed.data)
  const periodChanged =
    row.start_date !== before.start_date ||
    row.end_date !== before.end_date ||
    row.start_time !== before.start_time ||
    row.end_time !== before.end_time
  if (periodChanged) {
    c.executionCtx.waitUntil(
      notifyCalendarChange(
        db,
        c.env,
        {
          change: 'rescheduled',
          kind: 'event',
          title: row.title,
          whenText: formatEventWhen(row),
          actorName: session.name,
        },
        { actorUserId: session.userId, origin: requestOrigin(c) },
      ),
    )
  }
  return c.json(shapeCalendarEventEntry(row))
})

app.delete('/calendar/events/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const session = c.get('session')
  const db = createDb(c.env.DB)
  const before = await findCalendarEventOrThrow(db, id)
  if (!canManageDocumentTarget(session, before.created_by_user_id)) {
    return c.json(makeError('FORBIDDEN', 'Keine Berechtigung'), 403)
  }
  await deleteCalendarEvent(db, id)
  c.executionCtx.waitUntil(
    notifyCalendarChange(
      db,
      c.env,
      {
        change: 'cancelled',
        kind: 'event',
        title: before.title,
        whenText: formatEventWhen(before),
        actorName: session.name,
      },
      { actorUserId: session.userId, origin: requestOrigin(c) },
    ),
  )
  return c.json({ ok: true })
})

app.post('/calendar/bookings', requireAuth, async (c) => {
  const session = c.get('session')
  const body = await c.req.json()
  const parsed = createBookingInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const { note, ...period } = parsed.data
  const row = await createBooking(
    db,
    period,
    note,
    { id: session.userId, name: session.name },
    nowUtc(),
  )
  c.executionCtx.waitUntil(
    notifyCalendarChange(
      db,
      c.env,
      {
        change: 'created',
        kind: 'booking',
        title: row.user_name,
        whenText: formatBookingWhen(row.start_at, row.end_at),
        actorName: session.name,
      },
      { actorUserId: session.userId, origin: requestOrigin(c) },
    ),
  )
  return c.json(shapeBookingEntry(row), 201)
})

app.patch('/calendar/bookings/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const session = c.get('session')
  const body = await c.req.json()
  const parsed = updateBookingInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const before = await findBookingOrThrow(db, id)
  if (!canManageDocumentTarget(session, before.user_id)) {
    return c.json(makeError('FORBIDDEN', 'Keine Berechtigung'), 403)
  }
  if (session.role !== 'admin' && before.start_at <= nowUtc()) {
    return c.json(
      makeError(
        'VALIDATION_ERROR',
        'Vergangene oder laufende Reservierungen können nicht geändert werden.',
      ),
      400,
    )
  }
  const row = await updateBooking(db, id, parsed.data, nowUtc())
  const periodChanged =
    row.start_at !== before.start_at || row.end_at !== before.end_at
  if (periodChanged) {
    c.executionCtx.waitUntil(
      notifyCalendarChange(
        db,
        c.env,
        {
          change: 'rescheduled',
          kind: 'booking',
          title: row.user_name,
          whenText: formatBookingWhen(row.start_at, row.end_at),
          actorName: session.name,
        },
        { actorUserId: session.userId, origin: requestOrigin(c) },
      ),
    )
  }
  return c.json(shapeBookingEntry(row))
})

app.post('/calendar/bookings/:id/cancel', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const session = c.get('session')
  const db = createDb(c.env.DB)
  const before = await findBookingOrThrow(db, id)
  if (!canManageDocumentTarget(session, before.user_id)) {
    return c.json(makeError('FORBIDDEN', 'Keine Berechtigung'), 403)
  }
  if (session.role !== 'admin' && before.start_at <= nowUtc()) {
    return c.json(
      makeError(
        'VALIDATION_ERROR',
        'Vergangene oder laufende Reservierungen können nicht storniert werden.',
      ),
      400,
    )
  }
  const row = await cancelBooking(db, id)
  c.executionCtx.waitUntil(
    notifyCalendarChange(
      db,
      c.env,
      {
        change: 'cancelled',
        kind: 'booking',
        title: row.user_name,
        whenText: formatBookingWhen(row.start_at, row.end_at),
        actorName: session.name,
      },
      { actorUserId: session.userId, origin: requestOrigin(c) },
    ),
  )
  return c.json(shapeBookingEntry(row))
})

// ── Profile self-service & personal iCal feed token (`/me/*`) ──────────────

/** `/me/*` routes act on a users row; the bootstrap root admin has none. */
function requireMemberUserId(session: Session): number {
  if (session.userId === null) {
    throw new AppError(
      'FORBIDDEN',
      'Mit dem Root-Admin-Konto nicht möglich. Bitte mit einem persönlichen Konto anmelden.',
      403,
    )
  }
  return session.userId
}

app.get('/me/profile', requireAuth, async (c) => {
  const userId = requireMemberUserId(c.get('session'))
  const db = createDb(c.env.DB)
  return c.json(await getProfileOrThrow(db, userId))
})

app.patch('/me/profile', requireAuth, async (c) => {
  const session = c.get('session')
  const userId = requireMemberUserId(session)
  const body = await c.req.json()
  const parsed = updateMyProfileInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const profile = await updateProfile(db, userId, parsed.data)
  // Keep the JWT `name` claim fresh so the shell header doesn't show
  // the old name until the cookie expires.
  const name = `${profile.first_name} ${profile.last_name}`
  if (name !== session.name) {
    setSessionCookie(
      c,
      await signSessionToken(c.env.JWT_SECRET, {
        userId: session.userId,
        role: session.role,
        name,
      }),
    )
  }
  return c.json(profile)
})

app.post('/me/password', requireAuth, async (c) => {
  const userId = requireMemberUserId(c.get('session'))
  const body = await c.req.json()
  const parsed = changePasswordInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const credentials = await findUserCredentials(db, userId)
  if (!credentials?.password_hash) {
    return c.json(
      makeError(
        'VALIDATION_ERROR',
        'Für dieses Konto ist kein Passwort gesetzt.',
      ),
      400,
    )
  }
  const valid = await verifyPassword(
    parsed.data.current_password,
    credentials.password_hash,
  )
  if (!valid) {
    // 400, not 401 — the client treats 401 as a lost session.
    return c.json(
      makeError('VALIDATION_ERROR', 'Das aktuelle Passwort ist falsch.'),
      400,
    )
  }
  await updatePassword(db, userId, await hashPassword(parsed.data.new_password))
  return c.json({ ok: true })
})

app.get('/me/calendar-token', requireAuth, async (c) => {
  const userId = requireMemberUserId(c.get('session'))
  const db = createDb(c.env.DB)
  const row = await getFeedToken(db, userId)
  const status: CalendarFeedTokenStatus = {
    exists: row !== undefined,
    token_fingerprint: row ? row.token_hash.slice(0, 8) : null,
    created_at: row?.created_at ?? null,
    last_used_at: row?.last_used_at ?? null,
  }
  return c.json(status)
})

app.post('/me/calendar-token', requireAuth, async (c) => {
  const userId = requireMemberUserId(c.get('session'))
  const db = createDb(c.env.DB)
  const { row, plaintext } = await rotateFeedToken(db, userId)
  const response: CreateCalendarFeedTokenResponse = {
    // The plaintext token exists only inside this URL — it is shown
    // exactly once and never recoverable from the server.
    url: `${requestOrigin(c)}/api/ics/${plaintext}.ics`,
    token_fingerprint: row.token_hash.slice(0, 8),
  }
  return c.json(response, 201)
})

app.delete('/me/calendar-token', requireAuth, async (c) => {
  const userId = requireMemberUserId(c.get('session'))
  const db = createDb(c.env.DB)
  await revokeFeedToken(db, userId)
  return c.json({ ok: true })
})

// ── Public iCal feed (token-authenticated) ─────────────────────────────────

app.get('/ics/:token', async (c) => {
  const raw = c.req.param('token')
  const token = raw.endsWith('.ics') ? raw.slice(0, -'.ics'.length) : raw
  if (!isValidTokenShape(token)) {
    return c.json(makeError('NOT_FOUND', 'Kalender-Feed nicht gefunden.'), 404)
  }
  const db = createDb(c.env.DB)
  await resolveFeedToken(db, token)
  // Bounded window so the feed payload stays small: 3 months back,
  // 12 months ahead (Vienna calendar dates).
  const nowVienna = toVienna(nowUtc())
  const merged = await getMergedCalendar(db, {
    from: nowVienna.subtract(3, 'month').format('YYYY-MM-DD'),
    to: nowVienna.add(12, 'month').format('YYYY-MM-DD'),
  })
  const ical = buildCalendarFeed(
    feedEntriesFromCalendar(merged, requestOrigin(c)),
  )
  return new Response(ical, {
    headers: {
      'Content-Type': ICAL_CONTENT_TYPE,
      // Clients poll subscriptions on their own schedule; the
      // max-age just keeps rapid refreshes off the worker.
      'Cache-Control': 'private, max-age=900',
      'Content-Disposition': 'inline; filename="garten-kalender.ics"',
    },
  })
})

// ── Bookkeeping / Kassa ─────────────────────────────────────────────────────

/** Throws 403 unless the session may accept bills (Kassier or admin). */
async function assertCanApprove(
  c: Context<AppEnv>,
  db: ReturnType<typeof createDb>,
): Promise<void> {
  if (!(await canApproveExpenses(db, c.get('session')))) {
    throw new AppError(
      'FORBIDDEN',
      'Nur Kassier:innen dürfen Rechnungen freigeben.',
      403,
    )
  }
}

/** A member may manage their own bill while it is pending; Kassiere any. */
async function canManageExpense(
  db: ReturnType<typeof createDb>,
  session: Session,
  expense: ExpenseRow,
): Promise<boolean> {
  if (await canApproveExpenses(db, session)) return true
  return (
    expense.status === 'pending' &&
    expense.submitted_by_user_id !== null &&
    expense.submitted_by_user_id === session.userId
  )
}

app.get('/kassa/overview', requireAuth, async (c) => {
  const db = createDb(c.env.DB)
  return c.json(await getKassaOverview(db))
})

app.get('/kassa/members', requireAuth, async (c) => {
  const db = createDb(c.env.DB)
  return c.json(await listMembers(db))
})

app.get('/kassa/expenses', requireAuth, async (c) => {
  const db = createDb(c.env.DB)
  return c.json(await listExpenses(db))
})

app.post('/kassa/expenses', requireAuth, async (c) => {
  const parsed = createExpenseInputSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const session = c.get('session')
  const row = await createExpense(db, parsed.data, {
    id: session.userId,
    name: session.name,
  })
  return c.json(row, 201)
})

app.patch('/kassa/expenses/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const parsed = updateExpenseInputSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const session = c.get('session')
  const existing = await findExpenseOrThrow(db, id)
  if (!(await canManageExpense(db, session, existing))) {
    return c.json(makeError('FORBIDDEN', 'Keine Berechtigung'), 403)
  }
  return c.json(await updateExpense(db, id, parsed.data))
})

app.delete('/kassa/expenses/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const session = c.get('session')
  const existing = await findExpenseOrThrow(db, id)
  if (!(await canManageExpense(db, session, existing))) {
    return c.json(makeError('FORBIDDEN', 'Keine Berechtigung'), 403)
  }
  await deleteExpense(db, c.env.ATTACHMENTS, id)
  return c.json({ ok: true })
})

app.post('/kassa/expenses/:id/receipt', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const session = c.get('session')
  const existing = await findExpenseOrThrow(db, id)
  if (!(await canManageExpense(db, session, existing))) {
    return c.json(makeError('FORBIDDEN', 'Keine Berechtigung'), 403)
  }
  const body = await c.req.parseBody()
  const file = body.file
  if (!(file instanceof File)) {
    return c.json(
      makeError('VALIDATION_ERROR', 'Datei fehlt (Feld „file“).'),
      400,
    )
  }
  if (!isAllowedDocumentContentType(file.type)) {
    return c.json(
      makeError(
        'VALIDATION_ERROR',
        'Dateityp nicht erlaubt. Erlaubt: PDF, Bilder, Office- und Textdateien.',
      ),
      400,
    )
  }
  if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return c.json(
      makeError(
        'VALIDATION_ERROR',
        `Datei zu groß (max ${Math.round(MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024)} MB).`,
      ),
      400,
    )
  }
  const safeName = safeFilename(file.name)
  const key = `expenses/${id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`
  await c.env.ATTACHMENTS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  })
  const row = await setExpenseReceipt(db, c.env.ATTACHMENTS, id, {
    r2_key: key,
    filename: safeName,
    content_type: file.type,
    size: file.size,
  })
  return c.json(row)
})

app.get('/kassa/expenses/:id/receipt', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const row = await findExpenseOrThrow(db, id)
  if (
    !row.receipt_r2_key ||
    !row.receipt_filename ||
    !row.receipt_content_type ||
    row.receipt_size === null
  ) {
    return c.json(makeError('NOT_FOUND', 'Kein Beleg hinterlegt.'), 404)
  }
  const object = await c.env.ATTACHMENTS.get(row.receipt_r2_key)
  if (!object) {
    return c.json(
      makeError('NOT_FOUND', 'Datei nicht im Speicher gefunden.'),
      404,
    )
  }
  return new Response(object.body, {
    headers: buildDownloadHeaders({
      filename: row.receipt_filename,
      content_type: row.receipt_content_type,
      size: row.receipt_size,
    }),
  })
})

app.post('/kassa/expenses/:id/approve', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  await assertCanApprove(c, db)
  const session = c.get('session')
  return c.json(
    await approveExpense(db, id, { id: session.userId, name: session.name }),
  )
})

app.post('/kassa/expenses/:id/reject', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const parsed = rejectExpenseInputSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  await assertCanApprove(c, db)
  const session = c.get('session')
  return c.json(
    await rejectExpense(
      db,
      id,
      { id: session.userId, name: session.name },
      parsed.data.note ?? null,
    ),
  )
})

app.get('/kassa/bank-entries', requireAuth, async (c) => {
  const db = createDb(c.env.DB)
  await assertCanApprove(c, db)
  return c.json(await listBankEntries(db))
})

app.post('/kassa/bank-entries', requireAuth, async (c) => {
  const parsed = createBankEntryInputSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  await assertCanApprove(c, db)
  const session = c.get('session')
  const row = await createBankEntry(db, parsed.data, {
    id: session.userId,
    name: session.name,
  })
  return c.json(row, 201)
})

app.patch('/kassa/bank-entries/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const parsed = updateBankEntryInputSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  await assertCanApprove(c, db)
  return c.json(await updateBankEntry(db, id, parsed.data))
})

app.delete('/kassa/bank-entries/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  await assertCanApprove(c, db)
  await deleteBankEntry(db, id)
  return c.json({ ok: true })
})

// ── Tasks / Aufgaben (all signed-in members) ─────────────────────────────────
//
// A shared member to-do board. Every signed-in member may create tasks and
// edit / complete them and their checklists (collaborative). Only the creator
// or an admin may delete a task or stop a recurring series. Recurring tasks
// are modelled as a `task_series` whose occurrences are materialized lazily on
// `GET /tasks` — there is no cron trigger.

app.get('/tasks/members', requireAuth, async (c) => {
  const db = createDb(c.env.DB)
  return c.json(await listAssignableMembers(db))
})

app.get('/tasks', requireAuth, async (c) => {
  const db = createDb(c.env.DB)
  return c.json(await listTasks(db))
})

app.post('/tasks', requireAuth, async (c) => {
  const parsed = createTaskInputSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const session = c.get('session')
  const result = await createTask(db, parsed.data, {
    id: session.userId,
    name: session.name,
  })
  return c.json(result, 201)
})

app.patch('/tasks/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const parsed = updateTaskInputSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  await findTaskOrThrow(db, id)
  return c.json(await updateTaskItem(db, id, parsed.data))
})

app.delete('/tasks/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const existing = await findTaskOrThrow(db, id)
  if (!canManageDocumentTarget(c.get('session'), existing.created_by_user_id)) {
    return c.json(makeError('FORBIDDEN', 'Keine Berechtigung'), 403)
  }
  await deleteTaskItem(db, id)
  return c.json({ ok: true })
})

app.post('/tasks/:id/subtasks', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const parsed = subtaskInputSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  return c.json(await addSubtask(db, id, parsed.data), 201)
})

app.patch('/tasks/:id/subtasks/:subId', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  const subId = Number(c.req.param('subId'))
  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    !Number.isInteger(subId) ||
    subId <= 0
  ) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const parsed = updateSubtaskInputSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  return c.json(await updateSubtask(db, id, subId, parsed.data))
})

app.delete('/tasks/:id/subtasks/:subId', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  const subId = Number(c.req.param('subId'))
  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    !Number.isInteger(subId) ||
    subId <= 0
  ) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  return c.json(await deleteSubtask(db, id, subId))
})

app.patch('/task-series/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const parsed = updateTaskSeriesInputSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  await findSeriesOrThrow(db, id)
  return c.json(await updateSeries(db, id, parsed.data))
})

app.delete('/task-series/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const existing = await findSeriesOrThrow(db, id)
  if (!canManageDocumentTarget(c.get('session'), existing.created_by_user_id)) {
    return c.json(makeError('FORBIDDEN', 'Keine Berechtigung'), 403)
  }
  await deleteSeries(db, id)
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
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
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
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
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
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
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

// ── Share links (admin) ─────────────────────────────────────────────────────

/**
 * Lists share tokens for a poll. The plaintext is never returned —
 * we expose a short fingerprint (first 8 chars) plus the status so
 * the admin can distinguish tokens that share the same label.
 */
app.get('/admin/polls/:id/share-tokens', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const rows = await listPollShareTokens(db, id)
  return c.json(
    rows.map((row) => ({
      id: row.id,
      poll_id: row.poll_id,
      token_fingerprint: row.token_hash.slice(0, 8),
      label: row.label,
      created_at: row.created_at,
      expires_at: row.expires_at,
      revoked_at: row.revoked_at,
      last_hit_at: row.last_hit_at,
      is_active: isPollShareTokenActive(row),
    })),
  )
})

/**
 * Creates a new share token. The plaintext is returned exactly
 * once; only its SHA-256 hash is persisted.
 */
app.post('/admin/polls/:id/share-tokens', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const body = await c.req.json()
  const parsed = createPollShareTokenInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const { row, plaintext } = await createPollShareToken(db, id, {
    label: parsed.data.label ?? null,
    expires_at: parsed.data.expires_at ?? null,
  })
  return c.json(
    {
      token: {
        id: row.id,
        poll_id: row.poll_id,
        token_fingerprint: row.token_hash.slice(0, 8),
        label: row.label,
        created_at: row.created_at,
        expires_at: row.expires_at,
        revoked_at: row.revoked_at,
        last_hit_at: row.last_hit_at,
        is_active: true,
      },
      plaintext,
    },
    201,
  )
})

/**
 * Revoke a share token. The row is kept so the admin list still
 * shows it; the public endpoint answers 401 from then on.
 */
app.post('/admin/polls/:id/share-tokens/:tokenId/revoke', async (c) => {
  const id = Number(c.req.param('id'))
  const tokenId = Number(c.req.param('tokenId'))
  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    !Number.isInteger(tokenId) ||
    tokenId <= 0
  ) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const row = await revokePollShareToken(db, id, tokenId)
  return c.json({
    id: row.id,
    poll_id: row.poll_id,
    label: row.label,
    created_at: row.created_at,
    expires_at: row.expires_at,
    revoked_at: row.revoked_at,
    last_hit_at: row.last_hit_at,
    is_active: false,
  })
})

app.get('/admin/users', async (c) => {
  const db = createDb(c.env.DB)
  return c.json(await listAllUsers(db))
})

app.post('/admin/users', async (c) => {
  const body = await c.req.json()
  const parsed = createUserInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
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
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
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
  if (existing.id === c.get('session').userId) {
    return c.json(
      makeError('CONFLICT', 'Du kannst dich nicht selbst löschen.'),
      409,
    )
  }
  await deleteUser(db, existing.id)
  return c.json({ ok: true })
})

/**
 * Creates a fresh invite link for the user and returns it exactly
 * once — the admin passes it on via whatever channel works
 * (WhatsApp, e-mail, paper). Re-inviting replaces any pending link
 * and doubles as the password-reset flow.
 */
app.post('/admin/users/:slug/invite', async (c) => {
  const slug = c.req.param('slug')
  const db = createDb(c.env.DB)
  const user = await findUserBySlugOrThrow(db, slug)
  const { plaintext, expires_at } = await createAuthToken(db, user.id, 'invite')
  return c.json(
    {
      url: `${new URL(c.req.url).origin}/einladung/${plaintext}`,
      expires_at,
    },
    201,
  )
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
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const event = await createEvent(db, parsed.data)
  const session = c.get('session')
  c.executionCtx.waitUntil(
    notifyCalendarChange(
      db,
      c.env,
      {
        change: 'created',
        kind: 'termin',
        title: event.title,
        whenText: formatTerminWhen(event.scheduled_date, event.scheduled_time),
        actorName: session.name,
      },
      { actorUserId: session.userId, origin: requestOrigin(c) },
    ),
  )
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
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  await updateEvent(db, event.id, parsed.data)
  const updated = await findEventWithDetails(db, event.id)
  // Members are only notified when the schedule moved — agenda or
  // protocol edits stay quiet.
  if (
    updated.scheduled_date !== event.scheduled_date ||
    updated.scheduled_time !== event.scheduled_time
  ) {
    const session = c.get('session')
    c.executionCtx.waitUntil(
      notifyCalendarChange(
        db,
        c.env,
        {
          change: 'rescheduled',
          kind: 'termin',
          title: updated.title,
          whenText: formatTerminWhen(
            updated.scheduled_date,
            updated.scheduled_time,
          ),
          actorName: session.name,
        },
        { actorUserId: session.userId, origin: requestOrigin(c) },
      ),
    )
  }
  return c.json(updated)
})

app.delete('/admin/events/:slug', async (c) => {
  const slug = c.req.param('slug')
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  await deleteEvent(db, event.id)
  const session = c.get('session')
  c.executionCtx.waitUntil(
    notifyCalendarChange(
      db,
      c.env,
      {
        change: 'cancelled',
        kind: 'termin',
        title: event.title,
        whenText: formatTerminWhen(event.scheduled_date, event.scheduled_time),
        actorName: session.name,
      },
      { actorUserId: session.userId, origin: requestOrigin(c) },
    ),
  )
  return c.json({ ok: true })
})

app.put('/admin/events/:slug/planned-attendees', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()
  const parsed = updateEventAttendeesInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  return c.json(await replacePlannedAttendees(db, event.id, parsed.data))
})

app.post('/admin/events/:slug/planned-attendees/single', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()
  const parsed = createEventAttendeeInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
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
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
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
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
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
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
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
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
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
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
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
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  return c.json(await updateAgendaVote(db, event.id, voteId, parsed.data))
})

app.delete('/admin/events/:slug/agenda-votes/:voteId', async (c) => {
  const slug = c.req.param('slug')
  const voteId = Number(c.req.param('voteId'))
  if (!Number.isInteger(voteId) || voteId <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  await deleteAgendaVote(db, event.id, voteId)
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
      return c.json(
        makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
        400,
      )
    }
    const db = createDb(c.env.DB)
    const event = await findEventBySlugOrThrow(db, slug)
    return c.json(
      await setAttendeeVote(db, event.id, voteId, attendeeId, parsed.data),
    )
  },
)

// ── Attachments ───────────────────────────────────────────────────────────

/**
 * Sanitises a user-supplied filename for the `Content-Disposition`
 * header: anything outside [a-zA-Z0-9._-] becomes `_`.
 */
function safeFilename(input: string): string {
  const cleaned = input
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 200)
  return cleaned.length > 0 ? cleaned : 'anhang'
}

/**
 * Download headers for R2-backed files. Only raster images render
 * inline — SVG (scriptable) and everything else force a download,
 * and `nosniff` keeps browsers from second-guessing the type.
 */
function buildDownloadHeaders(row: {
  filename: string
  content_type: string
  size: number
}): Headers {
  const isInline =
    row.content_type.startsWith('image/') &&
    row.content_type !== 'image/svg+xml'
  const headers = new Headers()
  headers.set('Content-Type', row.content_type)
  headers.set('Content-Length', String(row.size))
  headers.set(
    'Content-Disposition',
    `${isInline ? 'inline' : 'attachment'}; filename="${safeFilename(row.filename)}"`,
  )
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Cache-Control', 'private, max-age=300')
  return headers
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
  const event = await findEventBySlugOrThrow(db, c.req.param('slug'))
  const row = await findAttachmentOrThrow(db, event.id, id)
  const object = await c.env.ATTACHMENTS.get(row.r2_key)
  if (!object) {
    return c.json(
      makeError('NOT_FOUND', 'Datei nicht im Speicher gefunden.'),
      404,
    )
  }
  return new Response(object.body, { headers: buildDownloadHeaders(row) })
})

app.patch('/admin/events/:slug/attachments/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const body = await c.req.json()
  const parsed = updateEventAttachmentInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, c.req.param('slug'))
  const row = await updateAttachment(db, event.id, id, parsed.data)
  return c.json(row)
})

app.delete('/admin/events/:slug/attachments/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, c.req.param('slug'))
  await deleteAttachment(db, c.env.ATTACHMENTS, event.id, id)
  return c.json({ ok: true })
})

// ── Decisions / Beschlüsse ───────────────────────────────────────────────

app.post('/admin/events/:slug/decisions', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()
  const parsed = createEventDecisionInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  const decision = await addDecision(db, event.id, parsed.data)
  return c.json(decision, 201)
})

app.patch('/admin/events/:slug/decisions/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const body = await c.req.json()
  const parsed = updateEventDecisionInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  const decision = await updateDecision(db, event.id, id, parsed.data)
  return c.json(decision)
})

app.delete('/admin/events/:slug/decisions/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  await deleteDecision(db, event.id, id)
  return c.json({ ok: true })
})

// ── iCal export ────────────────────────────────────────────────────────────

/**
 * Streams an iCalendar (RFC 5545) document for the event. The
 * content type is `text/calendar; charset=utf-8` so the browser
 * triggers a download with the right extension. The file is
 * attachment-disposition so the calendar app can import it
 * directly without navigating to a viewer.
 */
app.get('/admin/events/:slug/ical', async (c) => {
  const slug = c.req.param('slug')
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  // We need the full event (with attendees, agenda items, etc.)
  // because the iCal description embeds the agenda excerpt. The
  // detail loader is cheap — single event + a handful of joins.
  const eventWithDetails = await findEventWithDetails(db, event.id)
  const ical = buildEventIcal(eventWithDetails)
  const filename = `${safeFilename(eventWithDetails.title)}.ics`
  return new Response(ical, {
    headers: {
      'Content-Type': ICAL_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
})

// ── Tasks / Aufgaben ────────────────────────────────────────────────────────

/**
 * Returns the open tasks from the most recent prior event that the
 * admin can carry over into this one. Read-only — the actual carry
 * is a separate POST.
 */
app.get('/admin/events/:slug/tasks/carry-over-candidates', async (c) => {
  const slug = c.req.param('slug')
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  const candidates = await findOpenTasksForCarryOver(db, event.id)
  return c.json(candidates)
})

app.post('/admin/events/:slug/tasks', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()
  const parsed = createEventTaskInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  const task = await addTask(db, event.id, parsed.data)
  return c.json(task, 201)
})

app.patch('/admin/events/:slug/tasks/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const body = await c.req.json()
  const parsed = updateEventTaskInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  const task = await updateTask(db, event.id, id, parsed.data)
  return c.json(task)
})

app.delete('/admin/events/:slug/tasks/:id', async (c) => {
  const slug = c.req.param('slug')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  await deleteTask(db, event.id, id)
  return c.json({ ok: true })
})

/**
 * Carries over an open task from a previous event into this one.
 * The source task stays in its original event; a new task is created
 * here with `carried_from_event_id` / `carried_from_task_id` set.
 */
app.post('/admin/events/:slug/tasks/carry-over', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()
  const parsed = carryOverTaskInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  const task = await carryOverTask(db, event.id, parsed.data)
  return c.json(task, 201)
})

// ── Share links (admin) ────────────────────────────────────────────────────

/**
 * Lists share tokens for an event. The plaintext is never returned
 * — we expose a short fingerprint (first 8 chars) plus the
 * status so the admin can distinguish tokens that share the same
 * label.
 */
app.get('/admin/events/:slug/share-tokens', async (c) => {
  const slug = c.req.param('slug')
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  const rows = await listShareTokens(db, event.id)
  return c.json(
    rows.map((row) => ({
      id: row.id,
      event_id: row.event_id,
      token_fingerprint: row.token_hash.slice(0, 8),
      label: row.label,
      created_at: row.created_at,
      expires_at: row.expires_at,
      revoked_at: row.revoked_at,
      last_hit_at: row.last_hit_at,
      is_active: isShareTokenActive(row),
    })),
  )
})

/**
 * Creates a new share token. The plaintext is returned exactly
 * once; only its SHA-256 hash is persisted.
 */
app.post('/admin/events/:slug/share-tokens', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()
  const parsed = createEventShareTokenInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      makeError('VALIDATION_ERROR', zodErrorMessage(parsed.error)),
      400,
    )
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, slug)
  const { row, plaintext } = await createShareToken(db, event.id, {
    label: parsed.data.label ?? null,
    expires_at: parsed.data.expires_at ?? null,
  })
  return c.json(
    {
      token: {
        id: row.id,
        event_id: row.event_id,
        token_fingerprint: row.token_hash.slice(0, 8),
        label: row.label,
        created_at: row.created_at,
        expires_at: row.expires_at,
        revoked_at: row.revoked_at,
        last_hit_at: row.last_hit_at,
        is_active: true,
      },
      plaintext,
    },
    201,
  )
})

/**
 * Revoke a share token. The row is kept so the admin list still
 * shows it; the public endpoint answers 410 Gone from then on.
 */
app.post('/admin/events/:slug/share-tokens/:id/revoke', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(makeError('VALIDATION_ERROR', 'Ungültige ID'), 400)
  }
  const db = createDb(c.env.DB)
  const event = await findEventBySlugOrThrow(db, c.req.param('slug'))
  const row = await revokeShareToken(db, event.id, id)
  return c.json({
    id: row.id,
    event_id: row.event_id,
    label: row.label,
    created_at: row.created_at,
    expires_at: row.expires_at,
    revoked_at: row.revoked_at,
    last_hit_at: row.last_hit_at,
    is_active: false,
  })
})

export default app
