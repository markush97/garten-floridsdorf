import { desc, eq } from 'drizzle-orm'
import { dayjs, nowUtc } from '../../_lib/dayjs'
import type { Database } from '../../_lib/db'
import { AppError } from '../../_lib/errors'
import { generateToken, hashToken } from '../../_lib/token'
import {
  type PollShareTokenRow as PollShareToken,
  poll_share_tokens,
  poll_share_views,
  polls,
} from '../schema'

/**
 * List all share tokens for a poll. The plaintext is never
 * returned — we expose only the fingerprint prefix so the admin
 * can tell tokens apart in the UI.
 */
export async function listShareTokens(
  db: Database,
  pollId: number,
): Promise<PollShareToken[]> {
  return db
    .select()
    .from(poll_share_tokens)
    .where(eq(poll_share_tokens.poll_id, pollId))
    .orderBy(desc(poll_share_tokens.created_at))
    .all()
}

/**
 * Generates a fresh share token, persists the SHA-256 hash, and
 * returns the row together with the plaintext. The plaintext is
 * returned exactly once and should be displayed in the admin UI
 * before continuing; we never store it.
 */
export async function createShareToken(
  db: Database,
  pollId: number,
  input: { label?: string | null; expires_at?: string | null },
): Promise<{ row: PollShareToken; plaintext: string }> {
  const poll = await db
    .select({ id: polls.id })
    .from(polls)
    .where(eq(polls.id, pollId))
    .get()
  if (!poll) {
    throw new AppError('NOT_FOUND', 'Umfrage nicht gefunden', 404)
  }
  const plaintext = generateToken()
  const tokenHash = await hashToken(plaintext)
  const now = nowUtc()
  const inserted = await db
    .insert(poll_share_tokens)
    .values({
      poll_id: pollId,
      token_hash: tokenHash,
      label: input.label ?? null,
      created_at: now,
      expires_at: input.expires_at ?? null,
      revoked_at: null,
      last_hit_at: null,
    })
    .returning()
  const row = inserted[0]
  if (!row) {
    throw new AppError('INTERNAL_ERROR', 'Fehler beim Anlegen', 500)
  }
  return { row, plaintext }
}

export async function findShareTokenInPollOrThrow(
  db: Database,
  pollId: number,
  id: number,
) {
  const row = await db
    .select()
    .from(poll_share_tokens)
    .where(eq(poll_share_tokens.id, id))
    .get()
  if (!row || row.poll_id !== pollId) {
    throw new AppError('NOT_FOUND', 'Share-Link nicht gefunden', 404)
  }
  return row
}

export async function revokeShareToken(
  db: Database,
  pollId: number,
  id: number,
) {
  const existing = await findShareTokenInPollOrThrow(db, pollId, id)
  if (existing.revoked_at !== null) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Share-Link ist bereits aufgehoben.',
      400,
    )
  }
  const now = nowUtc()
  await db
    .update(poll_share_tokens)
    .set({ revoked_at: now })
    .where(eq(poll_share_tokens.id, id))
  return findShareTokenInPollOrThrow(db, pollId, id)
}

/**
 * Public lookup used by `assertPollAccess`. Returns the token's
 * `poll_id` when the token is valid; throws an AppError otherwise.
 * Records the hit and stamps `last_hit_at` so the admin can see
 * whether the link is in use.
 *
 * "Valid" means:
 *   - a row exists for the hash,
 *   - it has not been revoked,
 *   - it has not expired.
 */
export async function resolveShareToken(
  db: Database,
  plaintext: string,
): Promise<{ row: PollShareToken; pollId: number }> {
  const tokenHash = await hashToken(plaintext)
  const row = await db
    .select()
    .from(poll_share_tokens)
    .where(eq(poll_share_tokens.token_hash, tokenHash))
    .get()
  if (!row) {
    throw new AppError('NOT_FOUND', 'Share-Link nicht gefunden', 404)
  }
  if (row.revoked_at !== null) {
    throw new AppError('GONE', 'Share-Link ist aufgehoben.', 410)
  }
  if (row.expires_at !== null && row.expires_at < todayUtc()) {
    throw new AppError('GONE', 'Share-Link ist abgelaufen.', 410)
  }

  const now = nowUtc()
  await db.insert(poll_share_views).values({
    token_id: row.id,
    viewed_at: now,
  })
  await db
    .update(poll_share_tokens)
    .set({ last_hit_at: now })
    .where(eq(poll_share_tokens.id, row.id))

  return { row, pollId: row.poll_id }
}

/**
 * Whether a token row is "active" — i.e. not revoked and not past
 * its expiry. Pure helper used by the admin list view.
 */
export function isShareTokenActive(row: {
  revoked_at: string | null
  expires_at: string | null
}): boolean {
  if (row.revoked_at !== null) return false
  if (row.expires_at !== null && row.expires_at < todayUtc()) return false
  return true
}

function todayUtc(): string {
  return dayjs.utc().format('YYYY-MM-DD')
}
