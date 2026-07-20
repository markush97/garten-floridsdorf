import { listCalendarNotificationRecipients } from '../db/queries/users'
import { dayjs, toVienna } from './dayjs'
import type { Database } from './db'
import { type EmailEnv, sendEmail } from './email'

/**
 * Opt-in e-mail notifications about calendar changes. The templates
 * are pure (unit-tested); `notifyCalendarChange` is designed to run
 * inside `c.executionCtx.waitUntil(...)` so the response never waits
 * for the fan-out, and a single bounce never kills the batch.
 */

export type CalendarChange = 'created' | 'rescheduled' | 'cancelled'
export type CalendarItemKind = 'termin' | 'event' | 'booking'

export type CalendarNotification = {
  change: CalendarChange
  kind: CalendarItemKind
  /** Termin/event title; for bookings the booker's name. */
  title: string
  /** Preformatted German period, see the format helpers below. */
  whenText: string
  actorName: string
}

const SUBJECT_PREFIX: Record<
  CalendarItemKind,
  Record<CalendarChange, string>
> = {
  termin: {
    created: 'Neuer Vereinstermin',
    rescheduled: 'Vereinstermin verschoben',
    cancelled: 'Vereinstermin abgesagt',
  },
  event: {
    created: 'Neuer Termin im Gartenkalender',
    rescheduled: 'Termin verschoben',
    cancelled: 'Termin abgesagt',
  },
  booking: {
    created: 'Neue Reservierung',
    rescheduled: 'Reservierung geändert',
    cancelled: 'Reservierung storniert',
  },
}

const ACTION_SENTENCE: Record<
  CalendarItemKind,
  Record<CalendarChange, string>
> = {
  termin: {
    created: 'hat einen neuen Vereinstermin eingetragen',
    rescheduled: 'hat einen Vereinstermin verschoben',
    cancelled: 'hat einen Vereinstermin abgesagt',
  },
  event: {
    created: 'hat einen neuen Termin im Gartenkalender eingetragen',
    rescheduled: 'hat einen Termin im Gartenkalender verschoben',
    cancelled: 'hat einen Termin im Gartenkalender abgesagt',
  },
  booking: {
    created: 'hat eine exklusive Reservierung eingetragen',
    rescheduled: 'hat eine exklusive Reservierung geändert',
    cancelled: 'hat eine exklusive Reservierung storniert',
  },
}

export function buildCalendarNotificationEmail(
  n: CalendarNotification,
  origin: string,
): { subject: string; text: string } {
  return {
    subject: `${SUBJECT_PREFIX[n.kind][n.change]}: ${n.title}`,
    text: [
      'Hallo!',
      '',
      `${n.actorName} ${ACTION_SENTENCE[n.kind][n.change]}:`,
      '',
      n.title,
      n.whenText,
      '',
      `Zum Kalender: ${origin}/intern/kalender`,
      '',
      'Du bekommst diese E-Mail, weil du Kalender-Benachrichtigungen aktiviert hast.',
      `Abschalten kannst du sie in deinem Profil: ${origin}/intern/profil`,
    ].join('\n'),
  }
}

/** 'Mo., 15. Juni 2026' or 'Mo., 15. Juni 2026, 15:00 Uhr'. */
export function formatTerminWhen(date: string, time: string | null): string {
  return formatDay(date) + (time ? `, ${time} Uhr` : '')
}

export function formatEventWhen(event: {
  start_date: string
  end_date: string | null
  start_time: string | null
  end_time: string | null
}): string {
  const endDate = event.end_date
  if (endDate === null || endDate === event.start_date) {
    if (!event.start_time) return formatDay(event.start_date)
    const times = event.end_time
      ? `${event.start_time}–${event.end_time}`
      : event.start_time
    return `${formatDay(event.start_date)}, ${times} Uhr`
  }
  const from =
    formatDay(event.start_date) +
    (event.start_time ? `, ${event.start_time} Uhr` : '')
  const to =
    formatDay(endDate) + (event.end_time ? `, ${event.end_time} Uhr` : '')
  return `${from} – ${to}`
}

export function formatBookingWhen(startAt: string, endAt: string): string {
  const format = 'dd., D. MMMM YYYY, HH:mm'
  return `${toVienna(startAt).format(format)} Uhr – ${toVienna(endAt).format(format)} Uhr`
}

/**
 * Sends the notification to every opted-in, activated user with an
 * e-mail address, excluding the acting user. Per-recipient errors
 * are logged and swallowed.
 */
export async function notifyCalendarChange(
  db: Database,
  env: EmailEnv,
  n: CalendarNotification,
  opts: { actorUserId: number | null; origin: string },
): Promise<void> {
  try {
    const recipients = await listCalendarNotificationRecipients(
      db,
      opts.actorUserId,
    )
    const { subject, text } = buildCalendarNotificationEmail(n, opts.origin)
    for (const recipient of recipients) {
      try {
        await sendEmail(env, recipient.email, subject, text)
      } catch (error) {
        console.error(
          `[calendar-notifications] mail to ${recipient.email} failed`,
          error,
        )
      }
    }
  } catch (error) {
    console.error('[calendar-notifications] fan-out failed', error)
  }
}

function formatDay(isoDate: string): string {
  // Parsed in UTC so the host timezone can't shift the calendar day.
  return dayjs.utc(isoDate).format('dd., D. MMMM YYYY')
}
