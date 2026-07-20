import { and, eq, lte, sql } from 'drizzle-orm'
import { nowUtc } from '../../_lib/dayjs'
import type { Database } from '../../_lib/db'
import { AppError } from '../../_lib/errors'
import { normalizeOptional } from '../../_lib/strings'
import {
  type CreateCalendarEventInput,
  calendarEventPeriodIssue,
  type UpdateCalendarEventInput,
} from '../../contracts/calendar'
import { type CalendarEventRow, calendar_events } from '../schema'

export async function findCalendarEventOrThrow(
  db: Database,
  id: number,
): Promise<CalendarEventRow> {
  const row = await db
    .select()
    .from(calendar_events)
    .where(eq(calendar_events.id, id))
    .get()
  if (!row) {
    throw new AppError('NOT_FOUND', 'Kalendereintrag nicht gefunden', 404)
  }
  return row
}

/** All entries whose (start, end ?? start) date range touches [from, to]. */
export async function listCalendarEventsInRange(
  db: Database,
  from: string,
  to: string,
): Promise<CalendarEventRow[]> {
  return db
    .select()
    .from(calendar_events)
    .where(
      and(
        lte(calendar_events.start_date, to),
        sql`coalesce(${calendar_events.end_date}, ${calendar_events.start_date}) >= ${from}`,
      ),
    )
    .all()
}

export async function createCalendarEvent(
  db: Database,
  input: CreateCalendarEventInput,
  creator: { id: number | null; name: string },
): Promise<CalendarEventRow> {
  const now = nowUtc()
  const inserted = await db
    .insert(calendar_events)
    .values({
      title: input.title,
      description: normalizeOptional(input.description),
      location: normalizeOptional(input.location),
      start_date: input.start_date,
      end_date: input.end_date ?? null,
      start_time: input.start_time ?? null,
      end_time: input.end_time ?? null,
      created_by_user_id: creator.id,
      created_by_name: creator.name,
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

export async function updateCalendarEvent(
  db: Database,
  id: number,
  input: UpdateCalendarEventInput,
): Promise<CalendarEventRow> {
  const existing = await findCalendarEventOrThrow(db, id)

  const updates: Partial<typeof calendar_events.$inferInsert> = {
    updated_at: nowUtc(),
  }
  if (input.title !== undefined) updates.title = input.title
  if (input.description !== undefined) {
    updates.description = normalizeOptional(input.description)
  }
  if (input.location !== undefined) {
    updates.location = normalizeOptional(input.location)
  }
  if (input.start_date !== undefined) updates.start_date = input.start_date
  if (input.end_date !== undefined) updates.end_date = input.end_date
  if (input.start_time !== undefined) updates.start_time = input.start_time
  if (input.end_time !== undefined) updates.end_time = input.end_time

  // Re-check the cross-field period rule on the merged values — the
  // zod schema only sees the fields present in the PATCH.
  const merged = { ...existing, ...updates }
  const issue = calendarEventPeriodIssue({
    start_date: merged.start_date,
    end_date: merged.end_date ?? null,
    start_time: merged.start_time ?? null,
    end_time: merged.end_time ?? null,
  })
  if (issue) {
    throw new AppError('VALIDATION_ERROR', issue, 400)
  }

  await db
    .update(calendar_events)
    .set(updates)
    .where(eq(calendar_events.id, id))
  return findCalendarEventOrThrow(db, id)
}

export async function deleteCalendarEvent(
  db: Database,
  id: number,
): Promise<void> {
  await findCalendarEventOrThrow(db, id)
  await db.delete(calendar_events).where(eq(calendar_events.id, id))
}
