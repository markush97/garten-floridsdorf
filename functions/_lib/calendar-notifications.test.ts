import { describe, expect, it } from 'vitest'
import {
  buildCalendarNotificationEmail,
  formatBookingWhen,
  formatEventWhen,
  formatTerminWhen,
} from './calendar-notifications'

const ORIGIN = 'https://garten-floridsdorf.at'

describe('buildCalendarNotificationEmail', () => {
  it('builds German subjects for every kind and change', () => {
    const cases: [
      Parameters<typeof buildCalendarNotificationEmail>[0],
      string,
    ][] = [
      [
        {
          change: 'created',
          kind: 'termin',
          title: 'Gartentreffen',
          whenText: 'Mo., 15. Juni 2026, 15:00 Uhr',
          actorName: 'Admin',
        },
        'Neuer Vereinstermin: Gartentreffen',
      ],
      [
        {
          change: 'rescheduled',
          kind: 'event',
          title: 'Gießdienst',
          whenText: 'Di., 16. Juni 2026',
          actorName: 'Maria Muster',
        },
        'Termin verschoben: Gießdienst',
      ],
      [
        {
          change: 'cancelled',
          kind: 'booking',
          title: 'Maria Muster',
          whenText:
            'Sa., 1. August 2026, 14:00 Uhr – So., 2. August 2026, 10:00 Uhr',
          actorName: 'Maria Muster',
        },
        'Reservierung storniert: Maria Muster',
      ],
    ]
    for (const [notification, subject] of cases) {
      expect(buildCalendarNotificationEmail(notification, ORIGIN).subject).toBe(
        subject,
      )
    }
  })

  it('includes actor, period, calendar link, and opt-out hint in the body', () => {
    const { text } = buildCalendarNotificationEmail(
      {
        change: 'created',
        kind: 'event',
        title: 'Gießdienst Übergabe',
        whenText: 'Di., 16. Juni 2026, 15:00–17:00 Uhr',
        actorName: 'Maria Muster',
      },
      ORIGIN,
    )
    expect(text).toContain(
      'Maria Muster hat einen neuen Termin im Gartenkalender eingetragen:',
    )
    expect(text).toContain('Gießdienst Übergabe')
    expect(text).toContain('Di., 16. Juni 2026, 15:00–17:00 Uhr')
    expect(text).toContain(`Zum Kalender: ${ORIGIN}/intern/kalender`)
    expect(text).toContain(`in deinem Profil: ${ORIGIN}/intern/profil`)
  })
})

describe('period formatters', () => {
  it('formats Termine with and without a time', () => {
    expect(formatTerminWhen('2026-06-15', '15:00')).toBe(
      'Mo., 15. Juni 2026, 15:00 Uhr',
    )
    expect(formatTerminWhen('2026-06-15', null)).toBe('Mo., 15. Juni 2026')
  })

  it('formats single-day and multi-day member events', () => {
    expect(
      formatEventWhen({
        start_date: '2026-06-16',
        end_date: null,
        start_time: '15:00',
        end_time: '17:00',
      }),
    ).toBe('Di., 16. Juni 2026, 15:00–17:00 Uhr')
    expect(
      formatEventWhen({
        start_date: '2026-06-16',
        end_date: '2026-06-18',
        start_time: null,
        end_time: null,
      }),
    ).toBe('Di., 16. Juni 2026 – Do., 18. Juni 2026')
  })

  it('formats booking periods in Vienna wall time', () => {
    expect(
      formatBookingWhen('2026-08-01T12:00:00.000Z', '2026-08-02T08:00:00.000Z'),
    ).toBe('Sa., 1. August 2026, 14:00 Uhr – So., 2. August 2026, 10:00 Uhr')
  })
})
