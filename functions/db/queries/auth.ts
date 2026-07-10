import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { dayjs, nowUtc } from '../../_lib/dayjs'
import type { Database } from '../../_lib/db'
import { AppError } from '../../_lib/errors'
import { generateToken, hashToken } from '../../_lib/token'
import { auth_rate_limits, auth_tokens, users } from '../schema'

const INVITE_TTL_DAYS = 14
const MAGIC_LINK_TTL_MINUTES = 15

export async function findUserByUsername(db: Database, username: string) {
  return db.select().from(users).where(eq(users.username, username)).get()
}

/**
 * Users eligible for a magic link: activated accounts with this
 * e-mail. The caller only sends a link when the match is unique —
 * shared family addresses fall back to username sign-in.
 */
export async function findActivatedUsersByEmail(db: Database, email: string) {
  return db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      and(
        sql`lower(${users.email}) = ${email.toLowerCase()}`,
        isNotNull(users.activated_at),
      ),
    )
    .all()
}

/**
 * Creates a fresh single-use token for the user. Any still-pending
 * tokens of the same purpose are invalidated so only the newest
 * invite / magic link works.
 */
export async function createAuthToken(
  db: Database,
  userId: number,
  purpose: 'invite' | 'magic_link',
): Promise<{ plaintext: string; expires_at: string }> {
  const now = nowUtc()
  await db
    .update(auth_tokens)
    .set({ used_at: now })
    .where(
      and(
        eq(auth_tokens.user_id, userId),
        eq(auth_tokens.purpose, purpose),
        isNull(auth_tokens.used_at),
      ),
    )
  const plaintext = generateToken()
  const expiresAt =
    purpose === 'invite'
      ? dayjs.utc().add(INVITE_TTL_DAYS, 'day').toISOString()
      : dayjs.utc().add(MAGIC_LINK_TTL_MINUTES, 'minute').toISOString()
  await db.insert(auth_tokens).values({
    user_id: userId,
    token_hash: await hashToken(plaintext),
    purpose,
    created_at: now,
    expires_at: expiresAt,
  })
  return { plaintext, expires_at: expiresAt }
}

/**
 * Resolves a plaintext token to its user, enforcing purpose,
 * single use, and expiry. Does NOT consume the token — call
 * `consumeAuthToken` once the flow succeeds.
 */
export async function resolveAuthToken(
  db: Database,
  plaintext: string,
  purpose: 'invite' | 'magic_link',
) {
  const tokenHash = await hashToken(plaintext)
  const row = await db
    .select({
      token: auth_tokens,
      user: users,
    })
    .from(auth_tokens)
    .innerJoin(users, eq(auth_tokens.user_id, users.id))
    .where(
      and(
        eq(auth_tokens.token_hash, tokenHash),
        eq(auth_tokens.purpose, purpose),
      ),
    )
    .get()
  if (!row || row.token.used_at) {
    throw new AppError('NOT_FOUND', 'Link ungültig oder bereits verwendet', 404)
  }
  if (dayjs.utc(row.token.expires_at).isBefore(dayjs.utc())) {
    throw new AppError('GONE', 'Link abgelaufen', 410)
  }
  return row
}

export async function consumeAuthToken(db: Database, tokenId: number) {
  await db
    .update(auth_tokens)
    .set({ used_at: nowUtc() })
    .where(eq(auth_tokens.id, tokenId))
}

/** Sets the user's credentials when an invite is accepted. */
export async function activateUser(
  db: Database,
  userId: number,
  username: string,
  passwordHash: string,
) {
  const taken = await findUserByUsername(db, username)
  if (taken && taken.id !== userId) {
    throw new AppError('CONFLICT', 'Benutzername ist bereits vergeben', 409)
  }
  const now = nowUtc()
  await db
    .update(users)
    .set({
      username,
      password_hash: passwordHash,
      activated_at: now,
      updated_at: now,
    })
    .where(eq(users.id, userId))
}

/**
 * Fixed-window rate limit: allows `limit` hits per IP+bucket per
 * `windowMinutes`, throws 429 beyond that. Used for failed logins
 * and magic-link requests.
 */
export async function enforceRateLimit(
  db: Database,
  ip: string,
  bucket: string,
  limit: number,
  windowMinutes: number,
): Promise<void> {
  const now = dayjs.utc()
  const row = await db
    .select()
    .from(auth_rate_limits)
    .where(
      and(eq(auth_rate_limits.ip, ip), eq(auth_rate_limits.bucket, bucket)),
    )
    .get()
  const windowExpired =
    !row || now.diff(dayjs.utc(row.window_start), 'minute') >= windowMinutes
  if (windowExpired) {
    await db
      .insert(auth_rate_limits)
      .values({ ip, bucket, window_start: now.toISOString(), count: 1 })
      .onConflictDoUpdate({
        target: [auth_rate_limits.ip, auth_rate_limits.bucket],
        set: { window_start: now.toISOString(), count: 1 },
      })
    return
  }
  if (row.count >= limit) {
    throw new AppError(
      'RATE_LIMITED',
      'Zu viele Versuche. Bitte später erneut versuchen.',
      429,
    )
  }
  await db
    .update(auth_rate_limits)
    .set({ count: row.count + 1 })
    .where(
      and(eq(auth_rate_limits.ip, ip), eq(auth_rate_limits.bucket, bucket)),
    )
}
