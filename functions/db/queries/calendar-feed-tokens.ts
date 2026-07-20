import { eq } from 'drizzle-orm'
import { nowUtc } from '../../_lib/dayjs'
import type { Database } from '../../_lib/db'
import { AppError } from '../../_lib/errors'
import { generateToken, hashToken } from '../../_lib/token'
import { type CalendarFeedTokenRow, calendar_feed_tokens } from '../schema'

/**
 * Personal iCal feed tokens — one active token per user. Mirrors the
 * share-token pattern: only the SHA-256 hash is persisted, the
 * plaintext exists solely in the feed URL handed to the member.
 */

export async function getFeedToken(
  db: Database,
  userId: number,
): Promise<CalendarFeedTokenRow | undefined> {
  return db
    .select()
    .from(calendar_feed_tokens)
    .where(eq(calendar_feed_tokens.user_id, userId))
    .get()
}

/**
 * Creates the user's feed token, replacing any existing one (rotate
 * and create are the same operation — the old URL stops working).
 * Returns the plaintext exactly once.
 */
export async function rotateFeedToken(
  db: Database,
  userId: number,
): Promise<{ row: CalendarFeedTokenRow; plaintext: string }> {
  const plaintext = generateToken()
  const tokenHash = await hashToken(plaintext)
  await db
    .delete(calendar_feed_tokens)
    .where(eq(calendar_feed_tokens.user_id, userId))
  const inserted = await db
    .insert(calendar_feed_tokens)
    .values({
      user_id: userId,
      token_hash: tokenHash,
      created_at: nowUtc(),
      last_used_at: null,
    })
    .returning()
  const row = inserted[0]
  if (!row) {
    throw new AppError('INTERNAL_ERROR', 'Fehler beim Anlegen', 500)
  }
  return { row, plaintext }
}

export async function revokeFeedToken(
  db: Database,
  userId: number,
): Promise<void> {
  const existing = await getFeedToken(db, userId)
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Kein Kalender-Feed vorhanden.', 404)
  }
  await db
    .delete(calendar_feed_tokens)
    .where(eq(calendar_feed_tokens.id, existing.id))
}

/**
 * Public lookup for `GET /ics/:token`. Stamps `last_used_at` so the
 * member can see that the subscription is alive.
 */
export async function resolveFeedToken(
  db: Database,
  plaintext: string,
): Promise<{ userId: number }> {
  const tokenHash = await hashToken(plaintext)
  const row = await db
    .select()
    .from(calendar_feed_tokens)
    .where(eq(calendar_feed_tokens.token_hash, tokenHash))
    .get()
  if (!row) {
    throw new AppError('NOT_FOUND', 'Kalender-Feed nicht gefunden.', 404)
  }
  await db
    .update(calendar_feed_tokens)
    .set({ last_used_at: nowUtc() })
    .where(eq(calendar_feed_tokens.id, row.id))
  return { userId: row.user_id }
}
