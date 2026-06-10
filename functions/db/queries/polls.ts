import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { nowUtc, toVienna } from '../../_lib/dayjs'
import type { Database } from '../../_lib/db'
import { AppError } from '../../_lib/errors'
import { generateSlug } from '../../_lib/slug'
import type {
  AddPollOptionsInput,
  CreatePollInput,
  FinalizePollInput,
} from '../../contracts/poll'
import { poll_options, polls, votes } from '../schema'

export async function findPollOrThrow(db: Database, id: number) {
  const poll = await db.select().from(polls).where(eq(polls.id, id)).get()
  if (!poll) {
    throw new AppError('NOT_FOUND', 'Umfrage nicht gefunden', 404)
  }
  return poll
}

export async function findPollBySlugOrThrow(db: Database, slug: string) {
  const poll = await db.select().from(polls).where(eq(polls.slug, slug)).get()
  if (!poll) {
    throw new AppError('NOT_FOUND', 'Umfrage nicht gefunden', 404)
  }
  return poll
}

export async function findPollWithDetailsBySlug(db: Database, slug: string) {
  const poll = await findPollBySlugOrThrow(db, slug)
  return findPollWithDetails(db, poll.id)
}

export async function findPollWithDetails(db: Database, id: number) {
  const poll = await findPollOrThrow(db, id)
  const options = await db
    .select()
    .from(poll_options)
    .where(eq(poll_options.poll_id, id))
    .orderBy(
      asc(poll_options.date),
      asc(poll_options.time),
      asc(poll_options.sort_order),
    )
    .all()
  const pollVotes = await db
    .select()
    .from(votes)
    .where(eq(votes.poll_id, id))
    .all()
  return { ...poll, options, votes: pollVotes }
}

export async function findActivePollWithDetails(db: Database) {
  const poll = await db
    .select()
    .from(polls)
    .where(eq(polls.is_active, true))
    .get()
  if (!poll) return null
  return findPollWithDetails(db, poll.id)
}

export async function listAllPolls(db: Database) {
  return db.select().from(polls).orderBy(desc(polls.created_at)).all()
}

export async function createPollWithOptions(
  db: Database,
  input: CreatePollInput,
) {
  await db
    .update(polls)
    .set({ is_active: false })
    .where(eq(polls.is_active, true))

  const now = nowUtc()
  const inserted = await db
    .insert(polls)
    .values({
      slug: generateSlug(input.title),
      title: input.title,
      description: input.description ?? null,
      is_active: true,
      created_at: now,
    })
    .returning()

  const newPoll = inserted[0]
  if (!newPoll) {
    throw new AppError(
      'INTERNAL_ERROR',
      'Fehler beim Erstellen der Umfrage',
      500,
    )
  }

  const optionValues = input.options.map((opt, i) => ({
    poll_id: newPoll.id,
    label: opt.label,
    date: opt.date,
    time: opt.time ?? null,
    sort_order: i,
  }))
  for (const opt of optionValues) {
    // D1 rejects Drizzle's generated `("id", ...) VALUES (null, ...)` for
    // AUTOINCREMENT columns on tables with FK constraints — use raw SQL to
    // omit the id column. Quote all identifiers so D1 doesn't misparse
    // "date" / "time" as SQL functions.
    await db.run(
      sql`INSERT INTO "poll_options" ("poll_id", "label", "date", "time", "sort_order")
          VALUES (${opt.poll_id}, ${opt.label}, ${opt.date}, ${opt.time}, ${opt.sort_order})`,
    )
  }

  const options = await db
    .select()
    .from(poll_options)
    .where(eq(poll_options.poll_id, newPoll.id))
    .orderBy(
      asc(poll_options.date),
      asc(poll_options.time),
      asc(poll_options.sort_order),
    )
    .all()

  return { ...newPoll, options, votes: [] }
}

export async function addPollOptions(
  db: Database,
  pollId: number,
  input: AddPollOptionsInput,
) {
  await findPollOrThrow(db, pollId)

  const maxRow = await db
    .select({
      value: sql<number>`COALESCE(MAX(${poll_options.sort_order}), -1)`,
    })
    .from(poll_options)
    .where(eq(poll_options.poll_id, pollId))
    .get()
  let nextOrder = (maxRow?.value ?? -1) + 1

  for (const opt of input.options) {
    await db.run(
      sql`INSERT INTO "poll_options" ("poll_id", "label", "date", "time", "sort_order")
          VALUES (${pollId}, ${opt.label}, ${opt.date}, ${opt.time ?? null}, ${nextOrder})`,
    )
    nextOrder += 1
  }

  return findPollWithDetails(db, pollId)
}

export async function upsertVotes(
  db: Database,
  pollId: number,
  voterName: string,
  responses: Array<{
    option_id: number
    response: 'yes' | 'no' | 'maybe' | null
    comment?: string
  }>,
) {
  const now = nowUtc()
  for (const r of responses) {
    if (r.response === null) {
      await db
        .delete(votes)
        .where(
          and(
            eq(votes.poll_id, pollId),
            eq(votes.voter_name, voterName),
            eq(votes.option_id, r.option_id),
          ),
        )
      continue
    }
    await db
      .insert(votes)
      .values({
        poll_id: pollId,
        option_id: r.option_id,
        voter_name: voterName,
        response: r.response,
        comment: r.comment ?? null,
        created_at: now,
        updated_at: now,
      })
      .onConflictDoUpdate({
        target: [votes.poll_id, votes.voter_name, votes.option_id],
        set: {
          response: r.response,
          comment: r.comment ?? null,
          updated_at: now,
        },
      })
  }
}

export async function finalizePoll(
  db: Database,
  id: number,
  input: FinalizePollInput,
) {
  await findPollOrThrow(db, id)
  const now = nowUtc()
  const updates: Partial<typeof polls.$inferInsert> = {}
  if (input.final_option_id !== undefined) {
    updates.final_option_id = input.final_option_id
  }
  if (input.closed === true) {
    updates.is_active = false
    updates.closed_at = now
  }
  await db.update(polls).set(updates).where(eq(polls.id, id))
  return findPollWithDetails(db, id)
}

export async function deletePoll(db: Database, id: number) {
  await findPollOrThrow(db, id)
  await db.delete(polls).where(eq(polls.id, id))
}

/**
 * Finds the next upcoming event: a locked poll (`final_option_id` is set)
 * whose chosen option date is today or later in the project's default
 * timezone. Falls back to the most recently locked poll (even if past) so
 * the landing page still surfaces the latest decision.
 */
export async function findNextLockedEvent(db: Database) {
  const lockedPolls = await db
    .select()
    .from(polls)
    .where(isNotNull(polls.final_option_id))
    .all()

  if (lockedPolls.length === 0) return null

  // Pull all options for the locked polls in a single query, then group by
  // poll id so we can resolve the chosen option for each locked poll.
  const pollIds = lockedPolls.map((p) => p.id)
  const allOptions = await db
    .select()
    .from(poll_options)
    .where(
      sql`${poll_options.poll_id} IN (${sql.join(
        pollIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    )
    .all()
  const optionsByPoll = new Map<number, typeof allOptions>()
  for (const opt of allOptions) {
    const list = optionsByPoll.get(opt.poll_id) ?? []
    list.push(opt)
    optionsByPoll.set(opt.poll_id, list)
  }

  type Resolved = {
    pollId: number
    title: string
    slug: string
    option: (typeof allOptions)[number]
  }

  const resolved: Resolved[] = []
  for (const poll of lockedPolls) {
    const finalId = poll.final_option_id
    if (finalId == null) continue
    const options = optionsByPoll.get(poll.id)
    const opt = options?.find((o) => o.id === finalId)
    if (!opt) continue
    resolved.push({
      pollId: poll.id,
      title: poll.title,
      slug: poll.slug,
      option: opt,
    })
  }
  if (resolved.length === 0) return null

  // option.date is a "YYYY-MM-DD" string interpreted in the project's
  // local timezone (Vienna). Compare the calendar day against "today" in
  // the same timezone so a locked event for today still counts as upcoming.
  const todayDate = toVienna(nowUtc()).format('YYYY-MM-DD')
  const upcoming = resolved
    .filter((r) => r.option.date >= todayDate)
    .sort((a, b) => a.option.date.localeCompare(b.option.date))
  if (upcoming.length > 0) {
    return upcoming[0]
  }
  // All locked events are in the past — surface the most recent one.
  return resolved.sort((a, b) => b.option.date.localeCompare(a.option.date))[0]
}
