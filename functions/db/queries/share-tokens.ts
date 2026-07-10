import { asc, desc, eq } from 'drizzle-orm'
import { nowUtc } from '../../_lib/dayjs'
import type { Database } from '../../_lib/db'
import { AppError } from '../../_lib/errors'
import { generateShareToken, hashShareToken } from '../../_lib/share-token'
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
  // The rows from the DB already include the row-level fields. We
  // append a synthetic `token_fingerprint` in the route when we
  // shape the response — the schema has it, but the DB doesn't
  // store it (we don't want any plaintext-derived data on disk).
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
  const plaintext = generateShareToken()
  const tokenHash = await hashShareToken(plaintext)
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

export async function findShareTokenById(db: Database, id: number) {
  const row = await db
    .select()
    .from(event_share_tokens)
    .where(eq(event_share_tokens.id, id))
    .get()
  if (!row) {
    throw new AppError('NOT_FOUND', 'Share-Link nicht gefunden', 404)
  }
  return row
}

export async function revokeShareToken(db: Database, id: number) {
  const existing = await findShareTokenById(db, id)
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
  return findShareTokenById(db, id)
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
  const tokenHash = await hashShareToken(plaintext)
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
 * Same as [`resolveShareToken`](../share-tokens.ts ) but **without**
 * touching `last_hit_at` and without inserting a view row. Used
 * for the upcoming "preview" admin endpoint where we want to render
 * the page the way a recipient would see it but don't want to skew
 * our own analytics.
 */
export async function peekShareToken(db: Database, plaintext: string) {
  const tokenHash = await hashShareToken(plaintext)
  const row = await db
    .select()
    .from(event_share_tokens)
    .where(eq(event_share_tokens.token_hash, tokenHash))
    .get()
  if (!row) {
    throw new AppError('NOT_FOUND', 'Share-Link nicht gefunden', 404)
  }
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
  return { token: row, event, agenda_items: agendaRows, label: null }
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
  // YYYY-MM-DD in UTC. Cheap; we don't need dayjs here.
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
