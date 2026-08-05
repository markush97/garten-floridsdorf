import type { EventWithDetails } from '../../functions/contracts/event'
import { DEFAULT_TIMEZONE } from './dayjs'

/**
 * Generates an iCalendar (RFC 5545) document for a single event.
 *
 * The output is a `VCALENDAR` with one `VEVENT`. We use *floating*
 * local time (no UTC suffix and no Z suffix) for the DTSTART/DTEND
 * when the event has a `scheduled_time`, plus an `X-WR-TIMEZONE`
 * hint that most calendar clients (Apple, Google, Outlook) honour.
 * For all-day events (no time) we emit the `VALUE=DATE` form with
 * the day-after as DTEND, since iCal marks DTEND as exclusive for
 * all-day events.
 *
 * Reference: https://datatracker.ietf.org/doc/html/rfc5545
 */
export function buildEventIcal(
  event: EventWithDetails,
  options: { prodId?: string; calendarName?: string } = {},
): string {
  const prodId = options.prodId ?? '-//Bewegung im Grünen//Events//DE'
  const calendarName = options.calendarName ?? 'Bewegung im Grünen – Termine'
  const url = `/admin/events/${event.slug}`

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:' + prodId,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    `X-WR-TIMEZONE:${escapeText(DEFAULT_TIMEZONE)}`,
    'BEGIN:VEVENT',
    `UID:event-${event.id}@garten-floridsdorf.app`,
    `DTSTAMP:${formatUtcStamp(new Date())}`,
    ...formatDateTimePair(event.scheduled_date, event.scheduled_time),
    `SUMMARY:${escapeText(event.title)}`,
  ]

  if (event.location && event.location.trim()) {
    lines.push(`LOCATION:${escapeText(event.location)}`)
  }

  // Description: short summary. We use the admin URL + a short
  // agenda excerpt so the calendar entry is a useful starting
  // point even before the link is followed.
  const descriptionParts: string[] = [`Im Admin-Bereich öffnen: ${url}`]
  if (event.agenda && event.agenda.trim()) {
    const trimmed = event.agenda.trim().slice(0, 240)
    descriptionParts.push(`Tagesordnung: ${trimmed}`)
  }
  if (descriptionParts.length > 0) {
    lines.push(`DESCRIPTION:${escapeText(descriptionParts.join('\n'))}`)
  }

  lines.push(`URL:${url}`)
  lines.push('STATUS:CONFIRMED')
  lines.push('TRANSP:OPAQUE')
  lines.push('END:VEVENT')
  lines.push('END:VCALENDAR')

  // iCal requires CRLF line endings and 75-octet line folding.
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/**
 * One VEVENT of the personal calendar feed, in Vienna wall time.
 * `startTime = null` means all-day; for all-day entries `endDate` is
 * the *inclusive* last day (the builder emits the exclusive DTEND).
 */
export type FeedEntry = {
  uid: string
  summary: string
  description?: string | null
  location?: string | null
  url?: string | null
  /** ISO-UTC timestamp (typically the row's `updated_at`) — a stable
   * DTSTAMP keeps subscription clients from re-syncing unchanged
   * entries. */
  dtstampUtc: string
  startDate: string // YYYY-MM-DD
  startTime?: string | null // HH:mm
  endDate: string // YYYY-MM-DD
  endTime?: string | null // HH:mm; required when startTime is set
}

/**
 * Generates the multi-VEVENT iCalendar document for the personal
 * subscription feed. Same conventions as `buildEventIcal`: floating
 * Vienna wall times with `TZID`, `VALUE=DATE` with exclusive DTEND
 * for all-day entries, CRLF + 75-octet folding.
 */
export function buildCalendarFeed(
  entries: FeedEntry[],
  options: { prodId?: string; calendarName?: string } = {},
): string {
  const prodId = options.prodId ?? '-//Bewegung im Grünen//Kalender//DE'
  const calendarName = options.calendarName ?? 'Garten Floridsdorf'

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    `X-WR-TIMEZONE:${escapeText(DEFAULT_TIMEZONE)}`,
  ]
  for (const entry of entries) {
    lines.push(...formatVeventLines(entry))
  }
  lines.push('END:VCALENDAR')

  return `${lines.map(foldLine).join('\r\n')}\r\n`
}

function formatVeventLines(entry: FeedEntry): string[] {
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${escapeText(entry.uid)}`,
    `DTSTAMP:${formatUtcStamp(new Date(entry.dtstampUtc))}`,
  ]

  const startCompact = entry.startDate.replace(/-/g, '')
  if (entry.startTime) {
    const endTime = entry.endTime ?? addMinutes(entry.startTime, 60)
    const endCompact = entry.endDate.replace(/-/g, '')
    lines.push(
      `DTSTART;TZID=${DEFAULT_TIMEZONE}:${startCompact}T${entry.startTime.replace(':', '')}00`,
      `DTEND;TZID=${DEFAULT_TIMEZONE}:${endCompact}T${endTime.replace(':', '')}00`,
    )
  } else {
    // All-day: DTEND is exclusive, so we add one day past the
    // inclusive last day.
    lines.push(
      `DTSTART;VALUE=DATE:${startCompact}`,
      `DTEND;VALUE=DATE:${addDays(entry.endDate, 1).replace(/-/g, '')}`,
    )
  }

  lines.push(`SUMMARY:${escapeText(entry.summary)}`)
  if (entry.location?.trim()) {
    lines.push(`LOCATION:${escapeText(entry.location)}`)
  }
  if (entry.description?.trim()) {
    lines.push(`DESCRIPTION:${escapeText(entry.description)}`)
  }
  if (entry.url) {
    lines.push(`URL:${escapeText(entry.url)}`)
  }
  lines.push('STATUS:CONFIRMED')
  lines.push('TRANSP:OPAQUE')
  lines.push('END:VEVENT')
  return lines
}

/**
 * Escapes a text value per RFC 5545 §3.3.11: backslash, semicolon,
 * comma, and newlines. The escape order matters — backslashes
 * first, then the others.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

/**
 * Folds a single iCal content line to 75 octets per RFC 5545 §3.1.
 * Continuation lines start with a single space. We measure by
 * octet length (UTF-8 byte count) so a line of "ä" doesn't get
 * truncated mid-codepoint.
 */
function foldLine(line: string): string {
  // The line is already a single logical line; if it fits in 75
  // octets (after our escape pass) we just return it.
  if (utf8ByteLength(line) <= 75) return line
  // Otherwise split into 75-octet chunks, prefixing continuations
  // with a single space.
  const out: string[] = []
  let buf = ''
  for (const ch of line) {
    const next = buf + ch
    if (utf8ByteLength(next) > 75) {
      out.push(buf)
      buf = ch
    } else {
      buf = next
    }
  }
  if (buf) out.push(buf)
  return out.map((chunk, idx) => (idx === 0 ? chunk : ` ${chunk}`)).join('\r\n')
}

/**
 * Cross-platform UTF-8 byte length. `TextEncoder` is available in
 * the browser, Cloudflare Workers, and Node 18+; falling back to a
 * manual encode keeps the function self-contained if the runtime
 * ever lacks it.
 */
function utf8ByteLength(s: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(s).length
  }
  // Manual fallback: count bytes after encoding.
  let bytes = 0
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff) {
      // High surrogate — pair with the following low surrogate.
      bytes += 4
      i++
    } else bytes += 3
  }
  return bytes
}

/**
 * Formats a Date as the iCal UTC timestamp `YYYYMMDDTHHMMSSZ`. We
 * always emit in UTC so the calendar app can convert to its own
 * timezone.
 */
function formatUtcStamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  )
}

/**
 * Returns the DTSTART and DTEND lines for a scheduled event. The
 * event's `scheduled_date` is a YYYY-MM-DD string; the optional
 * `scheduled_time` is HH:mm. We default to a 1-hour duration when
 * the time is present (the schema doesn't capture an end time yet)
 * and to a single all-day event otherwise.
 */
function formatDateTimePair(
  scheduledDate: string,
  scheduledTime: string | null,
): string[] {
  // Normalise the date to YYYYMMDD.
  const dateCompact = scheduledDate.replace(/-/g, '')
  if (scheduledTime) {
    // Floating local time: `DTSTART:YYYYMMDDTHHMMSS`. The
    // `X-WR-TIMEZONE` block in the calendar header tells clients
    // which zone to interpret this in. We default the duration
    // to 60 minutes — long enough to be useful, short enough to
    // not block the whole day.
    const timeCompact = scheduledTime.replace(':', '') + '00'
    return [
      `DTSTART;TZID=${DEFAULT_TIMEZONE}:${dateCompact}T${timeCompact}`,
      `DTEND;TZID=${DEFAULT_TIMEZONE}:${dateCompact}T${addMinutes(
        scheduledTime,
        60,
      ).replace(':', '')}00`,
    ]
  }
  // All-day: DTEND is exclusive, so we add one day.
  return [
    `DTSTART;VALUE=DATE:${dateCompact}`,
    `DTEND;VALUE=DATE:${addDays(scheduledDate, 1).replace(/-/g, '')}`,
  ]
}

/**
 * Adds `minutes` to an HH:mm string, returning a new HH:mm string.
 * Wraps past midnight (e.g. 23:30 + 60 = 00:30 on the next day,
 * but the day is not tracked here; calendar apps accept this for
 * short events).
 */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  if (
    h === undefined ||
    m === undefined ||
    Number.isNaN(h) ||
    Number.isNaN(m)
  ) {
    return time
  }
  const total = h * 60 + m + minutes
  const wrappedH = Math.floor(total / 60) % 24
  const wrappedM = total % 60
  return `${wrappedH.toString().padStart(2, '0')}:${wrappedM
    .toString()
    .padStart(2, '0')}`
}

/**
 * Adds `days` to a YYYY-MM-DD string, returning a new YYYY-MM-DD
 * string. Uses the Date API in UTC to avoid local-tz off-by-ones.
 */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (
    y === undefined ||
    m === undefined ||
    d === undefined ||
    Number.isNaN(y) ||
    Number.isNaN(m) ||
    Number.isNaN(d)
  ) {
    return iso
  }
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return (
    date.getUTCFullYear() +
    '-' +
    pad(date.getUTCMonth() + 1) +
    '-' +
    pad(date.getUTCDate())
  )
}

/**
 * Builds a Content-Type for the iCal response. We deliberately
 * include the charset so calendar apps parse the file as UTF-8.
 */
export const ICAL_CONTENT_TYPE = 'text/calendar; charset=utf-8'
