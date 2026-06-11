import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { nowUtc, toVienna } from '../../_lib/dayjs'
import type { Database } from '../../_lib/db'
import { AppError } from '../../_lib/errors'
import { generateSlug } from '../../_lib/slug'
import {
  type CreateEventAgendaItemInput,
  type CreateEventAgendaVoteInput,
  type CreateEventAttendeeInput,
  type CreateEventDecisionInput,
  type CreateEventInput,
  type EventAttachment,
  type EventDecision,
  type EventWithDetails,
  isAllowedAttachmentContentType,
  MAX_ATTACHMENT_SIZE_BYTES,
  nextResolutionNumberForYear,
  type UpdateAttendeeVoteInput,
  type UpdateEventAgendaItemInput,
  type UpdateEventAgendaVoteInput,
  type UpdateEventAttachmentInput,
  type UpdateEventAttendeesInput,
  type UpdateEventDecisionInput,
  type UpdateEventInput,
} from '../../contracts/event'
import {
  event_actual_attendees,
  event_agenda_items,
  event_agenda_vote_options,
  event_agenda_votes,
  event_attachments,
  event_attendee_votes,
  event_decisions,
  event_planned_attendees,
  events,
  users,
} from '../schema'

function normalizeOptional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function findEventOrThrow(db: Database, id: number) {
  const event = await db.select().from(events).where(eq(events.id, id)).get()
  if (!event) {
    throw new AppError('NOT_FOUND', 'Termin nicht gefunden', 404)
  }
  return event
}

export async function findEventBySlugOrThrow(db: Database, slug: string) {
  const event = await db
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .get()
  if (!event) {
    throw new AppError('NOT_FOUND', 'Termin nicht gefunden', 404)
  }
  return event
}

export async function listAllEvents(db: Database) {
  return db
    .select()
    .from(events)
    .orderBy(desc(events.scheduled_date), desc(events.created_at))
    .all()
}

export async function listUpcomingEvents(db: Database) {
  const today = toVienna(nowUtc()).format('YYYY-MM-DD')
  return db
    .select()
    .from(events)
    .orderBy(asc(events.scheduled_date), asc(events.scheduled_time))
    .all()
    .then((rows) => rows.filter((row) => row.scheduled_date >= today))
}

export async function listEventsForPoll(db: Database, pollId: number) {
  return db
    .select()
    .from(events)
    .where(eq(events.poll_id, pollId))
    .orderBy(desc(events.created_at))
    .all()
}

/**
 * Loads an event together with all of its child collections. Drizzle's
 * relations API would be more idiomatic, but we deliberately use explicit
 * queries because the runtime on D1 is finicky with joins on cascading
 * tables — keeping it readable and easy to mock outweighs the boilerplate.
 */
export async function findEventWithDetails(
  db: Database,
  id: number,
): Promise<EventWithDetails> {
  const event = await findEventOrThrow(db, id)

  const planned = await db
    .select()
    .from(event_planned_attendees)
    .where(eq(event_planned_attendees.event_id, id))
    .orderBy(
      asc(event_planned_attendees.sort_order),
      asc(event_planned_attendees.id),
    )
    .all()

  const actual = await db
    .select()
    .from(event_actual_attendees)
    .where(eq(event_actual_attendees.event_id, id))
    .orderBy(
      asc(event_actual_attendees.sort_order),
      asc(event_actual_attendees.id),
    )
    .all()

  const agenda = await db
    .select()
    .from(event_agenda_items)
    .where(eq(event_agenda_items.event_id, id))
    .orderBy(asc(event_agenda_items.sort_order), asc(event_agenda_items.id))
    .all()

  const agendaIds = agenda.map((item) => item.id)
  const votes =
    agendaIds.length === 0
      ? []
      : await db
          .select()
          .from(event_agenda_votes)
          .where(
            sql`${event_agenda_votes.agenda_item_id} IN (${sql.join(
              agendaIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
          .all()

  const voteIds = votes.map((v) => v.id)
  const voteOptions =
    voteIds.length === 0
      ? []
      : await db
          .select()
          .from(event_agenda_vote_options)
          .where(
            sql`${event_agenda_vote_options.vote_id} IN (${sql.join(
              voteIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
          .orderBy(
            asc(event_agenda_vote_options.sort_order),
            asc(event_agenda_vote_options.id),
          )
          .all()

  const optionsByVote = new Map<number, typeof voteOptions>()
  for (const opt of voteOptions) {
    const list = optionsByVote.get(opt.vote_id) ?? []
    list.push(opt)
    optionsByVote.set(opt.vote_id, list)
  }

  const attendeeVotes =
    voteIds.length === 0
      ? []
      : await db
          .select({
            vote_id: event_attendee_votes.vote_id,
            attendee_id: event_attendee_votes.attendee_id,
            option_id: event_attendee_votes.option_id,
            response: event_attendee_votes.response,
          })
          .from(event_attendee_votes)
          .where(
            sql`${event_attendee_votes.vote_id} IN (${sql.join(
              voteIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
          .all()

  const attendeeVotesByVote = new Map<
    number,
    Array<{
      attendee_id: number
      option_id: number | null
      response: boolean | null
    }>
  >()
  for (const av of attendeeVotes) {
    const list = attendeeVotesByVote.get(av.vote_id) ?? []
    list.push({
      attendee_id: av.attendee_id,
      option_id: av.option_id,
      response: av.response,
    })
    attendeeVotesByVote.set(av.vote_id, list)
  }

  const votesByAgenda = new Map<number, typeof votes>()
  for (const vote of votes) {
    const list = votesByAgenda.get(vote.agenda_item_id) ?? []
    list.push(vote)
    votesByAgenda.set(vote.agenda_item_id, list)
  }

  // Attachments: fetch once, partition into "event-level" (agenda_item_id
  // IS NULL) and per-agenda buckets so the detail response mirrors the
  // UI's natural layout.
  const allAttachments = await db
    .select()
    .from(event_attachments)
    .where(eq(event_attachments.event_id, id))
    .orderBy(asc(event_attachments.created_at))
    .all()
  const eventLevelAttachments: EventAttachment[] = []
  const attachmentsByAgenda = new Map<number, EventAttachment[]>()
  for (const att of allAttachments) {
    if (att.agenda_item_id === null) {
      eventLevelAttachments.push(att)
    } else {
      const list = attachmentsByAgenda.get(att.agenda_item_id) ?? []
      list.push(att)
      attachmentsByAgenda.set(att.agenda_item_id, list)
    }
  }

  // Decisions: load rows + their proposer/seconder users + linked votes
  // in three queries, then merge in JS. The display strings are
  // computed server-side so the client never has to do a user join.
  const decisionRows = await db
    .select()
    .from(event_decisions)
    .where(eq(event_decisions.event_id, id))
    .orderBy(asc(event_decisions.sort_order), asc(event_decisions.id))
    .all()

  const userIds = new Set<number>()
  const linkedVoteIds = new Set<number>()
  for (const d of decisionRows) {
    if (d.proposer_user_id !== null) userIds.add(d.proposer_user_id)
    if (d.seconder_user_id !== null) userIds.add(d.seconder_user_id)
    if (d.vote_id !== null) linkedVoteIds.add(d.vote_id)
  }
  const userById = new Map<number, { first_name: string; last_name: string }>()
  if (userIds.size > 0) {
    const rows = await db
      .select({
        id: users.id,
        first_name: users.first_name,
        last_name: users.last_name,
      })
      .from(users)
      .where(inArray(users.id, [...userIds]))
      .all()
    for (const u of rows) userById.set(u.id, u)
  }

  const linkedVotes = new Map<
    number,
    {
      id: number
      agenda_item_id: number
      question: string
      vote_type: 'yn' | 'options'
      counting_mode: 'anonymous' | 'per_attendee'
    }
  >()
  if (linkedVoteIds.size > 0) {
    const rows = await db
      .select({
        id: event_agenda_votes.id,
        agenda_item_id: event_agenda_votes.agenda_item_id,
        question: event_agenda_votes.question,
        vote_type: event_agenda_votes.vote_type,
        counting_mode: event_agenda_votes.counting_mode,
      })
      .from(event_agenda_votes)
      .where(inArray(event_agenda_votes.id, [...linkedVoteIds]))
      .all()
    for (const v of rows) linkedVotes.set(v.id, v)
  }
  // Fetch the options for the linked votes (for the PDF tally).
  const linkedVoteOptions = new Map<
    number,
    Array<{
      id: number
      vote_id: number
      label: string
      count: number
      sort_order: number
    }>
  >()
  if (linkedVoteIds.size > 0) {
    const rows = await db
      .select()
      .from(event_agenda_vote_options)
      .where(inArray(event_agenda_vote_options.vote_id, [...linkedVoteIds]))
      .orderBy(
        asc(event_agenda_vote_options.sort_order),
        asc(event_agenda_vote_options.id),
      )
      .all()
    for (const opt of rows) {
      const list = linkedVoteOptions.get(opt.vote_id) ?? []
      list.push(opt)
      linkedVoteOptions.set(opt.vote_id, list)
    }
  }
  // Per-attendee vote responses for the linked votes. The PDF
  // tally uses these to compute the per_attendee count.
  const linkedAttendeeVotes = new Map<
    number,
    Array<{
      attendee_id: number
      option_id: number | null
      response: boolean | null
    }>
  >()
  if (linkedVoteIds.size > 0) {
    const rows = await db
      .select({
        vote_id: event_attendee_votes.vote_id,
        attendee_id: event_attendee_votes.attendee_id,
        option_id: event_attendee_votes.option_id,
        response: event_attendee_votes.response,
      })
      .from(event_attendee_votes)
      .where(inArray(event_attendee_votes.vote_id, [...linkedVoteIds]))
      .all()
    for (const av of rows) {
      const list = linkedAttendeeVotes.get(av.vote_id) ?? []
      list.push({
        attendee_id: av.attendee_id,
        option_id: av.option_id,
        response: av.response,
      })
      linkedAttendeeVotes.set(av.vote_id, list)
    }
  }

  const decisions: EventDecision[] = decisionRows.map((d) => {
    const proposer =
      d.proposer_user_id !== null ? userById.get(d.proposer_user_id) : null
    const seconder =
      d.seconder_user_id !== null ? userById.get(d.seconder_user_id) : null
    const vote = d.vote_id !== null ? linkedVotes.get(d.vote_id) : null
    const voteSnapshot = vote
      ? {
          id: vote.id,
          question: vote.question,
          vote_type: vote.vote_type,
          counting_mode: vote.counting_mode,
          options: linkedVoteOptions.get(vote.id) ?? [],
          attendee_votes: linkedAttendeeVotes.get(vote.id) ?? [],
        }
      : null
    return {
      ...d,
      proposer_display: proposer
        ? `${proposer.first_name} ${proposer.last_name}`.trim() ||
          d.proposer_name
        : d.proposer_name,
      seconder_display: seconder
        ? `${seconder.first_name} ${seconder.last_name}`.trim() ||
          d.seconder_name
        : d.seconder_name,
      vote_snapshot: voteSnapshot,
    }
  })

  return {
    ...event,
    planned_attendees: planned,
    actual_attendees: actual,
    attachments: eventLevelAttachments,
    decisions,
    agenda_items: agenda.map((item) => ({
      ...item,
      votes: (votesByAgenda.get(item.id) ?? []).map((vote) => ({
        ...vote,
        options: optionsByVote.get(vote.id) ?? [],
        attendee_votes: attendeeVotesByVote.get(vote.id) ?? [],
      })),
      attachments: attachmentsByAgenda.get(item.id) ?? [],
    })),
  }
}

// ── Event CRUD ────────────────────────────────────────────────────────────

export async function createEvent(db: Database, input: CreateEventInput) {
  const now = nowUtc()
  const title = input.title.trim()
  const inserted = await db
    .insert(events)
    .values({
      slug: generateSlug(title),
      poll_id: input.poll_id ?? null,
      title,
      scheduled_date: input.scheduled_date,
      scheduled_time: input.scheduled_time ?? null,
      location: normalizeOptional(input.location),
      agenda: normalizeOptional(input.agenda),
      transcription: normalizeOptional(input.transcription),
      created_at: now,
      updated_at: now,
    })
    .returning()
  const event = inserted[0]
  if (!event) {
    throw new AppError('INTERNAL_ERROR', 'Fehler beim Anlegen des Termins', 500)
  }
  return event
}

export async function updateEvent(
  db: Database,
  id: number,
  input: UpdateEventInput,
) {
  const current = await findEventOrThrow(db, id)
  const now = nowUtc()
  const updates: Partial<typeof events.$inferInsert> = { updated_at: now }
  if (input.title !== undefined) {
    updates.title = input.title.trim()
  }
  if (input.scheduled_date !== undefined) {
    updates.scheduled_date = input.scheduled_date
  }
  if (input.scheduled_time !== undefined) {
    updates.scheduled_time = input.scheduled_time ?? null
  }
  if (input.location !== undefined) {
    updates.location = normalizeOptional(input.location)
  }
  if (input.agenda !== undefined) {
    updates.agenda = normalizeOptional(input.agenda)
  }
  if (input.transcription !== undefined) {
    updates.transcription = normalizeOptional(input.transcription)
  }
  if (input.title !== undefined && input.title.trim() !== current.title) {
    updates.slug = generateSlug(input.title.trim())
  }
  await db.update(events).set(updates).where(eq(events.id, id))
  return findEventOrThrow(db, id)
}

export async function deleteEvent(db: Database, id: number) {
  await findEventOrThrow(db, id)
  await db.delete(events).where(eq(events.id, id))
}

// ── Attendees ─────────────────────────────────────────────────────────────

export async function addPlannedAttendee(
  db: Database,
  eventId: number,
  input: CreateEventAttendeeInput,
) {
  await findEventOrThrow(db, eventId)
  const name = input.name.trim()
  const maxRow = await db
    .select({
      value: sql<number>`COALESCE(MAX(${event_planned_attendees.sort_order}), -1)`,
    })
    .from(event_planned_attendees)
    .where(eq(event_planned_attendees.event_id, eventId))
    .get()
  const sortOrder = (maxRow?.value ?? -1) + 1
  const inserted = await db
    .insert(event_planned_attendees)
    .values({
      event_id: eventId,
      user_id: input.user_id ?? null,
      name,
      sort_order: sortOrder,
    })
    .returning()
  const row = inserted[0]
  if (!row) {
    throw new AppError('INTERNAL_ERROR', 'Fehler beim Anlegen', 500)
  }
  return row
}

export async function addActualAttendee(
  db: Database,
  eventId: number,
  input: CreateEventAttendeeInput,
) {
  await findEventOrThrow(db, eventId)
  const name = input.name.trim()
  const maxRow = await db
    .select({
      value: sql<number>`COALESCE(MAX(${event_actual_attendees.sort_order}), -1)`,
    })
    .from(event_actual_attendees)
    .where(eq(event_actual_attendees.event_id, eventId))
    .get()
  const sortOrder = (maxRow?.value ?? -1) + 1
  const inserted = await db
    .insert(event_actual_attendees)
    .values({
      event_id: eventId,
      user_id: input.user_id ?? null,
      name,
      sort_order: sortOrder,
    })
    .returning()
  const row = inserted[0]
  if (!row) {
    throw new AppError('INTERNAL_ERROR', 'Fehler beim Anlegen', 500)
  }
  return row
}

export async function removePlannedAttendee(
  db: Database,
  eventId: number,
  attendeeId: number,
) {
  await findEventOrThrow(db, eventId)
  await db
    .delete(event_planned_attendees)
    .where(
      and(
        eq(event_planned_attendees.id, attendeeId),
        eq(event_planned_attendees.event_id, eventId),
      ),
    )
}

export async function removeActualAttendee(
  db: Database,
  eventId: number,
  attendeeId: number,
) {
  await findEventOrThrow(db, eventId)
  await db
    .delete(event_actual_attendees)
    .where(
      and(
        eq(event_actual_attendees.id, attendeeId),
        eq(event_actual_attendees.event_id, eventId),
      ),
    )
}

/**
 * Bulk-replace attendees (used by the "edit attendees" form). Removes the
 * existing rows for the event and re-inserts in the provided order. The
 * cascade on event_actual_attendees takes care of any attendee_votes that
 * point at removed rows.
 */
export async function replacePlannedAttendees(
  db: Database,
  eventId: number,
  input: UpdateEventAttendeesInput,
) {
  await findEventOrThrow(db, eventId)
  await db
    .delete(event_planned_attendees)
    .where(eq(event_planned_attendees.event_id, eventId))
  for (const [i, att] of input.attendees.entries()) {
    await db.insert(event_planned_attendees).values({
      event_id: eventId,
      user_id: att.user_id ?? null,
      name: att.name.trim(),
      sort_order: i,
    })
  }
  return findEventWithDetails(db, eventId)
}

export async function replaceActualAttendees(
  db: Database,
  eventId: number,
  input: UpdateEventAttendeesInput,
) {
  await findEventOrThrow(db, eventId)
  await db
    .delete(event_actual_attendees)
    .where(eq(event_actual_attendees.event_id, eventId))
  for (const [i, att] of input.attendees.entries()) {
    await db.insert(event_actual_attendees).values({
      event_id: eventId,
      user_id: att.user_id ?? null,
      name: att.name.trim(),
      sort_order: i,
    })
  }
  return findEventWithDetails(db, eventId)
}

// ── Agenda items ──────────────────────────────────────────────────────────

export async function addAgendaItem(
  db: Database,
  eventId: number,
  input: CreateEventAgendaItemInput,
) {
  await findEventOrThrow(db, eventId)
  const maxRow = await db
    .select({
      value: sql<number>`COALESCE(MAX(${event_agenda_items.sort_order}), -1)`,
    })
    .from(event_agenda_items)
    .where(eq(event_agenda_items.event_id, eventId))
    .get()
  const sortOrder = (maxRow?.value ?? -1) + 1
  const inserted = await db
    .insert(event_agenda_items)
    .values({
      event_id: eventId,
      title: input.title.trim(),
      notes: normalizeOptional(input.notes),
      status: input.status ?? 'open',
      sort_order: sortOrder,
    })
    .returning()
  const row = inserted[0]
  if (!row) {
    throw new AppError('INTERNAL_ERROR', 'Fehler beim Anlegen', 500)
  }
  return row
}

export async function updateAgendaItem(
  db: Database,
  eventId: number,
  itemId: number,
  input: UpdateEventAgendaItemInput,
) {
  await findEventOrThrow(db, eventId)
  const updates: Partial<typeof event_agenda_items.$inferInsert> = {}
  if (input.title !== undefined) {
    updates.title = input.title.trim()
  }
  if (input.notes !== undefined) {
    updates.notes = normalizeOptional(input.notes)
  }
  if (input.status !== undefined) {
    updates.status = input.status
  }
  if (Object.keys(updates).length === 0) {
    return findAgendaItemOrThrow(db, eventId, itemId)
  }
  await db
    .update(event_agenda_items)
    .set(updates)
    .where(
      and(
        eq(event_agenda_items.id, itemId),
        eq(event_agenda_items.event_id, eventId),
      ),
    )
  return findAgendaItemOrThrow(db, eventId, itemId)
}

export async function findAgendaItemOrThrow(
  db: Database,
  eventId: number,
  itemId: number,
) {
  const row = await db
    .select()
    .from(event_agenda_items)
    .where(
      and(
        eq(event_agenda_items.id, itemId),
        eq(event_agenda_items.event_id, eventId),
      ),
    )
    .get()
  if (!row) {
    throw new AppError('NOT_FOUND', 'Agendapunkt nicht gefunden', 404)
  }
  return row
}

export async function deleteAgendaItem(
  db: Database,
  eventId: number,
  itemId: number,
) {
  await findEventOrThrow(db, eventId)
  await db
    .delete(event_agenda_items)
    .where(
      and(
        eq(event_agenda_items.id, itemId),
        eq(event_agenda_items.event_id, eventId),
      ),
    )
}

export async function reorderAgendaItems(
  db: Database,
  eventId: number,
  order: number[],
) {
  await findEventOrThrow(db, eventId)
  // Validate that every id belongs to this event so a stale payload
  // doesn't quietly desync the order column.
  const existing = await db
    .select({ id: event_agenda_items.id })
    .from(event_agenda_items)
    .where(eq(event_agenda_items.event_id, eventId))
    .all()
  const known = new Set(existing.map((row) => row.id))
  if (order.some((id) => !known.has(id))) {
    throw new AppError('VALIDATION_ERROR', 'Ungültige Reihenfolge', 400)
  }
  for (const [i, id] of order.entries()) {
    await db
      .update(event_agenda_items)
      .set({ sort_order: i })
      .where(
        and(
          eq(event_agenda_items.id, id),
          eq(event_agenda_items.event_id, eventId),
        ),
      )
  }
  return findEventWithDetails(db, eventId)
}

// ── Agenda votes ──────────────────────────────────────────────────────────

export async function addAgendaVote(
  db: Database,
  eventId: number,
  agendaItemId: number,
  input: CreateEventAgendaVoteInput,
) {
  await findEventOrThrow(db, eventId)
  await findAgendaItemOrThrow(db, eventId, agendaItemId)

  const now = nowUtc()
  const inserted = await db
    .insert(event_agenda_votes)
    .values({
      agenda_item_id: agendaItemId,
      question: input.question.trim(),
      vote_type: input.vote_type,
      counting_mode: input.counting_mode,
      result_note: normalizeOptional(input.result_note),
      created_at: now,
      updated_at: now,
    })
    .returning()
  const vote = inserted[0]
  if (!vote) {
    throw new AppError('INTERNAL_ERROR', 'Fehler beim Anlegen', 500)
  }

  if (input.vote_type === 'yn') {
    // Pre-seed Ja/Nein options. count starts at 0 — for `per_attendee`
    // it stays there, the join table is the source of truth.
    await db.insert(event_agenda_vote_options).values([
      { vote_id: vote.id, label: 'Ja', count: 0, sort_order: 0 },
      { vote_id: vote.id, label: 'Nein', count: 0, sort_order: 1 },
    ])
  } else if (input.options) {
    await db.insert(event_agenda_vote_options).values(
      input.options.map((opt, i) => ({
        vote_id: vote.id,
        label: opt.label.trim(),
        count: 0,
        sort_order: i,
      })),
    )
  }
  return findVoteWithOptionsOrThrow(db, vote.id)
}

export async function findVoteOrThrow(db: Database, voteId: number) {
  const vote = await db
    .select()
    .from(event_agenda_votes)
    .where(eq(event_agenda_votes.id, voteId))
    .get()
  if (!vote) {
    throw new AppError('NOT_FOUND', 'Abstimmung nicht gefunden', 404)
  }
  return vote
}

export async function findVoteWithOptionsOrThrow(db: Database, voteId: number) {
  const vote = await findVoteOrThrow(db, voteId)
  const options = await db
    .select()
    .from(event_agenda_vote_options)
    .where(eq(event_agenda_vote_options.vote_id, voteId))
    .orderBy(
      asc(event_agenda_vote_options.sort_order),
      asc(event_agenda_vote_options.id),
    )
    .all()
  return { ...vote, options }
}

export async function updateAgendaVote(
  db: Database,
  voteId: number,
  input: UpdateEventAgendaVoteInput,
) {
  const vote = await findVoteOrThrow(db, voteId)
  const now = nowUtc()
  const updates: Partial<typeof event_agenda_votes.$inferInsert> = {
    updated_at: now,
  }
  if (input.question !== undefined) {
    updates.question = input.question.trim()
  }
  if (input.result_note !== undefined) {
    updates.result_note = normalizeOptional(input.result_note)
  }
  await db
    .update(event_agenda_votes)
    .set(updates)
    .where(eq(event_agenda_votes.id, voteId))

  if (input.options && vote.vote_type === 'options') {
    // Replace option rows that came in without an `id` (new ones), and
    // update label/count on rows that did include their id. Any existing
    // options not referenced are removed — the admin is editing the full
    // list. This keeps the schema simple at the cost of throwing away
    // attendee_votes for removed options, which cascade-delete anyway.
    const incoming = input.options
    const existing = await db
      .select()
      .from(event_agenda_vote_options)
      .where(eq(event_agenda_vote_options.vote_id, voteId))
      .all()
    const existingById = new Map(existing.map((o) => [o.id, o]))
    const incomingIds = new Set(
      incoming.filter((o) => o.id !== undefined).map((o) => o.id as number),
    )
    for (const id of existingById.keys()) {
      if (!incomingIds.has(id)) {
        await db
          .delete(event_agenda_vote_options)
          .where(eq(event_agenda_vote_options.id, id))
      }
    }
    let order = 0
    for (const opt of incoming) {
      if (opt.id !== undefined) {
        await db
          .update(event_agenda_vote_options)
          .set({
            label: opt.label.trim(),
            count: opt.count ?? existingById.get(opt.id)?.count ?? 0,
            sort_order: order,
          })
          .where(eq(event_agenda_vote_options.id, opt.id))
      } else {
        await db.insert(event_agenda_vote_options).values({
          vote_id: voteId,
          label: opt.label.trim(),
          count: opt.count ?? 0,
          sort_order: order,
        })
      }
      order += 1
    }
  }
  void vote
  return findVoteWithOptionsOrThrow(db, voteId)
}

export async function deleteAgendaVote(db: Database, voteId: number) {
  await findVoteOrThrow(db, voteId)
  await db.delete(event_agenda_votes).where(eq(event_agenda_votes.id, voteId))
}

// ── Attendee vote responses (per_attendee mode) ──────────────────────────

export async function setAttendeeVote(
  db: Database,
  voteId: number,
  attendeeId: number,
  input: UpdateAttendeeVoteInput,
) {
  await findVoteOrThrow(db, voteId)
  // Verify attendee belongs to the same event as the vote.
  const vote = await db
    .select({
      agenda_item_id: event_agenda_votes.agenda_item_id,
    })
    .from(event_agenda_votes)
    .where(eq(event_agenda_votes.id, voteId))
    .get()
  if (!vote) {
    throw new AppError('NOT_FOUND', 'Abstimmung nicht gefunden', 404)
  }
  const item = await db
    .select({ event_id: event_agenda_items.event_id })
    .from(event_agenda_items)
    .where(eq(event_agenda_items.id, vote.agenda_item_id))
    .get()
  if (!item) {
    throw new AppError('NOT_FOUND', 'Agendapunkt nicht gefunden', 404)
  }
  const attendee = await db
    .select()
    .from(event_actual_attendees)
    .where(eq(event_actual_attendees.id, attendeeId))
    .get()
  if (!attendee || attendee.event_id !== item.event_id) {
    throw new AppError('VALIDATION_ERROR', 'Ungültiger Teilnehmer', 400)
  }

  const cleared =
    (input.option_id === null || input.option_id === undefined) &&
    (input.response === null || input.response === undefined)

  if (cleared) {
    await db
      .delete(event_attendee_votes)
      .where(
        and(
          eq(event_attendee_votes.vote_id, voteId),
          eq(event_attendee_votes.attendee_id, attendeeId),
        ),
      )
    return { ok: true, cleared: true }
  }

  await db
    .insert(event_attendee_votes)
    .values({
      vote_id: voteId,
      attendee_id: attendeeId,
      option_id: input.option_id ?? null,
      response: input.response ?? null,
    })
    .onConflictDoUpdate({
      target: [event_attendee_votes.vote_id, event_attendee_votes.attendee_id],
      set: {
        option_id: input.option_id ?? null,
        response: input.response ?? null,
      },
    })
  return { ok: true, cleared: false }
}

// ── Locked-poll → event helpers ──────────────────────────────────────────

/**
 * Returns the event linked to a poll, if any. Used by the "Event anlegen"
 * button on the locked poll editor to detect an existing one.
 */
export async function findEventForPoll(db: Database, pollId: number) {
  const event = await db
    .select()
    .from(events)
    .where(eq(events.poll_id, pollId))
    .orderBy(desc(events.created_at))
    .get()
  return event ?? null
}

// ── Attachments ───────────────────────────────────────────────────────────

/**
 * Input for `addAttachment` — the worker hands us the validated
 * metadata; the bytes live in the R2 binding.
 */
export type AddAttachmentInput = {
  filename: string
  content_type: string
  /** R2 key where the worker has already PUT the object. We pass it in
   *  rather than having the query generate it so the worker can use the
   *  same key for the body stream and the row insert (no second lookup
   *  is needed if R2 put fails). */
  r2_key: string
  size: number
  agenda_item_id?: number | null
  caption?: string | null
  uploaded_by_user_id?: number | null
}

export async function addAttachment(
  db: Database,
  eventId: number,
  input: AddAttachmentInput,
) {
  await findEventOrThrow(db, eventId)
  if (!isAllowedAttachmentContentType(input.content_type)) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Dateityp nicht erlaubt. Erlaubt: Bilder und PDF.',
      400,
    )
  }
  if (input.size <= 0 || input.size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Datei zu groß (max ${Math.round(MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024)} MB).`,
      400,
    )
  }
  // If scoped to an agenda item, verify it belongs to this event.
  if (input.agenda_item_id !== null && input.agenda_item_id !== undefined) {
    const item = await db
      .select({
        id: event_agenda_items.id,
        event_id: event_agenda_items.event_id,
      })
      .from(event_agenda_items)
      .where(eq(event_agenda_items.id, input.agenda_item_id))
      .get()
    if (!item || item.event_id !== eventId) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Agendapunkt gehört nicht zu diesem Termin.',
        400,
      )
    }
  }
  const now = nowUtc()
  const inserted = await db
    .insert(event_attachments)
    .values({
      event_id: eventId,
      agenda_item_id: input.agenda_item_id ?? null,
      filename: input.filename,
      content_type: input.content_type,
      size: input.size,
      r2_key: input.r2_key,
      caption: normalizeOptional(input.caption),
      uploaded_by_user_id: input.uploaded_by_user_id ?? null,
      created_at: now,
    })
    .returning()
  const row = inserted[0]
  if (!row) {
    throw new AppError('INTERNAL_ERROR', 'Fehler beim Anlegen', 500)
  }
  return row
}

export async function findAttachmentOrThrow(db: Database, id: number) {
  const row = await db
    .select()
    .from(event_attachments)
    .where(eq(event_attachments.id, id))
    .get()
  if (!row) {
    throw new AppError('NOT_FOUND', 'Anhang nicht gefunden', 404)
  }
  return row
}

export async function updateAttachment(
  db: Database,
  id: number,
  input: UpdateEventAttachmentInput,
) {
  const current = await findAttachmentOrThrow(db, id)
  const updates: Partial<typeof event_attachments.$inferInsert> = {}
  if (input.caption !== undefined) {
    updates.caption = normalizeOptional(input.caption)
  }
  if (input.agenda_item_id !== undefined) {
    if (input.agenda_item_id !== null) {
      // Validate the new parent.
      const item = await db
        .select({
          id: event_agenda_items.id,
          event_id: event_agenda_items.event_id,
        })
        .from(event_agenda_items)
        .where(eq(event_agenda_items.id, input.agenda_item_id))
        .get()
      if (!item || item.event_id !== current.event_id) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Agendapunkt gehört nicht zu diesem Termin.',
          400,
        )
      }
    }
    updates.agenda_item_id = input.agenda_item_id
  }
  if (Object.keys(updates).length === 0) {
    return current
  }
  await db
    .update(event_attachments)
    .set(updates)
    .where(eq(event_attachments.id, id))
  return findAttachmentOrThrow(db, id)
}

/**
 * Deletes the DB row and best-effort the R2 object. If the R2 delete
 * fails (object already gone, transient network error) we don't fail
 * the whole call — the row is the source of truth for what the user
 * sees, and an orphan blob is cheap to ignore.
 */
export async function deleteAttachment(
  db: Database,
  bucket: R2Bucket,
  id: number,
) {
  const row = await findAttachmentOrThrow(db, id)
  await db.delete(event_attachments).where(eq(event_attachments.id, id))
  try {
    await bucket.delete(row.r2_key)
  } catch (err) {
    console.warn('[attachments] R2 delete failed', { r2_key: row.r2_key, err })
  }
}

export async function listEventAttachments(db: Database, eventId: number) {
  return db
    .select()
    .from(event_attachments)
    .where(eq(event_attachments.event_id, eventId))
    .orderBy(asc(event_attachments.created_at))
    .all()
}

// ── Decisions / Beschlüsse ───────────────────────────────────────────────

/**
 * Computes the next resolution number for an event's calendar year.
 * We look at every decision in the same year (across all events) and
 * pick the max suffix + 1. The number is globally unique by virtue of
 * the unique index on `event_decisions.resolution_number`.
 */
async function nextDecisionResolutionNumber(
  db: Database,
  eventId: number,
): Promise<string> {
  // Use the event's `scheduled_date` to determine the year so a
  // late-recorded Beschluss still gets the right year.
  const event = await findEventOrThrow(db, eventId)
  const year = Number.parseInt(event.scheduled_date.slice(0, 4), 10)
  const allRows = await db
    .select({ resolution_number: event_decisions.resolution_number })
    .from(event_decisions)
    .all()
  return nextResolutionNumberForYear(
    allRows,
    Number.isFinite(year) ? year : new Date().getUTCFullYear(),
  )
}

export async function addDecision(
  db: Database,
  eventId: number,
  input: CreateEventDecisionInput,
) {
  await findEventOrThrow(db, eventId)
  if (input.agenda_item_id !== undefined && input.agenda_item_id !== null) {
    const item = await db
      .select({
        id: event_agenda_items.id,
        event_id: event_agenda_items.event_id,
      })
      .from(event_agenda_items)
      .where(eq(event_agenda_items.id, input.agenda_item_id))
      .get()
    if (!item || item.event_id !== eventId) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Agendapunkt gehört nicht zu diesem Termin.',
        400,
      )
    }
  }
  if (input.vote_id !== undefined && input.vote_id !== null) {
    const vote = await db
      .select({
        id: event_agenda_votes.id,
        agenda_item_id: event_agenda_votes.agenda_item_id,
      })
      .from(event_agenda_votes)
      .where(eq(event_agenda_votes.id, input.vote_id))
      .get()
    if (!vote) {
      throw new AppError('VALIDATION_ERROR', 'Abstimmung nicht gefunden.', 400)
    }
    // Verify the vote belongs to an agenda item in this event.
    const item = await db
      .select({ event_id: event_agenda_items.event_id })
      .from(event_agenda_items)
      .where(eq(event_agenda_items.id, vote.agenda_item_id))
      .get()
    if (!item || item.event_id !== eventId) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Abstimmung gehört nicht zu diesem Termin.',
        400,
      )
    }
  }

  const now = nowUtc()
  const resolutionNumber = await nextDecisionResolutionNumber(db, eventId)

  // Sort order: append to the end of the existing list.
  const maxRow = await db
    .select({
      value: sql<number>`COALESCE(MAX(${event_decisions.sort_order}), -1)`,
    })
    .from(event_decisions)
    .where(eq(event_decisions.event_id, eventId))
    .get()
  const sortOrder = (maxRow?.value ?? -1) + 1

  const inserted = await db
    .insert(event_decisions)
    .values({
      event_id: eventId,
      agenda_item_id: input.agenda_item_id ?? null,
      resolution_number: resolutionNumber,
      wording: input.wording.trim(),
      proposer_user_id: input.proposer_user_id ?? null,
      proposer_name: input.proposer_name ?? null,
      seconder_user_id: input.seconder_user_id ?? null,
      seconder_name: input.seconder_name ?? null,
      vote_id: input.vote_id ?? null,
      result_note: normalizeOptional(input.result_note),
      sort_order: sortOrder,
      created_at: now,
      updated_at: now,
    })
    .returning()
  const row = inserted[0]
  if (!row) {
    throw new AppError('INTERNAL_ERROR', 'Fehler beim Anlegen', 500)
  }
  return row
}

export async function findDecisionOrThrow(db: Database, id: number) {
  const row = await db
    .select()
    .from(event_decisions)
    .where(eq(event_decisions.id, id))
    .get()
  if (!row) {
    throw new AppError('NOT_FOUND', 'Beschluss nicht gefunden', 404)
  }
  return row
}

export async function updateDecision(
  db: Database,
  eventId: number,
  id: number,
  input: UpdateEventDecisionInput,
) {
  const current = await findDecisionOrThrow(db, id)
  if (current.event_id !== eventId) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Beschluss gehört nicht zu diesem Termin.',
      400,
    )
  }
  const updates: Partial<typeof event_decisions.$inferInsert> = {
    updated_at: nowUtc(),
  }
  if (input.wording !== undefined) {
    updates.wording = input.wording.trim()
  }
  if (input.agenda_item_id !== undefined) {
    if (input.agenda_item_id !== null) {
      const item = await db
        .select({
          id: event_agenda_items.id,
          event_id: event_agenda_items.event_id,
        })
        .from(event_agenda_items)
        .where(eq(event_agenda_items.id, input.agenda_item_id))
        .get()
      if (!item || item.event_id !== eventId) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Agendapunkt gehört nicht zu diesem Termin.',
          400,
        )
      }
    }
    updates.agenda_item_id = input.agenda_item_id
  }
  if (input.proposer_user_id !== undefined) {
    updates.proposer_user_id = input.proposer_user_id
  }
  if (input.proposer_name !== undefined) {
    updates.proposer_name = input.proposer_name
  }
  if (input.seconder_user_id !== undefined) {
    updates.seconder_user_id = input.seconder_user_id
  }
  if (input.seconder_name !== undefined) {
    updates.seconder_name = input.seconder_name
  }
  if (input.vote_id !== undefined) {
    if (input.vote_id !== null) {
      const vote = await db
        .select({
          id: event_agenda_votes.id,
          agenda_item_id: event_agenda_votes.agenda_item_id,
        })
        .from(event_agenda_votes)
        .where(eq(event_agenda_votes.id, input.vote_id))
        .get()
      if (!vote) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Abstimmung nicht gefunden.',
          400,
        )
      }
      const item = await db
        .select({ event_id: event_agenda_items.event_id })
        .from(event_agenda_items)
        .where(eq(event_agenda_items.id, vote.agenda_item_id))
        .get()
      if (!item || item.event_id !== eventId) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Abstimmung gehört nicht zu diesem Termin.',
          400,
        )
      }
    }
    updates.vote_id = input.vote_id
  }
  if (input.result_note !== undefined) {
    updates.result_note = normalizeOptional(input.result_note)
  }
  if (Object.keys(updates).length === 1) {
    // Only `updated_at` is set — nothing else changed.
    return current
  }
  await db
    .update(event_decisions)
    .set(updates)
    .where(eq(event_decisions.id, id))
  return findDecisionOrThrow(db, id)
}

export async function deleteDecision(
  db: Database,
  eventId: number,
  id: number,
) {
  const current = await findDecisionOrThrow(db, id)
  if (current.event_id !== eventId) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Beschluss gehört nicht zu diesem Termin.',
      400,
    )
  }
  await db.delete(event_decisions).where(eq(event_decisions.id, id))
}
