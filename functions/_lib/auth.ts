import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { jwtVerify, SignJWT } from 'jose'
import { makeError } from './errors'

const COOKIE_NAME = 'session'
const JWT_ALG = 'HS256'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

/**
 * The signed-in identity carried in the session JWT. `userId` is
 * null only for the bootstrap root login (env `ADMIN_PASSWORD`),
 * which exists so the first real admin account can be invited.
 */
export type Session = {
  userId: number | null
  role: 'member' | 'admin'
  name: string
}

export type AuthVariables = {
  session: Session
}

function getSecretBytes(jwtSecret: string): Uint8Array {
  return new TextEncoder().encode(jwtSecret)
}

export async function signSessionToken(
  jwtSecret: string,
  session: Session,
): Promise<string> {
  return new SignJWT({ role: session.role, name: session.name })
    .setProtectedHeader({ alg: JWT_ALG })
    .setSubject(session.userId === null ? 'root' : String(session.userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretBytes(jwtSecret))
}

export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Strict',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  })
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, COOKIE_NAME, { path: '/' })
}

async function readSession(c: Context): Promise<Session | null> {
  const token = getCookie(c, COOKIE_NAME)
  if (!token) return null
  const env = c.env as { JWT_SECRET?: string }
  if (!env.JWT_SECRET) return null
  try {
    const { payload } = await jwtVerify(token, getSecretBytes(env.JWT_SECRET))
    const role = payload.role === 'admin' ? 'admin' : 'member'
    const userId =
      payload.sub === 'root' ? null : Number.parseInt(payload.sub ?? '', 10)
    if (userId !== null && !Number.isInteger(userId)) return null
    return {
      userId,
      role,
      name: typeof payload.name === 'string' ? payload.name : '',
    }
  } catch {
    return null
  }
}

/** Requires any signed-in user (member or admin). */
export const requireAuth: MiddlewareHandler<{
  Variables: AuthVariables
}> = async (c, next) => {
  const session = await readSession(c)
  if (!session) {
    return c.json(makeError('UNAUTHORIZED', 'Nicht angemeldet'), 401)
  }
  c.set('session', session)
  await next()
}

/** Requires a signed-in user with the admin role. */
export const requireAdmin: MiddlewareHandler<{
  Variables: AuthVariables
}> = async (c, next) => {
  const session = await readSession(c)
  if (!session) {
    return c.json(makeError('UNAUTHORIZED', 'Nicht angemeldet'), 401)
  }
  if (session.role !== 'admin') {
    return c.json(makeError('FORBIDDEN', 'Keine Berechtigung'), 403)
  }
  c.set('session', session)
  await next()
}

/** Reads the session without enforcing it (for `/auth/me`). */
export async function getSession(c: Context): Promise<Session | null> {
  return readSession(c)
}
