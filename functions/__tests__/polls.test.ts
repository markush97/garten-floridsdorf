import { describe, expect, it, vi } from 'vitest'
import {
  createPollInputSchema,
  finalizePollInputSchema,
  submitVotesInputSchema,
} from '../contracts/poll'
import { upsertVotes } from '../db/queries/polls'

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
// One-active-poll constraint — verifies createPollWithOptions uses a transaction
// ---------------------------------------------------------------------------

describe('createPollWithOptions', () => {
  it('wraps creation in a db.transaction to ensure atomicity', async () => {
    const transaction = vi.fn().mockResolvedValue({
      id: 1,
      title: 'Test',
      is_active: true,
      description: null,
      final_option_id: null,
      created_at: '2026-01-01T00:00:00.000Z',
      closed_at: null,
      options: [],
      votes: [],
    })
    const mockDb = { transaction } as never

    const { createPollWithOptions } = await import('../db/queries/polls')
    await createPollWithOptions(mockDb, {
      title: 'Test',
      options: [{ label: 'A', date: '2026-06-15' }],
    })

    expect(transaction).toHaveBeenCalledOnce()
  })
})
