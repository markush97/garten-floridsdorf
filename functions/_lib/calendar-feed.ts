import type { BookingRow, CalendarEventRow } from '../db/schema'
import { utcToBookingPeriod } from './booking'
import type { FeedEntry } from './ical'

/**
 * Maps the merged member calendar (Vereinstermine, member entries,
 * confirmed reservations) onto iCal feed entries. Pure — the DB
 * query lives in `db/queries/calendar.ts`, the VEVENT rendering in
 * `_lib/ical.ts`.
 */

/** The Vereinstermin columns the feed needs (subset of `events`). */
export type FeedTermin = {
  id: number
  slug: string
  title: string
  scheduled_date: string
  scheduled_time: string | null
  location: string | null
  updated_at: string
}

export type MergedCalendarData = {
  termine: FeedTermin[]
  events: CalendarEventRow[]
  /** Confirmed bookings only — cancelled ones must not reach the feed. */
  bookings: BookingRow[]
}

export function feedEntriesFromCalendar(
  data: MergedCalendarData,
  origin: string,
): FeedEntry[] {
  return [
    ...data.termine.map((termin) => terminEntry(termin, origin)),
    ...data.events.map((event) => memberEventEntry(event, origin)),
    ...data.bookings.map((booking) => bookingEntry(booking, origin)),
  ]
}

/**
 * UID matches the existing single-event export in `buildEventIcal`
 * (`event-{id}@garten-floridsdorf.app`) so clients that imported a
 * downloaded .ics dedupe against the subscribed feed. Timed Termine
 * keep the established 60-minute default duration (the schema has
 * no end time).
 */
function terminEntry(termin: FeedTermin, origin: string): FeedEntry {
  return {
    uid: `event-${termin.id}@garten-floridsdorf.app`,
    summary: termin.title,
    description: 'Vereinstermin',
    location: termin.location,
    url: `${origin}/intern/termine/${termin.slug}`,
    dtstampUtc: termin.updated_at,
    startDate: termin.scheduled_date,
    startTime: termin.scheduled_time,
    endDate: termin.scheduled_date,
    endTime: null, // 60-minute default applied by the builder
  }
}

function memberEventEntry(event: CalendarEventRow, origin: string): FeedEntry {
  const description = [
    event.description,
    `Eingetragen von ${event.created_by_name}`,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join('\n')
  return {
    uid: `calendar-event-${event.id}@garten-floridsdorf.app`,
    summary: event.title,
    description,
    location: event.location,
    url: `${origin}/intern/kalender`,
    dtstampUtc: event.updated_at,
    startDate: event.start_date,
    // All-day when no start time; the contract guarantees end_time
    // only appears together with start_time.
    startTime: event.start_time,
    endDate: event.end_date ?? event.start_date,
    endTime: event.end_time,
  }
}

/** Day count only — the Statuten govern the money side. */
function bookingEntry(booking: BookingRow, origin: string): FeedEntry {
  const period = utcToBookingPeriod(booking.start_at, booking.end_at)
  return {
    uid: `booking-${booking.id}@garten-floridsdorf.app`,
    summary: `Reservierung: ${booking.user_name}`,
    description: `Exklusive Reservierung des Grundstücks.\nVerrechnete Tage laut Statuten: ${booking.billed_days}`,
    location: null,
    url: `${origin}/intern/kalender`,
    dtstampUtc: booking.updated_at,
    startDate: period.start_date,
    startTime: period.start_time,
    endDate: period.end_date,
    endTime: period.end_time,
  }
}
