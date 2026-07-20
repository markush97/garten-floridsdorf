import { and, gte, lte } from 'drizzle-orm'
import type { MergedCalendarData } from '../../_lib/calendar-feed'
import { DEFAULT_TIMEZONE, dayjs } from '../../_lib/dayjs'
import type { Database } from '../../_lib/db'
import { events } from '../schema'
import { listConfirmedBookingsInRange } from './bookings'
import { listCalendarEventsInRange } from './calendar-events'

/**
 * The merged member calendar for a Vienna date range (inclusive):
 * admin-managed Vereinstermine, member entries, and confirmed
 * reservations. Shared by `GET /api/calendar` and the iCal feed.
 */
export async function getMergedCalendar(
  db: Database,
  range: { from: string; to: string },
): Promise<MergedCalendarData> {
  const termine = await db
    .select({
      id: events.id,
      slug: events.slug,
      title: events.title,
      scheduled_date: events.scheduled_date,
      scheduled_time: events.scheduled_time,
      location: events.location,
      updated_at: events.updated_at,
    })
    .from(events)
    .where(
      and(
        gte(events.scheduled_date, range.from),
        lte(events.scheduled_date, range.to),
      ),
    )
    .all()

  const memberEvents = await listCalendarEventsInRange(db, range.from, range.to)

  // Bookings are stored as UTC instants — convert the inclusive
  // Vienna date range to the covering instant window.
  const fromUtc = dayjs
    .tz(`${range.from} 00:00`, DEFAULT_TIMEZONE)
    .toISOString()
  const toUtc = dayjs
    .tz(`${range.to} 00:00`, DEFAULT_TIMEZONE)
    .add(1, 'day')
    .toISOString()
  const bookings = await listConfirmedBookingsInRange(db, fromUtc, toUtc)

  return { termine, events: memberEvents, bookings }
}
