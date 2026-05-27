import { asc, desc, eq } from 'drizzle-orm'
import { nowUtc } from '../../_lib/dayjs'
import type { Database } from '../../_lib/db'
import { AppError } from '../../_lib/errors'
import { generateSlug } from '../../_lib/slug'
import type { CreatePollInput, FinalizePollInput } from '../../contracts/poll'
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
    .orderBy(asc(poll_options.sort_order), asc(poll_options.date))
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
    await db.insert(poll_options).values(opt).returning()
  }

  const options = await db
    .select()
    .from(poll_options)
    .where(eq(poll_options.poll_id, newPoll.id))
    .orderBy(asc(poll_options.sort_order))
    .all()

  return { ...newPoll, options, votes: [] }
}

export async function upsertVotes(
  db: Database,
  pollId: number,
  voterName: string,
  responses: Array<{
    option_id: number
    response: 'yes' | 'no' | 'maybe'
    comment?: string
  }>,
) {
  const now = nowUtc()
  for (const r of responses) {
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
