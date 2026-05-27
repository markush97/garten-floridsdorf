import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { jwtVerify, SignJWT } from 'jose'
import { makeError } from './errors'

const COOKIE_NAME = 'admin_token'
const JWT_ALG = 'HS256'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7

function getSecretBytes(jwtSecret: string): Uint8Array {
  return new TextEncoder().encode(jwtSecret)
}

async function timingSafeCompare(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode('timing-safe-compare'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const [aHash, bHash] = await Promise.all([
    crypto.subtle.sign('HMAC', key, enc.encode(a)),
    crypto.subtle.sign('HMAC', key, enc.encode(b)),
  ])
  const aArr = new Uint8Array(aHash)
  const bArr = new Uint8Array(bHash)
  let diff = 0
  for (let i = 0; i < aArr.length; i++) {
    diff |= (aArr[i] ?? 0) ^ (bArr[i] ?? 0)
  }
  return diff === 0
}

export async function verifyPassword(
  input: string,
  stored: string,
): Promise<boolean> {
  return timingSafeCompare(input, stored)
}

export async function signAdminToken(jwtSecret: string): Promise<string> {
  return new SignJWT({ sub: 'admin' })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecretBytes(jwtSecret))
}

export function setAdminCookie(c: Context, token: string): void {
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const token = getCookie(c, COOKIE_NAME)
  if (!token) {
    return c.json(makeError('UNAUTHORIZED', 'Nicht angemeldet'), 401)
  }
  const env = c.env as { JWT_SECRET?: string }
  if (!env.JWT_SECRET) {
    return c.json(
      makeError('INTERNAL_ERROR', 'Serverkonfigurationsfehler'),
      500,
    )
  }
  try {
    await jwtVerify(token, getSecretBytes(env.JWT_SECRET))
  } catch {
    return c.json(makeError('UNAUTHORIZED', 'Ungültige Sitzung'), 401)
  }
  await next()
}
