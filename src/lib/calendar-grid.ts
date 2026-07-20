import { dayjs } from '~/lib/timezone'
import type { CalendarEntry } from '~func/contracts/calendar'

/**
 * Pure date math for the member calendar: Monday-first month grids,
 * entry → segment normalization, and greedy lane packing for
 * multi-day bars. Everything works on plain YYYY-MM-DD strings
 * (parsed in UTC so the host timezone can't shift a day); "today" is
 * a parameter so the functions stay testable.
 */

export type GridCell = {
  iso: string // YYYY-MM-DD
  dayOfMonth: number
  inMonth: boolean
  isToday: boolean
}

export type CalendarSegment = {
  key: string // `${kind}-${id}`
  kind: CalendarEntry['kind']
  title: string
  timeLabel: string | null
  startDay: string // inclusive YYYY-MM-DD
  endDay: string // inclusive YYYY-MM-DD
  multiDay: boolean
  entry: CalendarEntry
}

export type SegmentPlacement = {
  segment: CalendarSegment
  /** 0-based columns within the week, both inclusive. */
  colStart: number
  colEnd: number
  lane: number
  startsInWeek: boolean
  endsInWeek: boolean
}

/** Monday-first index: Mo = 0 … So = 6. */
function mondayIndex(day: typeof dayjs.prototype): number {
  return (day.day() + 6) % 7
}

function diffDays(fromIso: string, toIso: string): number {
  return dayjs.utc(toIso).diff(dayjs.utc(fromIso), 'day')
}

export function addDaysIso(iso: string, days: number): string {
  return dayjs.utc(iso).add(days, 'day').format('YYYY-MM-DD')
}

/**
 * The padded date range shown for a month: from the Monday on or
 * before the 1st to the Sunday on or after the last day. Also the
 * range the calendar query fetches, so bars from adjacent months
 * render naturally into the muted padding cells.
 */
export function gridRange(monat: string): { from: string; to: string } {
  const first = dayjs.utc(`${monat}-01`)
  const last = first.endOf('month')
  const from = first.subtract(mondayIndex(first), 'day')
  const to = last.add(6 - mondayIndex(last), 'day')
  return { from: from.format('YYYY-MM-DD'), to: to.format('YYYY-MM-DD') }
}

/** The grid as rows of 7 real dates (no null padding). */
export function buildMonthGrid(monat: string, todayIso: string): GridCell[][] {
  const { from, to } = gridRange(monat)
  const totalDays = diffDays(from, to) + 1
  const weeks: GridCell[][] = []
  for (let offset = 0; offset < totalDays; offset++) {
    const day = dayjs.utc(from).add(offset, 'day')
    const iso = day.format('YYYY-MM-DD')
    if (offset % 7 === 0) weeks.push([])
    weeks[weeks.length - 1]?.push({
      iso,
      dayOfMonth: day.date(),
      inMonth: iso.slice(0, 7) === monat,
      isToday: iso === todayIso,
    })
  }
  return weeks
}

/**
 * Normalizes the three entry kinds onto inclusive day spans. Booking
 * wall times come from the server (already Vienna); a booking ending
 * exactly at midnight does not paint the following day.
 */
export function toSegments(entries: CalendarEntry[]): CalendarSegment[] {
  return entries.map((entry) => {
    switch (entry.kind) {
      case 'termin':
        return {
          key: `termin-${entry.id}`,
          kind: entry.kind,
          title: entry.title,
          timeLabel: entry.time,
          startDay: entry.date,
          endDay: entry.date,
          multiDay: false,
          entry,
        }
      case 'event': {
        const endDay = entry.end_date ?? entry.start_date
        const multiDay = endDay !== entry.start_date
        const timeLabel = entry.start_time
          ? !multiDay && entry.end_time
            ? `${entry.start_time}–${entry.end_time}`
            : entry.start_time
          : null
        return {
          key: `event-${entry.id}`,
          kind: entry.kind,
          title: entry.title,
          timeLabel,
          startDay: entry.start_date,
          endDay,
          multiDay,
          entry,
        }
      }
      default: {
        const endDay =
          entry.end_time === '00:00' && entry.end_date !== entry.start_date
            ? addDaysIso(entry.end_date, -1)
            : entry.end_date
        return {
          key: `booking-${entry.id}`,
          kind: entry.kind,
          title: entry.user_name,
          timeLabel: entry.start_time,
          startDay: entry.start_date,
          endDay,
          multiDay: endDay !== entry.start_date,
          entry,
        }
      }
    }
  })
}

/** Segments covering a single day, spanning bars first, then by time. */
export function segmentsOnDay(
  segments: CalendarSegment[],
  iso: string,
): CalendarSegment[] {
  return segments
    .filter((s) => s.startDay <= iso && iso <= s.endDay)
    .sort((a, b) => {
      if (a.multiDay !== b.multiDay) return a.multiDay ? -1 : 1
      return (a.timeLabel ?? '').localeCompare(b.timeLabel ?? '')
    })
}

/**
 * Greedy lane packing for one week row: longer bars first so they
 * claim the upper lanes, each segment takes the first lane that is
 * free from its start column on.
 */
export function placeSegments(
  segments: CalendarSegment[],
  week: GridCell[],
): SegmentPlacement[] {
  const weekStart = week[0]?.iso
  const weekEnd = week[week.length - 1]?.iso
  if (!weekStart || !weekEnd) return []

  const inWeek = segments
    .filter((s) => s.startDay <= weekEnd && s.endDay >= weekStart)
    .sort((a, b) => {
      if (a.startDay !== b.startDay) return a.startDay < b.startDay ? -1 : 1
      const spanA = diffDays(a.startDay, a.endDay)
      const spanB = diffDays(b.startDay, b.endDay)
      if (spanA !== spanB) return spanB - spanA
      return (a.timeLabel ?? '').localeCompare(b.timeLabel ?? '')
    })

  // laneEnds[lane] = last occupied column in that lane.
  const laneEnds: number[] = []
  return inWeek.map((segment) => {
    const colStart = Math.max(0, diffDays(weekStart, segment.startDay))
    const colEnd = Math.min(6, diffDays(weekStart, segment.endDay))
    let lane = laneEnds.findIndex((end) => end < colStart)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(colEnd)
    } else {
      laneEnds[lane] = colEnd
    }
    return {
      segment,
      colStart,
      colEnd,
      lane,
      startsInWeek: segment.startDay >= weekStart,
      endsInWeek: segment.endDay <= weekEnd,
    }
  })
}
