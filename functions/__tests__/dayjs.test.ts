import { afterEach, describe, expect, it, vi } from 'vitest'
import { nowUtc, toVienna } from '../_lib/dayjs'

describe('nowUtc', () => {
  afterEach(() => vi.useRealTimers())

  it('returns the current UTC ISO string at a fixed time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T10:00:00.000Z'))
    expect(nowUtc()).toBe('2026-06-15T10:00:00.000Z')
  })

  it('advances with the fake clock', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    vi.advanceTimersByTime(60_000)
    expect(nowUtc()).toBe('2026-01-01T00:01:00.000Z')
  })
})

describe('toVienna', () => {
  it('converts summer UTC time to UTC+2 (CEST)', () => {
    const result = toVienna('2026-06-15T10:00:00Z')
    expect(result.format('HH:mm')).toBe('12:00')
  })

  it('converts winter UTC time to UTC+1 (CET)', () => {
    const result = toVienna('2026-01-15T10:00:00Z')
    expect(result.format('HH:mm')).toBe('11:00')
  })

  it('preserves the date when no day boundary is crossed', () => {
    const result = toVienna('2026-06-15T22:30:00Z')
    expect(result.format('YYYY-MM-DD')).toBe('2026-06-16')
  })
})
