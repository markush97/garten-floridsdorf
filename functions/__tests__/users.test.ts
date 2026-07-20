import { describe, expect, it, vi } from 'vitest'
import {
  createUserInputSchema,
  updateUserInputSchema,
  userSchema,
} from '../contracts/user'
import {
  createUser,
  deleteUser,
  findUserBySlugOrThrow,
  listAllUsers,
  updateUser,
} from '../db/queries/users'

// ---------------------------------------------------------------------------
// Zod contract schemas
// ---------------------------------------------------------------------------

describe('userSchema', () => {
  it('accepts a valid user payload', () => {
    const result = userSchema.safeParse({
      id: 1,
      slug: 'maria-hinkel',
      first_name: 'Maria',
      last_name: 'Hinkel',
      email: null,
      phone: null,
      description: null,
      username: null,
      role: 'member',
      is_kassier: false,
      activated_at: null,
      created_at: '2026-06-10T10:00:00.000Z',
      updated_at: '2026-06-10T10:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('createUserInputSchema', () => {
  it('accepts a user with only the required name fields', () => {
    const result = createUserInputSchema.safeParse({
      first_name: 'Maria',
      last_name: 'Hinkel',
    })
    expect(result.success).toBe(true)
  })

  it('trims surrounding whitespace from names', () => {
    const result = createUserInputSchema.safeParse({
      first_name: '  Maria  ',
      last_name: '\tHinkel\n',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.first_name).toBe('Maria')
      expect(result.data.last_name).toBe('Hinkel')
    }
  })

  it('treats blank optional fields as null', () => {
    const result = createUserInputSchema.safeParse({
      first_name: 'Maria',
      last_name: 'Hinkel',
      email: '   ',
      phone: '',
      description: '\n  \t',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBeNull()
      expect(result.data.phone).toBeNull()
      expect(result.data.description).toBeNull()
    }
  })

  it('rejects an empty first name', () => {
    const result = createUserInputSchema.safeParse({
      first_name: '   ',
      last_name: 'Hinkel',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a too-long first name', () => {
    const result = createUserInputSchema.safeParse({
      first_name: 'x'.repeat(101),
      last_name: 'Hinkel',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a single-character optional email', () => {
    const result = createUserInputSchema.safeParse({
      first_name: 'Maria',
      last_name: 'Hinkel',
      email: 'a',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateUserInputSchema', () => {
  it('accepts a partial payload', () => {
    const result = updateUserInputSchema.safeParse({ first_name: 'M' })
    expect(result.success).toBe(true)
  })

  it('accepts an empty payload (no-op)', () => {
    expect(updateUserInputSchema.safeParse({}).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Query behaviour
// ---------------------------------------------------------------------------

const baseUser = {
  id: 1,
  slug: 'maria-hinkel-1700000000000',
  first_name: 'Maria',
  last_name: 'Hinkel',
  email: null,
  phone: null,
  description: null,
  created_at: '2026-06-10T10:00:00.000Z',
  updated_at: '2026-06-10T10:00:00.000Z',
}

/**
 * Single combined mock for the user queries. The Drizzle chain terminates
 * in either `.all()` (listAllUsers), `.get()` (findXxxOrThrow), or has
 * earlier branches for `.orderBy()`. The mutable methods (update / insert
 * / delete) live on the same object.
 */
function makeDbMock() {
  const pending: Array<{
    get?: () => unknown
    all?: () => unknown
  }> = []

  const orderBy = vi.fn().mockImplementation(() => {
    const next = pending.shift() ?? {}
    return {
      get: next.get ?? (() => undefined),
      all: next.all ?? (() => []),
    }
  })
  const where = vi.fn().mockImplementation(() => {
    const next = pending.shift() ?? {}
    return {
      get: next.get ?? (() => undefined),
      all: next.all ?? (() => []),
      orderBy,
    }
  })
  const from = vi.fn().mockReturnValue({ where, orderBy })
  const select = vi.fn().mockReturnValue({ from })

  const set = vi
    .fn()
    .mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })
  const update = vi.fn().mockReturnValue({ set })
  const returning = vi.fn().mockResolvedValue([])
  const values = vi.fn().mockReturnValue({ returning })
  const insert = vi.fn().mockReturnValue({ values })
  const del = vi.fn().mockResolvedValue(undefined)
  const deleteOp = vi.fn().mockReturnValue({ where: del })

  const db = { select, update, insert, delete: deleteOp } as never

  return {
    db,
    set,
    update,
    returning,
    values,
    insert,
    del,
    queueChainResult(result: { get?: () => unknown; all?: () => unknown }) {
      pending.push(result)
    },
  }
}

describe('listAllUsers', () => {
  it('returns users ordered by last name', async () => {
    const m = makeDbMock()
    m.queueChainResult({ all: async () => [baseUser] })
    const result = await listAllUsers(m.db)
    expect(result).toEqual([baseUser])
  })
})

describe('findUserBySlugOrThrow', () => {
  it('returns the user when found', async () => {
    const m = makeDbMock()
    m.queueChainResult({ get: () => baseUser })
    const result = await findUserBySlugOrThrow(m.db, 'maria-hinkel')
    expect(result).toEqual(baseUser)
  })

  it('throws AppError(404) when the user does not exist', async () => {
    const m = makeDbMock()
    m.queueChainResult({ get: () => undefined })
    await expect(findUserBySlugOrThrow(m.db, 'missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    })
  })
})

describe('createUser', () => {
  it('normalises blank optional fields to null and trims names', async () => {
    const m = makeDbMock()
    m.returning.mockResolvedValue([baseUser])
    const result = await createUser(m.db, {
      first_name: '  Maria  ',
      last_name: '  Hinkel  ',
      email: '   ',
      phone: '',
      description: '  ',
    })
    expect(result).toEqual(baseUser)
    const insertedRow = m.values.mock.calls[0]?.[0]
    expect(insertedRow).toMatchObject({
      first_name: 'Maria',
      last_name: 'Hinkel',
      email: null,
      phone: null,
      description: null,
    })
  })

  it('throws when the insert returns no row', async () => {
    const m = makeDbMock()
    m.returning.mockResolvedValue([])
    await expect(
      createUser(m.db, { first_name: 'A', last_name: 'B' }),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' })
  })
})

describe('updateUser', () => {
  it('keeps the slug stable when the name changes', async () => {
    const renamed = { ...baseUser, first_name: 'Mira' }
    const m = makeDbMock()
    // 1st lookup (current row), 2nd lookup (post-update read-back).
    m.queueChainResult({ get: () => baseUser })
    m.queueChainResult({ get: () => renamed })

    const result = await updateUser(m.db, 1, { first_name: 'Mira' })
    expect(result.first_name).toBe('Mira')
    const setPayload = m.set.mock.calls[0]?.[0]
    expect(setPayload.first_name).toBe('Mira')
    expect(setPayload.slug).toBeUndefined()
  })

  it('leaves the slug alone when the name does not change', async () => {
    const m = makeDbMock()
    m.queueChainResult({ get: () => baseUser })
    m.queueChainResult({ get: () => baseUser })
    await updateUser(m.db, 1, { email: 'mira@example.com' })
    const setPayload = m.set.mock.calls[0]?.[0]
    expect(setPayload.slug).toBeUndefined()
    expect(setPayload.email).toBe('mira@example.com')
  })
})

describe('deleteUser', () => {
  it('deletes a user by id', async () => {
    const m = makeDbMock()
    m.queueChainResult({ get: () => baseUser })
    await deleteUser(m.db, 1)
    expect(m.del).toHaveBeenCalledOnce()
  })

  it('throws 404 when the user does not exist', async () => {
    const m = makeDbMock()
    m.queueChainResult({ get: () => undefined })
    await expect(deleteUser(m.db, 999)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    })
  })
})
