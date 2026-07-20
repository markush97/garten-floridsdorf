import { describe, expect, it } from 'vitest'
import type { CalendarEntry } from '~func/contracts/calendar'
import {
  buildMonthGrid,
  gridRange,
  placeSegments,
  segmentsOnDay,
  toSegments,
} from '../calendar-grid'

function terminEntry(id: number, date: string, time: string | null = null) {
  return {
    kind: 'termin',
    id,
    slug: `termin-${id}`,
    title: `Termin ${id}`,
    date,
    time,
    location: null,
  } satisfies CalendarEntry
}

function eventEntry(
  id: number,
  start: string,
  end: string | null = null,
  times: { start?: string | null; end?: string | null } = {},
) {
  return {
    kind: 'event',
    id,
    title: `Event ${id}`,
    description: null,
    location: null,
    start_date: start,
    end_date: end,
    start_time: times.start ?? null,
    end_time: times.end ?? null,
    created_by_user_id: 1,
    created_by_name: 'Maria',
    created_at: '2026-07-01T10:00:00.000Z',
    updated_at: '2026-07-01T10:00:00.000Z',
  } satisfies CalendarEntry
}

function bookingEntry(
  id: number,
  period: {
    start_date: string
    start_time: string
    end_date: string
    end_time: string
  },
) {
  return {
    kind: 'booking',
    id,
    user_id: 2,
    user_name: `Gast ${id}`,
    start_at: '2026-08-01T12:00:00.000Z',
    end_at: '2026-08-02T08:00:00.000Z',
    ...period,
    billed_days: 1,
    note: null,
    created_at: '2026-07-01T10:00:00.000Z',
    updated_at: '2026-07-01T10:00:00.000Z',
  } satisfies CalendarEntry
}

describe('gridRange / buildMonthGrid', () => {
  it('pads to full Monday-first weeks', () => {
    // June 2026 starts on a Monday and ends on a Tuesday.
    expect(gridRange('2026-06')).toEqual({
      from: '2026-06-01',
      to: '2026-07-05',
    })
    // November 2026 starts on a Sunday and ends on a Monday.
    expect(gridRange('2026-11')).toEqual({
      from: '2026-10-26',
      to: '2026-12-06',
    })
  })

  it('handles a leap-year February', () => {
    // February 2028: Feb 1 is a Tuesday, Feb 29 a Tuesday.
    expect(gridRange('2028-02')).toEqual({
      from: '2028-01-31',
      to: '2028-03-05',
    })
    const weeks = buildMonthGrid('2028-02', '2028-02-15')
    expect(weeks).toHaveLength(5)
    expect(weeks.every((week) => week.length === 7)).toBe(true)
  })

  it('marks in-month cells and today', () => {
    const weeks = buildMonthGrid('2026-11', '2026-11-03')
    const flat = weeks.flat()
    expect(flat[0]).toMatchObject({ iso: '2026-10-26', inMonth: false })
    const today = flat.find((cell) => cell.isToday)
    expect(today?.iso).toBe('2026-11-03')
    expect(flat.filter((cell) => cell.inMonth)).toHaveLength(30)
  })
})

describe('toSegments', () => {
  it('maps all three kinds onto inclusive day spans', () => {
    const segments = toSegments([
      terminEntry(1, '2026-08-05', '15:00'),
      eventEntry(2, '2026-08-01', '2026-08-03'),
      bookingEntry(3, {
        start_date: '2026-08-07',
        start_time: '14:00',
        end_date: '2026-08-09',
        end_time: '10:00',
      }),
    ])
    expect(segments[0]).toMatchObject({
      key: 'termin-1',
      startDay: '2026-08-05',
      endDay: '2026-08-05',
      multiDay: false,
      timeLabel: '15:00',
    })
    expect(segments[1]).toMatchObject({
      key: 'event-2',
      startDay: '2026-08-01',
      endDay: '2026-08-03',
      multiDay: true,
    })
    expect(segments[2]).toMatchObject({
      key: 'booking-3',
      title: 'Gast 3',
      startDay: '2026-08-07',
      endDay: '2026-08-09',
      multiDay: true,
    })
  })

  it('does not paint the next day for a booking ending at midnight', () => {
    const [segment] = toSegments([
      bookingEntry(4, {
        start_date: '2026-08-07',
        start_time: '14:00',
        end_date: '2026-08-09',
        end_time: '00:00',
      }),
    ])
    expect(segment?.endDay).toBe('2026-08-08')
  })

  it('shows a time range only for single-day timed events', () => {
    const [singleDay, multiDay] = toSegments([
      eventEntry(5, '2026-08-01', null, { start: '15:00', end: '17:00' }),
      eventEntry(6, '2026-08-01', '2026-08-02', {
        start: '15:00',
        end: '17:00',
      }),
    ])
    expect(singleDay?.timeLabel).toBe('15:00–17:00')
    expect(multiDay?.timeLabel).toBe('15:00')
  })
})

describe('placeSegments', () => {
  const week = buildMonthGrid('2026-08', '2026-08-15')[1]
  if (!week) throw new Error('expected a week')
  // Week 2 of August 2026: Mon 03.08. – Sun 09.08.

  it('clamps bars to the week and reports continuation', () => {
    const segments = toSegments([
      eventEntry(1, '2026-08-01', '2026-08-04'),
      terminEntry(2, '2026-08-05'),
    ])
    const placements = placeSegments(segments, week)
    expect(placements[0]).toMatchObject({
      colStart: 0,
      colEnd: 1,
      lane: 0,
      startsInWeek: false,
      endsInWeek: true,
    })
    expect(placements[1]).toMatchObject({ colStart: 2, colEnd: 2, lane: 0 })
  })

  it('stacks overlapping segments into separate lanes and reuses free ones', () => {
    const segments = toSegments([
      eventEntry(1, '2026-08-03', '2026-08-06'),
      eventEntry(2, '2026-08-04', '2026-08-05'),
      terminEntry(3, '2026-08-04'),
      terminEntry(4, '2026-08-08'),
    ])
    const placements = placeSegments(segments, week)
    const byKey = Object.fromEntries(
      placements.map((p) => [p.segment.key, p.lane]),
    )
    expect(byKey['event-1']).toBe(0)
    expect(byKey['event-2']).toBe(1)
    expect(byKey['termin-3']).toBe(2)
    // Column 5 is free again — the single termin drops back to lane 0.
    expect(byKey['termin-4']).toBe(0)
  })
})

describe('segmentsOnDay', () => {
  it('filters by coverage and sorts spanning bars first', () => {
    const segments = toSegments([
      terminEntry(1, '2026-08-04', '18:00'),
      terminEntry(2, '2026-08-04', '09:00'),
      eventEntry(3, '2026-08-03', '2026-08-05'),
      terminEntry(4, '2026-08-06'),
    ])
    const onDay = segmentsOnDay(segments, '2026-08-04')
    expect(onDay.map((s) => s.key)).toEqual(['event-3', 'termin-2', 'termin-1'])
  })
})
