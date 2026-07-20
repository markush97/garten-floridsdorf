import { describe, expect, it } from 'vitest'
import type { BookingRow, CalendarEventRow } from '../db/schema'
import { type FeedTermin, feedEntriesFromCalendar } from './calendar-feed'
import { buildCalendarFeed } from './ical'

const ORIGIN = 'https://garten-floridsdorf.at'

function makeTermin(partial: Partial<FeedTermin> = {}): FeedTermin {
  return {
    id: 7,
    slug: 'gartentreffen-juni',
    title: 'Gartentreffen Juni',
    scheduled_date: '2026-06-15',
    scheduled_time: '15:00',
    location: 'Vereinshaus',
    updated_at: '2026-06-01T08:30:00.000Z',
    ...partial,
  }
}

function makeEvent(partial: Partial<CalendarEventRow> = {}): CalendarEventRow {
  return {
    id: 3,
    title: 'Gießdienst Übergabe',
    description: null,
    location: null,
    start_date: '2026-08-01',
    end_date: null,
    start_time: null,
    end_time: null,
    created_by_user_id: 2,
    created_by_name: 'Maria Muster',
    created_at: '2026-07-01T10:00:00.000Z',
    updated_at: '2026-07-02T10:00:00.000Z',
    ...partial,
  }
}

function makeBooking(partial: Partial<BookingRow> = {}): BookingRow {
  return {
    id: 5,
    user_id: 2,
    user_name: 'Maria Muster',
    start_at: '2026-08-01T12:00:00.000Z', // 14:00 Vienna (CEST)
    end_at: '2026-08-02T08:00:00.000Z', // 10:00 Vienna
    billed_days: 1,
    note: null,
    status: 'confirmed',
    cancelled_at: null,
    created_at: '2026-07-10T10:00:00.000Z',
    updated_at: '2026-07-10T10:00:00.000Z',
    ...partial,
  }
}

function unfoldIcal(ical: string): string {
  return ical.split('\r\n').reduce<string>((acc, line) => {
    if (line.startsWith(' ')) return acc + line.slice(1)
    return acc + (acc === '' ? '' : '\n') + line
  }, '')
}

function buildLogicalFeed(
  data: Parameters<typeof feedEntriesFromCalendar>[0],
): string {
  return unfoldIcal(buildCalendarFeed(feedEntriesFromCalendar(data, ORIGIN)))
}

describe('feedEntriesFromCalendar + buildCalendarFeed', () => {
  it('emits one VEVENT per entry across all three kinds', () => {
    const logical = buildLogicalFeed({
      termine: [makeTermin()],
      events: [makeEvent()],
      bookings: [makeBooking()],
    })
    expect(logical.match(/^BEGIN:VEVENT$/gm)?.length).toBe(3)
    expect(logical.match(/^END:VEVENT$/gm)?.length).toBe(3)
    expect(logical).toMatch(/^BEGIN:VCALENDAR/)
    expect(logical).toMatch(/^END:VCALENDAR$/m)
  })

  it('uses stable per-kind UIDs, matching the single-event export for Termine', () => {
    const logical = buildLogicalFeed({
      termine: [makeTermin({ id: 7 })],
      events: [makeEvent({ id: 3 })],
      bookings: [makeBooking({ id: 5 })],
    })
    expect(logical).toContain('UID:event-7@garten-floridsdorf.app')
    expect(logical).toContain('UID:calendar-event-3@garten-floridsdorf.app')
    expect(logical).toContain('UID:booking-5@garten-floridsdorf.app')
  })

  it('keeps the 60-minute default duration for timed Termine', () => {
    const logical = buildLogicalFeed({
      termine: [
        makeTermin({ scheduled_date: '2026-06-15', scheduled_time: '15:00' }),
      ],
      events: [],
      bookings: [],
    })
    expect(logical).toContain('DTSTART;TZID=Europe/Vienna:20260615T150000')
    expect(logical).toContain('DTEND;TZID=Europe/Vienna:20260615T160000')
  })

  it('renders a date-only Termin as a single all-day VEVENT', () => {
    const logical = buildLogicalFeed({
      termine: [makeTermin({ scheduled_time: null })],
      events: [],
      bookings: [],
    })
    expect(logical).toContain('DTSTART;VALUE=DATE:20260615')
    expect(logical).toContain('DTEND;VALUE=DATE:20260616')
  })

  it('renders multi-day all-day events with an exclusive DTEND', () => {
    const logical = buildLogicalFeed({
      termine: [],
      events: [makeEvent({ start_date: '2026-08-01', end_date: '2026-08-03' })],
      bookings: [],
    })
    expect(logical).toContain('DTSTART;VALUE=DATE:20260801')
    expect(logical).toContain('DTEND;VALUE=DATE:20260804')
  })

  it('renders bookings with Vienna wall times derived from the UTC instants', () => {
    const logical = buildLogicalFeed({
      termine: [],
      events: [],
      bookings: [makeBooking()],
    })
    expect(logical).toContain('SUMMARY:Reservierung: Maria Muster')
    expect(logical).toContain('DTSTART;TZID=Europe/Vienna:20260801T140000')
    expect(logical).toContain('DTEND;TZID=Europe/Vienna:20260802T100000')
    expect(logical).toContain('Verrechnete Tage laut Statuten: 1')
  })

  it('takes DTSTAMP from the row updated_at, not the wall clock', () => {
    const logical = buildLogicalFeed({
      termine: [],
      events: [makeEvent({ updated_at: '2026-07-02T10:00:00.000Z' })],
      bookings: [],
    })
    expect(logical).toContain('DTSTAMP:20260702T100000Z')
  })

  it('escapes and folds long umlaut titles without breaking properties', () => {
    const title =
      'Größeres Gartenfest mit Musik, Grillerei; außerdem Flohmarkt für Vereinsmitglieder und Gäste über beide Tage'
    const raw = buildCalendarFeed(
      feedEntriesFromCalendar(
        { termine: [makeTermin({ title })], events: [], bookings: [] },
        ORIGIN,
      ),
    )
    for (const line of raw.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(76)
    }
    const logical = unfoldIcal(raw)
    expect(logical).toContain(
      'SUMMARY:Größeres Gartenfest mit Musik\\, Grillerei\\; außerdem Flohmarkt',
    )
  })

  it('links each kind back into the app', () => {
    const logical = buildLogicalFeed({
      termine: [makeTermin({ slug: 'gartentreffen-juni' })],
      events: [makeEvent()],
      bookings: [makeBooking()],
    })
    expect(logical).toContain(`URL:${ORIGIN}/intern/termine/gartentreffen-juni`)
    expect(logical).toContain(`URL:${ORIGIN}/intern/kalender`)
  })
})
