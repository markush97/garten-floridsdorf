import { DEFAULT_TIMEZONE, dayjs, toVienna } from './dayjs'

/**
 * Billing and validation rules for exclusive property reservations
 * (Vereinsstatuten). Pure functions only — shared with the React
 * client via the `~func` alias so the booking dialog can preview the
 * exact day count the server will charge.
 *
 * Rules:
 *   - bookings must be made at least `BOOKING_MIN_LEAD_DAYS` days
 *     in advance (Vienna calendar days),
 *   - an overnight stay is optional: a reservation may end on the
 *     same Vienna calendar date it started on,
 *   - a day ends at 10:00 — checking out strictly after 10:00 adds
 *     one billed day,
 *   - a booking longer than 24 hours per billed day counts extra:
 *     billed = max(nights + lateCheckout, ceil(duration / 24 h)),
 *     so any period shorter than a day still bills one.
 */

/** Vienna wall-time period as entered by the user. */
export type BookingPeriod = {
  start_date: string // YYYY-MM-DD
  start_time: string // HH:mm
  end_date: string // YYYY-MM-DD
  end_time: string // HH:mm
}

export const BOOKING_MIN_LEAD_DAYS = 7

/** Checkout strictly after this Vienna wall time adds one billed day. */
export const BOOKING_LATE_CHECKOUT = '10:00'

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/
const TIME_SHAPE = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Converts a Vienna wall-time period into normalized ISO-UTC
 * instants (`.toISOString()`, fixed 24-char format) — the only
 * format ever written to `bookings.start_at` / `end_at`, which is
 * what keeps lexicographic SQL comparison a correct instant
 * comparison.
 */
export function bookingPeriodToUtc(p: BookingPeriod): {
  start_at: string
  end_at: string
} {
  return {
    start_at: viennaInstant(p.start_date, p.start_time).toISOString(),
    end_at: viennaInstant(p.end_date, p.end_time).toISOString(),
  }
}

/** Inverse of `bookingPeriodToUtc` — for display and PATCH merging. */
export function utcToBookingPeriod(
  startAt: string,
  endAt: string,
): BookingPeriod {
  const start = toVienna(startAt)
  const end = toVienna(endAt)
  return {
    start_date: start.format('YYYY-MM-DD'),
    start_time: start.format('HH:mm'),
    end_date: end.format('YYYY-MM-DD'),
    end_time: end.format('HH:mm'),
  }
}

/**
 * The billed-day count per the Vereinsstatuten. Nights are a pure
 * calendar-date difference (DST-proof) and may be zero for a
 * same-day reservation; the duration is measured between the real
 * Vienna instants so a wall-clock "24 hours" across a DST switch is
 * billed by its true length. Since the duration rule rounds up, any
 * period bills at least one day.
 */
export function computeBilledDays(p: BookingPeriod): {
  nights: number
  billedDays: number
} {
  const nights = dayjs.utc(p.end_date).diff(dayjs.utc(p.start_date), 'day')
  // Zero-padded HH:mm strings compare correctly lexicographically;
  // ending exactly at 10:00 does not add a day.
  const lateCheckout = p.end_time > BOOKING_LATE_CHECKOUT ? 1 : 0
  const durationMinutes = viennaInstant(p.end_date, p.end_time).diff(
    viennaInstant(p.start_date, p.start_time),
    'minute',
  )
  const byDuration = Math.ceil(durationMinutes / (24 * 60))
  return { nights, billedDays: Math.max(nights + lateCheckout, byDuration) }
}

export type BookingValidation =
  | {
      ok: true
      nights: number
      billed_days: number
      start_at: string
      end_at: string
    }
  | { ok: false; message: string }

/**
 * Validates a booking period against the Statuten rules. Returns
 * German messages ready for an `AppError` on the server or inline
 * display in the booking dialog. `nowUtcIso` is a parameter so the
 * lead-time rule is testable.
 */
export function validateBookingPeriod(
  p: BookingPeriod,
  nowUtcIso: string,
): BookingValidation {
  if (
    !isRealDate(p.start_date) ||
    !isRealDate(p.end_date) ||
    !TIME_SHAPE.test(p.start_time) ||
    !TIME_SHAPE.test(p.end_time)
  ) {
    return {
      ok: false,
      message: 'Bitte den Zeitraum vollständig und gültig angeben.',
    }
  }
  const start = viennaInstant(p.start_date, p.start_time)
  const end = viennaInstant(p.end_date, p.end_time)
  if (!end.isAfter(start)) {
    return { ok: false, message: 'Das Ende liegt vor dem Beginn.' }
  }
  const { nights, billedDays } = computeBilledDays(p)
  const minStartDate = toVienna(nowUtcIso)
    .startOf('day')
    .add(BOOKING_MIN_LEAD_DAYS, 'day')
    .format('YYYY-MM-DD')
  if (p.start_date < minStartDate) {
    return {
      ok: false,
      message: `Reservierungen müssen mindestens ${BOOKING_MIN_LEAD_DAYS} Tage im Voraus erfolgen.`,
    }
  }
  return {
    ok: true,
    nights,
    billed_days: billedDays,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
  }
}

/** A Vienna wall time as a real instant (dayjs with tz plugin). */
function viennaInstant(date: string, time: string) {
  return dayjs.tz(`${date} ${time}`, DEFAULT_TIMEZONE)
}

/**
 * Rejects both garbage strings and rollover dates (2026-02-31 parses
 * but formats back as 2026-03-03, failing the round-trip). Parsed in
 * UTC so the host timezone can't shift the day.
 */
function isRealDate(iso: string): boolean {
  if (!DATE_SHAPE.test(iso)) return false
  return dayjs.utc(iso).format('YYYY-MM-DD') === iso
}
