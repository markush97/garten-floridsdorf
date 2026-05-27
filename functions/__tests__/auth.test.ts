import { getCookie } from 'hono/cookie'
import { jwtVerify } from 'jose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('hono/cookie', () => ({
  getCookie: vi.fn(),
  setCookie: vi.fn(),
}))

vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
  SignJWT: class {
    setProtectedHeader() {
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
const { requireAdmin } = await import('../_lib/auth')

describe('requireAdmin', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeCtx(jwtSecret = 'test-secret') {
    const json = vi.fn().mockReturnValue('response')
    return { env: { JWT_SECRET: jwtSecret }, json } as unknown as Parameters<
      typeof requireAdmin
    >[0]
  }

  it('returns 401 when no cookie is present', async () => {
    vi.mocked(getCookie).mockReturnValue(undefined)
    const ctx = makeCtx()
    const next = vi.fn()

    await requireAdmin(ctx, next)

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
      401,
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 500 when JWT_SECRET env var is missing', async () => {
    vi.mocked(getCookie).mockReturnValue('some-token')
    const ctx = makeCtx('')
    ;(ctx as { env: { JWT_SECRET?: string } }).env.JWT_SECRET = undefined
    const next = vi.fn()

    await requireAdmin(ctx, next)

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      500,
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when JWT verification fails', async () => {
    vi.mocked(getCookie).mockReturnValue('invalid.jwt.token')
    vi.mocked(jwtVerify).mockRejectedValue(new Error('JWTExpired'))
    const ctx = makeCtx()
    const next = vi.fn()

    await requireAdmin(ctx, next)

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
      401,
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next() when a valid JWT is present', async () => {
    vi.mocked(getCookie).mockReturnValue('valid.jwt.token')
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { sub: 'admin' },
      protectedHeader: { alg: 'HS256' },
    } as never)
    const ctx = makeCtx()
    const next = vi.fn()

    await requireAdmin(ctx, next)

    expect(next).toHaveBeenCalledOnce()
    expect(ctx.json).not.toHaveBeenCalled()
  })
})
