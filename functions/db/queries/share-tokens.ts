import { and, asc, desc, eq } from 'drizzle-orm'
import { dayjs, nowUtc } from '../../_lib/dayjs'
import type { Database } from '../../_lib/db'
import { AppError } from '../../_lib/errors'
import { generateToken, hashToken } from '../../_lib/token'
import {
  type EventShareTokenRow as EventShareToken,
  event_agenda_items,
  event_share_tokens,
  event_share_views,
  events,
} from '../schema'

/**
 * List all share tokens for an event. The plaintext is never
 * returned — we expose only the fingerprint prefix so the admin
 * can tell tokens apart in the UI.
 */
export async function listShareTokens(
  db: Database,
  eventId: number,
): Promise<EventShareToken[]> {
  return db
    .select()
    .from(event_share_tokens)
    .where(eq(event_share_tokens.event_id, eventId))
    .orderBy(desc(event_share_tokens.created_at))
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
  eventId: number,
  input: { label?: string | null; expires_at?: string | null },
): Promise<{ row: EventShareToken; plaintext: string }> {
  // Confirm the event exists so the FK violation surfaces as a 404,
  // not a generic constraint error.
  const event = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, eventId))
    .get()
  if (!event) {
    throw new AppError('NOT_FOUND', 'Termin nicht gefunden', 404)
  }
  const plaintext = generateToken()
  const tokenHash = await hashToken(plaintext)
  const now = nowUtc()
  const inserted = await db
    .insert(event_share_tokens)
    .values({
      event_id: eventId,
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

export async function findShareTokenInEventOrThrow(
  db: Database,
  eventId: number,
  id: number,
) {
  const row = await db
    .select()
    .from(event_share_tokens)
    .where(
      and(
        eq(event_share_tokens.id, id),
        eq(event_share_tokens.event_id, eventId),
      ),
    )
    .get()
  if (!row) {
    throw new AppError('NOT_FOUND', 'Share-Link nicht gefunden', 404)
  }
  return row
}

export async function revokeShareToken(
  db: Database,
  eventId: number,
  id: number,
) {
  const existing = await findShareTokenInEventOrThrow(db, eventId, id)
  if (existing.revoked_at !== null) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Share-Link ist bereits aufgehoben.',
      400,
    )
  }
  const now = nowUtc()
  await db
    .update(event_share_tokens)
    .set({ revoked_at: now })
    .where(eq(event_share_tokens.id, id))
  return findShareTokenInEventOrThrow(db, eventId, id)
}

/**
 * Public lookup. Returns the share row + event + agenda items when
 * the token is valid; throws an AppError otherwise. Records the
 * hit and stamps `last_hit_at` so the admin can see whether the
 * link is in use.
 *
 * "Valid" means:
 *   - a row exists for the hash,
 *   - it has not been revoked,
 *   - it has not expired.
 */
export async function resolveShareToken(db: Database, plaintext: string) {
  const tokenHash = await hashToken(plaintext)
  const row = await db
    .select()
    .from(event_share_tokens)
    .where(eq(event_share_tokens.token_hash, tokenHash))
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
  // Load the event + agenda items.
  const event = await db
    .select({
      title: events.title,
      scheduled_date: events.scheduled_date,
      scheduled_time: events.scheduled_time,
      location: events.location,
      agenda: events.agenda,
      slug: events.slug,
    })
    .from(events)
    .where(eq(events.id, row.event_id))
    .get()
  if (!event) {
    // Event was deleted between share creation and lookup.
    throw new AppError('NOT_FOUND', 'Termin nicht gefunden', 404)
  }
  const agendaRows = await db
    .select({
      title: event_agenda_items.title,
      status: event_agenda_items.status,
      sort_order: event_agenda_items.sort_order,
    })
    .from(event_agenda_items)
    .where(eq(event_agenda_items.event_id, row.event_id))
    .orderBy(asc(event_agenda_items.sort_order), asc(event_agenda_items.id))
    .all()

  // Record the hit.
  const now = nowUtc()
  await db.insert(event_share_views).values({
    token_id: row.id,
    viewed_at: now,
  })
  await db
    .update(event_share_tokens)
    .set({ last_hit_at: now })
    .where(eq(event_share_tokens.id, row.id))

  return {
    token: row,
    event,
    agenda_items: agendaRows,
    // The reveal in the public payload is just the label (e.g.
    // "Vorstand" / "Newsletter"); if the admin left it blank we
    // surface the standard "share" phrasing in the UI.
    label: row.label && row.label.length > 0 ? row.label : null,
  }
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
