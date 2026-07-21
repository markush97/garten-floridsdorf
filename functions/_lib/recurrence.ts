import type { TaskIntervalUnit } from '../contracts/task'
import { DEFAULT_TIMEZONE, dayjs } from './dayjs'

/**
 * Advances a Vienna wall date (YYYY-MM-DD) by `count` × `unit`, returning the
 * next occurrence date in the same format. Month steps clamp to the end of a
 * shorter target month (dayjs behaviour), e.g. Jan 31 + 1 month → Feb 28/29.
 */
export function nextOccurrence(
  date: string,
  count: number,
  unit: TaskIntervalUnit,
): string {
  return dayjs.tz(date, DEFAULT_TIMEZONE).add(count, unit).format('YYYY-MM-DD')
}

/**
 * The date a due series should spawn next, skipping every interval that is
 * already in the past so a series that lay dormant does not flood the board
 * with back-dated occurrences. Given the current `next` date (which is
 * `<= today`), returns the first interval date strictly after `today`.
 */
export function advancePastToday(
  next: string,
  count: number,
  unit: TaskIntervalUnit,
  today: string,
): string {
  let candidate = nextOccurrence(next, count, unit)
  while (candidate <= today) {
    candidate = nextOccurrence(candidate, count, unit)
  }
  return candidate
}
