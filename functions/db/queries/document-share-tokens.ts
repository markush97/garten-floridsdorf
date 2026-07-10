import { and, desc, eq, isNull } from 'drizzle-orm'
import { dayjs, nowUtc } from '../../_lib/dayjs'
import type { Database } from '../../_lib/db'
import { AppError } from '../../_lib/errors'
import { generateToken, hashToken } from '../../_lib/token'
import {
  type DocumentShareTokenRow,
  document_folders,
  document_share_tokens,
  documents,
} from '../schema'
import { findFolderOrThrow, listDocumentsRecursive } from './documents'

type TargetInput = { document_id: number | null; folder_id: number | null }

/** Lists every share token for a document (folder_id IS NULL side excluded). */
export async function listDocumentShareTokens(
  db: Database,
  documentId: number,
): Promise<DocumentShareTokenRow[]> {
  return db
    .select()
    .from(document_share_tokens)
    .where(eq(document_share_tokens.document_id, documentId))
    .orderBy(desc(document_share_tokens.created_at))
    .all()
}

export async function listFolderShareTokens(
  db: Database,
  folderId: number,
): Promise<DocumentShareTokenRow[]> {
  return db
    .select()
    .from(document_share_tokens)
    .where(eq(document_share_tokens.folder_id, folderId))
    .orderBy(desc(document_share_tokens.created_at))
    .all()
}

/**
 * Generates a fresh share token for a document or a folder (exactly
 * one of `target.document_id` / `target.folder_id` must be set) and
 * returns the row together with the plaintext, which is only ever
 * returned once.
 */
export async function createDocumentShareToken(
  db: Database,
  target: TargetInput,
  input: { label?: string | null; expires_at?: string | null },
): Promise<{ row: DocumentShareTokenRow; plaintext: string }> {
  if (target.document_id !== null) {
    const doc = await db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.id, target.document_id))
      .get()
    if (!doc) throw new AppError('NOT_FOUND', 'Dokument nicht gefunden', 404)
  } else if (target.folder_id !== null) {
    await findFolderOrThrow(db, target.folder_id)
  } else {
    throw new AppError('VALIDATION_ERROR', 'Kein Ziel für den Link.', 400)
  }
  const plaintext = generateToken()
  const tokenHash = await hashToken(plaintext)
  const now = nowUtc()
  const inserted = await db
    .insert(document_share_tokens)
    .values({
      document_id: target.document_id,
      folder_id: target.folder_id,
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

async function findShareTokenForTargetOrThrow(
  db: Database,
  target: TargetInput,
  id: number,
) {
  const row = await db
    .select()
    .from(document_share_tokens)
    .where(
      and(
        eq(document_share_tokens.id, id),
        target.document_id !== null
          ? eq(document_share_tokens.document_id, target.document_id)
          : isNull(document_share_tokens.document_id),
        target.folder_id !== null
          ? eq(document_share_tokens.folder_id, target.folder_id)
          : isNull(document_share_tokens.folder_id),
      ),
    )
    .get()
  if (!row) {
    throw new AppError('NOT_FOUND', 'Share-Link nicht gefunden', 404)
  }
  return row
}

export async function revokeDocumentShareToken(
  db: Database,
  target: TargetInput,
  id: number,
) {
  const existing = await findShareTokenForTargetOrThrow(db, target, id)
  if (existing.revoked_at !== null) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Share-Link ist bereits aufgehoben.',
      400,
    )
  }
  await db
    .update(document_share_tokens)
    .set({ revoked_at: nowUtc() })
    .where(eq(document_share_tokens.id, id))
  return findShareTokenForTargetOrThrow(db, target, id)
}

/**
 * Public lookup. Returns the resolved target (a single document, or
 * a folder's recursively-flattened document list) when the token is
 * valid; throws otherwise. Stamps `last_hit_at`.
 */
export async function resolveDocumentShareToken(
  db: Database,
  plaintext: string,
) {
  const tokenHash = await hashToken(plaintext)
  const row = await db
    .select()
    .from(document_share_tokens)
    .where(eq(document_share_tokens.token_hash, tokenHash))
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

  await db
    .update(document_share_tokens)
    .set({ last_hit_at: nowUtc() })
    .where(eq(document_share_tokens.id, row.id))

  if (row.document_id !== null) {
    const doc = await db
      .select({
        id: documents.id,
        title: documents.title,
        filename: documents.filename,
        content_type: documents.content_type,
        size: documents.size,
      })
      .from(documents)
      .where(eq(documents.id, row.document_id))
      .get()
    if (!doc) {
      throw new AppError('NOT_FOUND', 'Dokument nicht gefunden', 404)
    }
    return { token: row, type: 'document' as const, document: doc }
  }

  const folderId = row.folder_id
  if (folderId === null) {
    throw new AppError('NOT_FOUND', 'Share-Link nicht gefunden', 404)
  }
  const folder = await db
    .select({ name: document_folders.name })
    .from(document_folders)
    .where(eq(document_folders.id, folderId))
    .get()
  if (!folder) {
    throw new AppError('NOT_FOUND', 'Ordner nicht gefunden', 404)
  }
  const docs = await listDocumentsRecursive(db, folderId)
  return {
    token: row,
    type: 'folder' as const,
    folder_name: folder.name,
    documents: docs.map((d) => ({
      id: d.id,
      title: d.title,
      filename: d.filename,
      content_type: d.content_type,
      size: d.size,
      path: d.path,
    })),
  }
}

export function isDocumentShareTokenActive(row: {
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
