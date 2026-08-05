import { describe, expect, it } from 'vitest'
import {
  type BookingPeriod,
  bookingPeriodToUtc,
  computeBilledDays,
  utcToBookingPeriod,
  validateBookingPeriod,
} from './booking'

// Fixed "now": 2026-07-11 12:00 Vienna (CEST, UTC+2).
const NOW = '2026-07-11T10:00:00.000Z'

function period(
  start_date: string,
  start_time: string,
  end_date: string,
  end_time: string,
): BookingPeriod {
  return { start_date, start_time, end_date, end_time }
}

function expectBilled(p: BookingPeriod, billedDays: number, nights?: number) {
  const result = computeBilledDays(p)
  expect(result.billedDays).toBe(billedDays)
  if (nights !== undefined) expect(result.nights).toBe(nights)
  const validated = validateBookingPeriod(p, NOW)
  expect(validated.ok).toBe(true)
  if (validated.ok) expect(validated.billed_days).toBe(billedDays)
}

describe('computeBilledDays', () => {
  it('bills one day for one night with early checkout', () => {
    expectBilled(period('2026-08-01', '14:00', '2026-08-02', '09:00'), 1, 1)
  })

  it('adds a day when checkout is after 10:00', () => {
    expectBilled(period('2026-08-01', '14:00', '2026-08-02', '12:00'), 2, 1)
  })

  it('does not add a day when checkout is exactly 10:00', () => {
    expectBilled(period('2026-08-01', '14:00', '2026-08-02', '10:00'), 1, 1)
  })

  it('bills two days when the stay exceeds 24 hours', () => {
    // 25 hours, but checkout before 10:00 — duration rule wins.
    expectBilled(period('2026-08-01', '08:00', '2026-08-02', '09:00'), 2, 1)
  })

  it('bills one day for exactly 24 hours ending exactly at 10:00', () => {
    expectBilled(period('2026-08-01', '10:00', '2026-08-02', '10:00'), 1, 1)
  })

  it('bills one day for a same-day reservation', () => {
    expectBilled(period('2026-08-01', '14:00', '2026-08-01', '18:00'), 1, 0)
  })

  it('bills one day for a short morning slot ending before 10:00', () => {
    expectBilled(period('2026-08-01', '07:00', '2026-08-01', '09:00'), 1, 0)
  })

  it('bills nights plus late-checkout surcharge on longer stays', () => {
    // 3 nights, checkout 10:30 → 4 days.
    expectBilled(period('2026-08-01', '14:00', '2026-08-04', '10:30'), 4, 3)
  })

  it('counts real hours across the fall-back DST switch', () => {
    // Vienna leaves CEST on 2026-10-25 03:00: wall-clock 25 h is a
    // real 26 h → duration rule bills 2 days despite early checkout.
    expectBilled(period('2026-10-24', '08:00', '2026-10-25', '09:00'), 2, 1)
  })

  it('keeps the late-checkout rule across the fall-back switch', () => {
    // Real 23 h (extra DST hour), checkout 12:00 → 2 days.
    expectBilled(period('2026-10-24', '14:00', '2026-10-25', '12:00'), 2, 1)
  })

  it('measures instants, not wall clocks, across spring-forward', () => {
    // Vienna enters CEST on 2027-03-28 02:00: wall-clock 24 h is a
    // real 23 h, so the duration rule alone would bill 1 — the
    // late-checkout rule (14:00 > 10:00) still bills 2.
    const p = period('2027-03-27', '14:00', '2027-03-28', '14:00')
    expect(computeBilledDays(p).billedDays).toBe(2)
  })
})

describe('validateBookingPeriod', () => {
  it('accepts a same-day booking — an overnight stay is optional', () => {
    const result = validateBookingPeriod(
      period('2026-08-01', '14:00', '2026-08-01', '18:00'),
      NOW,
    )
    expect(result).toEqual({
      ok: true,
      nights: 0,
      billed_days: 1,
      start_at: '2026-08-01T12:00:00.000Z',
      end_at: '2026-08-01T16:00:00.000Z',
    })
  })

  it('rejects a zero-length period', () => {
    const result = validateBookingPeriod(
      period('2026-08-01', '14:00', '2026-08-01', '14:00'),
      NOW,
    )
    expect(result).toEqual({
      ok: false,
      message: 'Das Ende liegt vor dem Beginn.',
    })
  })

  it('rejects a reversed period', () => {
    const result = validateBookingPeriod(
      period('2026-08-02', '14:00', '2026-08-01', '10:00'),
      NOW,
    )
    expect(result).toEqual({
      ok: false,
      message: 'Das Ende liegt vor dem Beginn.',
    })
  })

  it('rejects starts fewer than 7 days ahead and accepts the boundary', () => {
    // Now is 2026-07-11 in Vienna → earliest start is 2026-07-18.
    const tooSoon = validateBookingPeriod(
      period('2026-07-17', '14:00', '2026-07-18', '09:00'),
      NOW,
    )
    expect(tooSoon.ok).toBe(false)
    if (!tooSoon.ok) expect(tooSoon.message).toContain('7 Tage im Voraus')

    const boundary = validateBookingPeriod(
      period('2026-07-18', '14:00', '2026-07-19', '09:00'),
      NOW,
    )
    expect(boundary.ok).toBe(true)
  })

  it('rejects rollover and malformed dates and times', () => {
    const invalid = [
      period('2026-02-31', '14:00', '2026-03-02', '09:00'),
      period('2026-08-01', '25:00', '2026-08-02', '09:00'),
      period('01.08.2026', '14:00', '2026-08-02', '09:00'),
      period('2026-08-01', '14:00', '2026-08-02', '9:00'),
    ]
    for (const p of invalid) {
      expect(validateBookingPeriod(p, NOW)).toEqual({
        ok: false,
        message: 'Bitte den Zeitraum vollständig und gültig angeben.',
      })
    }
  })

  it('returns normalized UTC instants on success', () => {
    const result = validateBookingPeriod(
      period('2026-08-01', '14:00', '2026-08-02', '10:00'),
      NOW,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      // CEST is UTC+2.
      expect(result.start_at).toBe('2026-08-01T12:00:00.000Z')
      expect(result.end_at).toBe('2026-08-02T08:00:00.000Z')
    }
  })
})

describe('bookingPeriodToUtc / utcToBookingPeriod', () => {
  it('converts summer and winter wall times to the right instants', () => {
    expect(
      bookingPeriodToUtc(period('2026-08-01', '14:00', '2026-08-02', '10:00')),
    ).toEqual({
      start_at: '2026-08-01T12:00:00.000Z',
      end_at: '2026-08-02T08:00:00.000Z',
    })
    // CET is UTC+1.
    expect(
      bookingPeriodToUtc(period('2026-12-01', '14:00', '2026-12-02', '10:00')),
    ).toEqual({
      start_at: '2026-12-01T13:00:00.000Z',
      end_at: '2026-12-02T09:00:00.000Z',
    })
  })

  it('round-trips periods in both DST regimes', () => {
    const summer = period('2026-08-01', '14:00', '2026-08-02', '10:00')
    const winter = period('2026-12-01', '14:00', '2026-12-02', '10:00')
    for (const p of [summer, winter]) {
      const { start_at, end_at } = bookingPeriodToUtc(p)
      expect(utcToBookingPeriod(start_at, end_at)).toEqual(p)
    }
  })
})
