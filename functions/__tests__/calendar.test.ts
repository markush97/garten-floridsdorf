import { describe, expect, it } from 'vitest'
import {
  calendarEventPeriodIssue,
  createBookingInputSchema,
  createCalendarEventInputSchema,
  updateBookingInputSchema,
  updateCalendarEventInputSchema,
} from '../contracts/calendar'

// ---------------------------------------------------------------------------
// Zod contract schemas
// ---------------------------------------------------------------------------

describe('createCalendarEventInputSchema', () => {
  it('accepts a minimal single-day entry and normalizes optionals', () => {
    const result = createCalendarEventInputSchema.safeParse({
      title: '  Gießdienst  ',
      description: '   ',
      start_date: '2026-08-01',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Gießdienst')
      expect(result.data.description).toBeNull()
      expect(result.data.end_date).toBeUndefined()
    }
  })

  it('accepts a multi-day timed entry', () => {
    const result = createCalendarEventInputSchema.safeParse({
      title: 'Gartenfest',
      start_date: '2026-08-01',
      end_date: '2026-08-03',
      start_time: '15:00',
      end_time: '12:00',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an end date before the start date', () => {
    const result = createCalendarEventInputSchema.safeParse({
      title: 'Gartenfest',
      start_date: '2026-08-03',
      end_date: '2026-08-01',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an end time without a start time', () => {
    const result = createCalendarEventInputSchema.safeParse({
      title: 'Gartenfest',
      start_date: '2026-08-01',
      end_time: '12:00',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a same-day end time at or before the start time', () => {
    const result = createCalendarEventInputSchema.safeParse({
      title: 'Gartenfest',
      start_date: '2026-08-01',
      start_time: '15:00',
      end_time: '15:00',
    })
    expect(result.success).toBe(false)
  })

  it('rejects malformed dates and times', () => {
    for (const bad of [
      { start_date: '01.08.2026' },
      { start_date: '2026-08-01', start_time: '9:00' },
      { start_date: '2026-08-01', start_time: '25:00' },
    ]) {
      const result = createCalendarEventInputSchema.safeParse({
        title: 'Test',
        ...bad,
      })
      expect(result.success).toBe(false)
    }
  })
})

describe('updateCalendarEventInputSchema', () => {
  it('accepts partial updates and leaves absent fields undefined', () => {
    const result = updateCalendarEventInputSchema.safeParse({
      title: 'Neuer Titel',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.start_date).toBeUndefined()
      expect(result.data.description).toBeUndefined()
    }
  })
})

describe('calendarEventPeriodIssue', () => {
  it('flags merged PATCH values the schema cannot see', () => {
    expect(
      calendarEventPeriodIssue({
        start_date: '2026-08-05',
        end_date: '2026-08-01',
        start_time: null,
        end_time: null,
      }),
    ).toBe('Das Enddatum liegt vor dem Startdatum.')
    expect(
      calendarEventPeriodIssue({
        start_date: '2026-08-01',
        end_date: null,
        start_time: null,
        end_time: '12:00',
      }),
    ).toBe('Eine End-Uhrzeit braucht auch eine Start-Uhrzeit.')
    expect(
      calendarEventPeriodIssue({
        start_date: '2026-08-01',
        end_date: '2026-08-01',
        start_time: '15:00',
        end_time: '14:00',
      }),
    ).toBe('Die End-Uhrzeit liegt vor der Start-Uhrzeit.')
    expect(
      calendarEventPeriodIssue({
        start_date: '2026-08-01',
        end_date: '2026-08-02',
        start_time: '15:00',
        end_time: '10:00',
      }),
    ).toBeNull()
  })
})

describe('createBookingInputSchema', () => {
  it('requires the full period and normalizes the note', () => {
    const result = createBookingInputSchema.safeParse({
      start_date: '2026-08-01',
      start_time: '14:00',
      end_date: '2026-08-02',
      end_time: '10:00',
      note: '  ',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.note).toBeNull()

    expect(
      createBookingInputSchema.safeParse({
        start_date: '2026-08-01',
        start_time: '14:00',
        end_date: '2026-08-02',
      }).success,
    ).toBe(false)
  })
})

describe('updateBookingInputSchema', () => {
  it('accepts partial period changes', () => {
    const result = updateBookingInputSchema.safeParse({ end_time: '09:00' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.end_time).toBe('09:00')
      expect(result.data.start_date).toBeUndefined()
    }
  })
})
