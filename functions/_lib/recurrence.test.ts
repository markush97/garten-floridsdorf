import { describe, expect, it } from 'vitest'
import { advancePastToday, nextOccurrence } from './recurrence'

describe('nextOccurrence', () => {
  it('adds days, weeks and months', () => {
    expect(nextOccurrence('2026-07-21', 3, 'day')).toBe('2026-07-24')
    expect(nextOccurrence('2026-07-21', 2, 'week')).toBe('2026-08-04')
    expect(nextOccurrence('2026-07-21', 1, 'month')).toBe('2026-08-21')
  })

  it('clamps month steps to the end of a shorter month', () => {
    expect(nextOccurrence('2026-01-31', 1, 'month')).toBe('2026-02-28')
  })

  it('crosses a year boundary', () => {
    expect(nextOccurrence('2026-12-20', 3, 'week')).toBe('2027-01-10')
  })
})

describe('advancePastToday', () => {
  it('returns the first interval strictly after today', () => {
    // next date is today → one interval forward lands in the future
    expect(advancePastToday('2026-07-21', 1, 'week', '2026-07-21')).toBe(
      '2026-07-28',
    )
  })

  it('skips every interval already in the past (no back-fill flood)', () => {
    // A weekly series dormant for ~5 weeks jumps straight past today.
    const result = advancePastToday('2026-06-15', 1, 'week', '2026-07-21')
    expect(result > '2026-07-21').toBe(true)
    expect(result).toBe('2026-07-27')
  })
})
