import { getCookie } from 'hono/cookie'
import { jwtVerify } from 'jose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('hono/cookie', () => ({
  getCookie: vi.fn(),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
}))

vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
  SignJWT: class {
    setProtectedHeader() {
      return this
    }
    setSubject() {
      return this
    }
    setIssuedAt() {
      return this
    }
    setExpirationTime() {
      return this
    }
    sign() {
      return Promise.resolve('mock-token')
    }
  },
}))

// Top-level await: import after vi.mock so the mocked modules are used
const { requireAuth, requireAdmin } = await import('../_lib/auth')

function makeCtx(jwtSecret: string | undefined = 'test-secret') {
  const json = vi.fn().mockReturnValue('response')
  const state: Record<string, unknown> = {}
  return {
    env: { JWT_SECRET: jwtSecret },
    json,
    set: (key: string, value: unknown) => {
      state[key] = value
    },
    get: (key: string) => state[key],
  } as unknown as Parameters<typeof requireAuth>[0]
}

describe('requireAuth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when no cookie is present', async () => {
    vi.mocked(getCookie).mockReturnValue(undefined)
    const ctx = makeCtx()
    const next = vi.fn()

    await requireAuth(ctx, next)

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
      401,
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when JWT_SECRET env var is missing', async () => {
    vi.mocked(getCookie).mockReturnValue('some-token')
    const ctx = makeCtx(undefined)
    const next = vi.fn()

    await requireAuth(ctx, next)

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
      401,
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when JWT verification fails', async () => {
    vi.mocked(getCookie).mockReturnValue('invalid.jwt.token')
    vi.mocked(jwtVerify).mockRejectedValue(new Error('JWTExpired'))
    const ctx = makeCtx()
    const next = vi.fn()

    await requireAuth(ctx, next)

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
      401,
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next() for a member session', async () => {
    vi.mocked(getCookie).mockReturnValue('valid.jwt.token')
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { sub: '7', role: 'member', name: 'Maria Hinkel' },
      protectedHeader: { alg: 'HS256' },
    } as never)
    const ctx = makeCtx()
    const next = vi.fn()

    await requireAuth(ctx, next)

    expect(next).toHaveBeenCalledOnce()
    expect(ctx.json).not.toHaveBeenCalled()
  })
})

describe('requireAdmin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for a signed-in member session', async () => {
    vi.mocked(getCookie).mockReturnValue('valid.jwt.token')
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { sub: '7', role: 'member', name: 'Maria Hinkel' },
      protectedHeader: { alg: 'HS256' },
    } as never)
    const ctx = makeCtx()
    const next = vi.fn()

    await requireAdmin(ctx, next)

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'FORBIDDEN' }),
      403,
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next() for the root bootstrap session', async () => {
    vi.mocked(getCookie).mockReturnValue('valid.jwt.token')
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { sub: 'root', role: 'admin', name: 'Administrator' },
      protectedHeader: { alg: 'HS256' },
    } as never)
    const ctx = makeCtx()
    const next = vi.fn()

    await requireAdmin(ctx, next)

    expect(next).toHaveBeenCalledOnce()
    expect(ctx.json).not.toHaveBeenCalled()
  })

  it('calls next() for an admin user session', async () => {
    vi.mocked(getCookie).mockReturnValue('valid.jwt.token')
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { sub: '1', role: 'admin', name: 'Tom' },
      protectedHeader: { alg: 'HS256' },
    } as never)
    const ctx = makeCtx()
    const next = vi.fn()

    await requireAdmin(ctx, next)

    expect(next).toHaveBeenCalledOnce()
    expect(ctx.json).not.toHaveBeenCalled()
  })
})
