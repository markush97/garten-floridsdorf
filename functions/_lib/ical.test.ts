import { describe, expect, it } from 'vitest'
import type { EventWithDetails } from '../contracts/event'
import { buildEventIcal, ICAL_CONTENT_TYPE } from './ical'

function makeEvent(partial: Partial<EventWithDetails> = {}): EventWithDetails {
  return {
    id: 1,
    slug: 'garten-juni',
    poll_id: null,
    title: 'Gartentreffen Juni',
    scheduled_date: '2026-06-15',
    scheduled_time: '15:00',
    location: 'Vereinshaus',
    agenda: null,
    transcription: '',
    created_at: '2026-06-10T00:00:00.000Z',
    updated_at: '2026-06-10T00:00:00.000Z',
    planned_attendees: [],
    actual_attendees: [],
    attachments: [],
    decisions: [],
    tasks: [],
    agenda_items: [],
    ...partial,
  }
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}

/**
 * Unfolds an iCal document back to its logical form. Continuation
 * lines start with a single space and are concatenated to the
 * previous line. This lets us assert against whole property values
 * regardless of how the generator chose to fold them.
 */
function unfoldIcal(ical: string): string {
  return ical.split('\r\n').reduce<string>((acc, line) => {
    if (line.startsWith(' ')) return acc + line.slice(1)
    return acc + (acc === '' ? '' : '\n') + line
  }, '')
}

describe('buildEventIcal', () => {
  it('produces a self-contained VCALENDAR with one VEVENT', () => {
    const ical = buildEventIcal(makeEvent())
    // Unfold lines first so we can match logical properties without
    // false negatives on long, folded values.
    const logical = unfoldIcal(ical)
    expect(logical).toMatch(/^BEGIN:VCALENDAR/)
    expect(logical).toMatch(/^END:VCALENDAR$/m)
    expect(logical.match(/^BEGIN:VEVENT$/gm)?.length).toBe(1)
    expect(logical.match(/^END:VEVENT$/gm)?.length).toBe(1)
  })

  it('emits required calendar-level metadata', () => {
    const ical = buildEventIcal(makeEvent())
    const logical = unfoldIcal(ical)
    expect(logical).toContain('VERSION:2.0')
    expect(logical).toContain('PRODID:')
    expect(logical).toContain('CALSCALE:GREGORIAN')
    expect(logical).toContain('METHOD:PUBLISH')
    expect(logical).toContain('X-WR-TIMEZONE:Europe/Vienna')
  })

  it('uses a stable UID per event id', () => {
    const a = buildEventIcal(makeEvent({ id: 42 }))
    const b = buildEventIcal(makeEvent({ id: 42, title: 'Renamed' }))
    expect(a).toContain('UID:event-42@garten-floridsdorf.app')
    expect(b).toContain('UID:event-42@garten-floridsdorf.app')
  })

  it('uses a different UID for different event ids', () => {
    const a = buildEventIcal(makeEvent({ id: 1 }))
    const b = buildEventIcal(makeEvent({ id: 2 }))
    const uidA = a.match(/^UID:.+$/m)?.[0]
    const uidB = b.match(/^UID:.+$/m)?.[0]
    expect(uidA).not.toBe(uidB)
  })

  it('emits DTSTART;TZID=Europe/Vienna for a timed event', () => {
    const ical = buildEventIcal(
      makeEvent({ scheduled_date: '2026-06-15', scheduled_time: '15:00' }),
    )
    const logical = unfoldIcal(ical)
    expect(logical).toContain('DTSTART;TZID=Europe/Vienna:20260615T150000')
    // Default duration is 60 minutes.
    expect(logical).toContain('DTEND;TZID=Europe/Vienna:20260615T160000')
  })

  it('emits DTSTART;VALUE=DATE for an all-day event (no time)', () => {
    const ical = buildEventIcal(
      makeEvent({ scheduled_date: '2026-06-15', scheduled_time: null }),
    )
    const logical = unfoldIcal(ical)
    expect(logical).toContain('DTSTART;VALUE=DATE:20260615')
    // DTEND is exclusive, so it's the day after.
    expect(logical).toContain('DTEND;VALUE=DATE:20260616')
  })

  it('escapes semicolons, commas, and backslashes in the SUMMARY', () => {
    const ical = buildEventIcal(makeEvent({ title: 'Plan; A, B \\ C' }))
    const logical = unfoldIcal(ical)
    // Build the expected from individual escaped segments to avoid
    // the test source's escape ambiguity with German umlauts.
    const expected =
      'SUMMARY:Plan' +
      String.fromCharCode(92, 59) + // \;
      ' A' +
      String.fromCharCode(92, 44) + // \,
      ' B ' +
      String.fromCharCode(92, 92) + // \\
      ' C'
    expect(logical).toContain(expected)
  })

  it('escapes newlines in the DESCRIPTION as \\n', () => {
    const ical = buildEventIcal(makeEvent({ agenda: 'line1\nline2' }))
    const logical = unfoldIcal(ical)
    // The description value contains a literal "\n" (backslash-n) so
    // the property stays on a single logical line.
    expect(logical).toContain('\\n')
  })

  it('omits LOCATION when no location is set', () => {
    const ical = buildEventIcal(makeEvent({ location: null }))
    const logical = unfoldIcal(ical)
    expect(logical).not.toContain('LOCATION:')
  })

  it('omits LOCATION when location is whitespace only', () => {
    const ical = buildEventIcal(makeEvent({ location: '   ' }))
    const logical = unfoldIcal(ical)
    expect(logical).not.toContain('LOCATION:')
  })

  it('folds physical lines to at most 75 octets (continuations add 1 space)', () => {
    const longTitle = 'A'.repeat(200)
    const ical = buildEventIcal(makeEvent({ title: longTitle }))
    const lines = ical.split('\r\n')
    for (const line of lines) {
      const bytes = new TextEncoder().encode(line).length
      // A continuation line starts with a single space, so it can
      // be 76 octets total (75 content + 1 space). The first line
      // of a folded sequence must be ≤ 75.
      expect(
        bytes,
        `line longer than 76 octets: ${bytes}: ${line.slice(0, 30)}...`,
      ).toBeLessThanOrEqual(76)
    }
  })

  it('round-trips long property values through unfold (i.e. fold is correct)', () => {
    const longTitle = 'A'.repeat(200)
    const ical = buildEventIcal(makeEvent({ title: longTitle }))
    const logical = unfoldIcal(ical)
    // The SUMMARY property should be reconstructable in full.
    const summaryLine = logical
      .split(/\r?\n/)
      .find((l) => l.startsWith('SUMMARY:'))
    expect(summaryLine).toBe(`SUMMARY:${'A'.repeat(200)}`)
  })

  it('uses CRLF line endings', () => {
    const ical = buildEventIcal(makeEvent())
    // No bare LF outside of CRLF.
    const stripped = ical.replace(/\r\n/g, '')
    expect(stripped).not.toContain('\n')
  })

  it('emits a DTSTAMP in UTC ending with Z', () => {
    const ical = buildEventIcal(makeEvent())
    expect(ical).toMatch(/DTSTAMP:\d{8}T\d{6}Z/)
  })

  it('honours a custom prodId and calendar name', () => {
    const ical = buildEventIcal(makeEvent(), {
      prodId: '-//My Corp//Custom//EN',
      calendarName: 'Mein Kalender',
    })
    const logical = unfoldIcal(ical)
    expect(logical).toContain('PRODID:-//My Corp//Custom//EN')
    expect(logical).toContain('X-WR-CALNAME:Mein Kalender')
  })

  it('includes a URL pointing to the admin event detail', () => {
    const ical = buildEventIcal(makeEvent({ slug: 'foo-bar' }))
    const logical = unfoldIcal(ical)
    expect(logical).toContain('URL:/admin/events/foo-bar')
  })

  it('emits STATUS:CONFIRMED and TRANSP:OPAQUE', () => {
    const ical = buildEventIcal(makeEvent())
    const logical = unfoldIcal(ical)
    expect(logical).toContain('STATUS:CONFIRMED')
    expect(logical).toContain('TRANSP:OPAQUE')
  })

  it('includes the agenda in the description when present', () => {
    const ical = buildEventIcal(
      makeEvent({ agenda: 'Werkstatt open; Liste raus' }),
    )
    const logical = unfoldIcal(ical)
    expect(logical).toContain('Tagesordnung:')
    expect(logical).toContain('Werkstatt open\\; Liste raus')
  })

  it('truncates a very long agenda excerpt to keep the file portable', () => {
    const longAgenda = 'A'.repeat(500)
    const ical = buildEventIcal(makeEvent({ agenda: longAgenda }))
    const logical = unfoldIcal(ical)
    // 240 chars from the agenda, plus the prefix.
    const match = logical.match(/Tagesordnung: ([A]+)/)
    expect(match).not.toBeNull()
    const captured = match?.[1] ?? ''
    expect(captured.length).toBe(240)
  })
})

describe('ICAL_CONTENT_TYPE', () => {
  it('is the RFC 5545 media type with UTF-8 charset', () => {
    expect(ICAL_CONTENT_TYPE).toBe('text/calendar; charset=utf-8')
  })
})

describe('buildEventIcal end-to-end safety', () => {
  it('produces unique UIDs for distinct events in the same run', () => {
    const a = buildEventIcal(makeEvent({ id: 1 }))
    const b = buildEventIcal(makeEvent({ id: 2 }))
    const c = buildEventIcal(makeEvent({ id: 3 }))
    const uids = [a, b, c].map((s) => s.match(/^UID:.+$/m)?.[0])
    expect(uniq(uids).length).toBe(3)
  })
})
