import { describe, expect, it, vi } from 'vitest'
import {
  createPollInputSchema,
  finalizePollInputSchema,
  nextEventSchema,
  submitVotesInputSchema,
} from '../contracts/poll'
import { findNextLockedEvent, upsertVotes } from '../db/queries/polls'

// ---------------------------------------------------------------------------
// Zod contract schemas
// ---------------------------------------------------------------------------

describe('createPollInputSchema', () => {
  it('accepts a valid poll with one option', () => {
    const result = createPollInputSchema.safeParse({
      title: 'Gartentag',
      options: [{ label: 'Vormittag', date: '2026-06-15' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty title', () => {
    const result = createPollInputSchema.safeParse({
      title: '',
      options: [{ label: 'A', date: '2026-06-15' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty options array', () => {
    const result = createPollInputSchema.safeParse({
      title: 'Test',
      options: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than 20 options', () => {
    const result = createPollInputSchema.safeParse({
      title: 'Test',
      options: Array.from({ length: 21 }, (_, i) => ({
        label: `Option ${i}`,
        date: '2026-06-15',
      })),
    })
    expect(result.success).toBe(false)
  })
})

describe('submitVotesInputSchema', () => {
  it('accepts a valid vote submission', () => {
    const result = submitVotesInputSchema.safeParse({
      voter_name: 'Max Mustermann',
      responses: [{ option_id: 1, response: 'yes' }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts all three valid response values', () => {
    for (const response of ['yes', 'no', 'maybe'] as const) {
      const result = submitVotesInputSchema.safeParse({
        voter_name: 'Max',
        responses: [{ option_id: 1, response }],
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects an empty voter name', () => {
    const result = submitVotesInputSchema.safeParse({
      voter_name: '',
      responses: [{ option_id: 1, response: 'yes' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid response value', () => {
    const result = submitVotesInputSchema.safeParse({
      voter_name: 'Max',
      responses: [{ option_id: 1, response: 'definitely' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty responses array', () => {
    const result = submitVotesInputSchema.safeParse({
      voter_name: 'Max',
      responses: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('finalizePollInputSchema', () => {
  it('accepts an empty object (no fields required)', () => {
    expect(finalizePollInputSchema.safeParse({}).success).toBe(true)
  })

  it('accepts final_option_id as null (clear the choice)', () => {
    const result = finalizePollInputSchema.safeParse({ final_option_id: null })
    expect(result.success).toBe(true)
  })

  it('accepts closed: true', () => {
    const result = finalizePollInputSchema.safeParse({ closed: true })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Vote upsert — verifies onConflictDoUpdate is used for idempotency
// ---------------------------------------------------------------------------

describe('upsertVotes', () => {
  it('calls onConflictDoUpdate for each response (idempotent upsert)', async () => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate })
    const mockDb = { insert: vi.fn().mockReturnValue({ values }) } as never

    await upsertVotes(mockDb, 1, 'Max', [
      { option_id: 1, response: 'yes' },
      { option_id: 2, response: 'no' },
    ])

    expect(onConflictDoUpdate).toHaveBeenCalledTimes(2)
  })

  it('passes voter name and poll id into each inserted row', async () => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate })
    const mockDb = { insert: vi.fn().mockReturnValue({ values }) } as never

    await upsertVotes(mockDb, 42, 'Maria', [
      { option_id: 7, response: 'maybe' },
    ])

    const insertedRow = vi.mocked(values).mock.calls[0]?.[0]
    expect(insertedRow).toMatchObject({
      poll_id: 42,
      voter_name: 'Maria',
      option_id: 7,
    })
  })
})

// ---------------------------------------------------------------------------
// One-active-poll constraint — verifies createPollWithOptions deactivates
// existing polls before inserting the new one (D1 does not support transactions)
// ---------------------------------------------------------------------------

describe('createPollWithOptions', () => {
  it('deactivates existing polls then inserts the new poll and its options', async () => {
    const returning = vi.fn().mockResolvedValue([
      {
        id: 1,
        title: 'Test',
        is_active: true,
        description: null,
        final_option_id: null,
        created_at: '2026-01-01T00:00:00.000Z',
        closed_at: null,
      },
    ])
    const insertValues = vi.fn().mockReturnValue({ returning })
    const all = vi.fn().mockResolvedValue([])
    const selectWhere = vi
      .fn()
      .mockReturnValue({ orderBy: vi.fn().mockReturnValue({ all }) })
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere })
    const updateWhere = vi.fn().mockResolvedValue(undefined)
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere })
    const mockDb = {
      update: vi.fn().mockReturnValue({ set: updateSet }),
      insert: vi.fn().mockReturnValue({ values: insertValues }),
      select: vi.fn().mockReturnValue({ from: selectFrom }),
      run: vi.fn().mockResolvedValue({}),
    } as unknown as import('../_lib/db').Database

    const { createPollWithOptions } = await import('../db/queries/polls')
    await createPollWithOptions(mockDb, {
      title: 'Test',
      options: [{ label: 'A', date: '2026-06-15' }],
    })

    expect(mockDb.update).toHaveBeenCalledOnce()
    // insert called once for the poll row; options use db.run() to avoid
    // Drizzle emitting null for the AUTOINCREMENT id column on D1
    expect(mockDb.insert).toHaveBeenCalledOnce()
    expect(mockDb.run).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// Next-locked-event — verify landing-page feed picks the right option
// ---------------------------------------------------------------------------

function buildLockedPollMock(
  polls: Array<{
    id: number
    title: string
    slug: string
    final_option_id: number
  }>,
  options: Array<{
    id: number
    poll_id: number
    label: string
    date: string
    time: string | null
    sort_order: number
  }>,
) {
  // Two select calls: first for polls (filtered to isNotNull final_option_id),
  // second for poll_options with a SQL `IN (...)` clause.
  const callResults: unknown[][] = [polls, options]
  const selectMock = vi.fn().mockImplementation(() => {
    const next = callResults.shift() ?? []
    return {
      from: () => ({
        where: () => ({ all: async () => next }),
      }),
    }
  })
  return { select: selectMock } as never
}

function makeLockedOption(id: number, pollId: number, date: string) {
  return {
    id,
    poll_id: pollId,
    label: 'Option',
    date,
    time: null,
    sort_order: 0,
  }
}

describe('nextEventSchema', () => {
  it('accepts a valid next-event payload', () => {
    const result = nextEventSchema.safeParse({
      poll_id: 1,
      slug: 'garten-juni',
      title: 'Gartentag',
      option: makeLockedOption(7, 1, '2026-06-15'),
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown option shape', () => {
    const result = nextEventSchema.safeParse({
      poll_id: 1,
      slug: 'x',
      title: 'x',
      option: { id: 'not-a-number' },
    })
    expect(result.success).toBe(false)
  })
})

describe('findNextLockedEvent', () => {
  it('returns null when no poll is locked yet', async () => {
    const db = buildLockedPollMock([], [])
    const result = await findNextLockedEvent(db)
    expect(result).toBeNull()
  })

  it('returns the upcoming locked event (sorted by date)', async () => {
    const polls = [
      {
        id: 1,
        title: 'A',
        slug: 'a',
        final_option_id: 10,
      },
      {
        id: 2,
        title: 'B',
        slug: 'b',
        final_option_id: 20,
      },
    ]
    const options = [
      makeLockedOption(10, 1, '2027-01-01'),
      makeLockedOption(20, 2, '2026-12-15'),
    ]
    const db = buildLockedPollMock(polls, options)
    const result = await findNextLockedEvent(db)
    // `findNextLockedEvent` sorts upcoming events ascending by date; today is
    // 2026-06-10 so both are upcoming, with 2026-12-15 coming first.
    expect(result?.option.date).toBe('2026-12-15')
    expect(result?.title).toBe('B')
  })

  it('falls back to the most recent past locked event if none is upcoming', async () => {
    const polls = [
      {
        id: 1,
        title: 'Older',
        slug: 'older',
        final_option_id: 10,
      },
      {
        id: 2,
        title: 'Newer',
        slug: 'newer',
        final_option_id: 20,
      },
    ]
    const options = [
      makeLockedOption(10, 1, '2025-08-01'),
      makeLockedOption(20, 2, '2026-04-01'),
    ]
    const db = buildLockedPollMock(polls, options)
    const result = await findNextLockedEvent(db)
    expect(result?.option.date).toBe('2026-04-01')
    expect(result?.title).toBe('Newer')
  })

  it('counts an event whose date equals today as upcoming', async () => {
    const today = '2026-06-10' // matches workspace "current date"
    const polls = [
      {
        id: 1,
        title: 'Today',
        slug: 'today',
        final_option_id: 42,
      },
    ]
    const options = [makeLockedOption(42, 1, today)]
    const db = buildLockedPollMock(polls, options)
    const result = await findNextLockedEvent(db)
    expect(result?.option.date).toBe(today)
    expect(result?.slug).toBe('today')
  })

  it('skips polls whose final_option_id does not match any option row', async () => {
    const polls = [
      {
        id: 1,
        title: 'Stale',
        slug: 'stale',
        final_option_id: 999,
      },
    ]
    const options: ReturnType<typeof makeLockedOption>[] = []
    const db = buildLockedPollMock(polls, options)
    const result = await findNextLockedEvent(db)
    expect(result).toBeNull()
  })
})
