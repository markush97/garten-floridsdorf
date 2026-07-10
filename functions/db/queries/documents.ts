import { desc, eq, inArray, isNull } from 'drizzle-orm'
import { nowUtc } from '../../_lib/dayjs'
import type { Database } from '../../_lib/db'
import { AppError } from '../../_lib/errors'
import type {
  CreateFolderInput,
  UpdateFolderInput,
} from '../../contracts/document'
import { document_folders, documents } from '../schema'

type FolderRow = typeof document_folders.$inferSelect

async function loadAllFolders(db: Database): Promise<FolderRow[]> {
  return db.select().from(document_folders).all()
}

/**
 * Every folder, flat. Small dataset by construction (a garden
 * association's shared drive), so the "move to…" picker just fetches
 * the whole tree once and builds paths client-side instead of the
 * app driving a second navigation UI inside a dialog.
 */
export async function listAllFolders(db: Database) {
  const folders = await loadAllFolders(db)
  return folders.sort((a, b) => a.name.localeCompare(b.name))
}

/** The folder itself plus every descendant, however deep. */
function collectSubtreeIds(folders: FolderRow[], rootId: number): number[] {
  const childrenByParent = new Map<number, number[]>()
  for (const f of folders) {
    if (f.parent_id === null) continue
    const list = childrenByParent.get(f.parent_id) ?? []
    list.push(f.id)
    childrenByParent.set(f.parent_id, list)
  }
  const result = [rootId]
  const queue = [rootId]
  while (queue.length > 0) {
    const current = queue.shift() as number
    for (const childId of childrenByParent.get(current) ?? []) {
      result.push(childId)
      queue.push(childId)
    }
  }
  return result
}

/** Root-to-leaf ancestor chain, including the folder itself. */
function collectAncestorChain(
  folders: FolderRow[],
  folderId: number,
): FolderRow[] {
  const byId = new Map(folders.map((f) => [f.id, f]))
  const chain: FolderRow[] = []
  let current = byId.get(folderId)
  while (current) {
    chain.unshift(current)
    current =
      current.parent_id !== null ? byId.get(current.parent_id) : undefined
  }
  return chain
}

/** Relative path from `rootId` down to `folderId`, e.g. "Rechnungen/2026". */
function relativePath(
  folders: FolderRow[],
  rootId: number,
  folderId: number,
): string {
  const chain = collectAncestorChain(folders, folderId)
  const rootIndex = chain.findIndex((f) => f.id === rootId)
  return chain
    .slice(rootIndex + 1)
    .map((f) => f.name)
    .join('/')
}

export async function findFolderOrThrow(db: Database, id: number) {
  const row = await db
    .select()
    .from(document_folders)
    .where(eq(document_folders.id, id))
    .get()
  if (!row) {
    throw new AppError('NOT_FOUND', 'Ordner nicht gefunden', 404)
  }
  return row
}

export async function createFolder(
  db: Database,
  input: CreateFolderInput,
  creator: { id: number | null; name: string },
) {
  const parentId = input.parent_id ?? null
  if (parentId !== null) {
    await findFolderOrThrow(db, parentId)
  }
  const inserted = await db
    .insert(document_folders)
    .values({
      name: input.name.trim(),
      parent_id: parentId,
      created_by_user_id: creator.id,
      created_by_name: creator.name,
      created_at: nowUtc(),
    })
    .returning()
  const row = inserted[0]
  if (!row) {
    throw new AppError('INTERNAL_ERROR', 'Fehler beim Anlegen', 500)
  }
  return row
}

export async function updateFolder(
  db: Database,
  id: number,
  input: UpdateFolderInput,
) {
  await findFolderOrThrow(db, id)
  const updates: Partial<typeof document_folders.$inferInsert> = {}
  if (input.name !== undefined) {
    updates.name = input.name.trim()
  }
  if (input.parent_id !== undefined) {
    const nextParentId = input.parent_id
    if (nextParentId === id) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Ein Ordner kann nicht in sich selbst verschoben werden.',
        400,
      )
    }
    if (nextParentId !== null) {
      await findFolderOrThrow(db, nextParentId)
      const allFolders = await loadAllFolders(db)
      const subtreeIds = new Set(collectSubtreeIds(allFolders, id))
      if (subtreeIds.has(nextParentId)) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Ein Ordner kann nicht in einen eigenen Unterordner verschoben werden.',
          400,
        )
      }
    }
    updates.parent_id = nextParentId
  }
  if (Object.keys(updates).length > 0) {
    await db
      .update(document_folders)
      .set(updates)
      .where(eq(document_folders.id, id))
  }
  return findFolderOrThrow(db, id)
}

/**
 * Deletes a folder and everything nested under it — subfolders,
 * documents, and their R2 objects. `document_share_tokens` rows for
 * anything in the subtree cascade away via their FK.
 */
export async function deleteFolder(db: Database, bucket: R2Bucket, id: number) {
  await findFolderOrThrow(db, id)
  const allFolders = await loadAllFolders(db)
  const subtreeIds = collectSubtreeIds(allFolders, id)

  const docsInSubtree = await db
    .select({ id: documents.id, r2_key: documents.r2_key })
    .from(documents)
    .where(inArray(documents.folder_id, subtreeIds))
    .all()

  for (const doc of docsInSubtree) {
    await bucket.delete(doc.r2_key)
  }
  if (docsInSubtree.length > 0) {
    await db.delete(documents).where(
      inArray(
        documents.id,
        docsInSubtree.map((d) => d.id),
      ),
    )
  }
  await db
    .delete(document_folders)
    .where(inArray(document_folders.id, subtreeIds))
}

/**
 * The "browse" view for a folder (or the root when `folderId` is
 * null): its direct child folders and documents, plus the ancestor
 * chain for the breadcrumb.
 */
export async function browseFolder(db: Database, folderId: number | null) {
  const allFolders = await loadAllFolders(db)
  let folder: FolderRow | null = null
  let breadcrumb: FolderRow[] = []
  if (folderId !== null) {
    folder = allFolders.find((f) => f.id === folderId) ?? null
    if (!folder) {
      throw new AppError('NOT_FOUND', 'Ordner nicht gefunden', 404)
    }
    breadcrumb = collectAncestorChain(allFolders, folderId)
  }

  const childFolders = allFolders
    .filter((f) => f.parent_id === folderId)
    .sort((a, b) => a.name.localeCompare(b.name))

  const childDocuments = await db
    .select(publicDocumentColumns)
    .from(documents)
    .where(
      folderId === null
        ? isNull(documents.folder_id)
        : eq(documents.folder_id, folderId),
    )
    .orderBy(desc(documents.created_at))
    .all()

  return {
    folder,
    breadcrumb,
    folders: childFolders,
    documents: childDocuments,
  }
}

/**
 * Every document nested under `folderId`, recursively, each
 * annotated with its path relative to that folder. Used by the
 * public "shared folder" view.
 */
export async function listDocumentsRecursive(db: Database, folderId: number) {
  const allFolders = await loadAllFolders(db)
  const subtreeIds = collectSubtreeIds(allFolders, folderId)
  const rows = await db
    .select(publicDocumentColumns)
    .from(documents)
    .where(inArray(documents.folder_id, subtreeIds))
    .all()
  return rows.map((row) => ({
    ...row,
    path:
      row.folder_id === null
        ? ''
        : relativePath(allFolders, folderId, row.folder_id),
  }))
}

const publicDocumentColumns = {
  id: documents.id,
  title: documents.title,
  filename: documents.filename,
  content_type: documents.content_type,
  size: documents.size,
  description: documents.description,
  folder_id: documents.folder_id,
  uploaded_by_user_id: documents.uploaded_by_user_id,
  uploaded_by_name: documents.uploaded_by_name,
  created_at: documents.created_at,
}

export async function findDocumentOrThrow(db: Database, id: number) {
  const row = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .get()
  if (!row) {
    throw new AppError('NOT_FOUND', 'Dokument nicht gefunden', 404)
  }
  return row
}

export async function addDocument(
  db: Database,
  input: {
    title: string
    filename: string
    content_type: string
    size: number
    r2_key: string
    description: string | null
    folder_id: number | null
    uploaded_by_user_id: number | null
    uploaded_by_name: string
  },
) {
  if (input.folder_id !== null) {
    await findFolderOrThrow(db, input.folder_id)
  }
  const inserted = await db
    .insert(documents)
    .values({ ...input, created_at: nowUtc() })
    .returning()
  const row = inserted[0]
  if (!row) {
    throw new AppError('INTERNAL_ERROR', 'Fehler beim Speichern', 500)
  }
  return row
}

export async function updateDocument(
  db: Database,
  id: number,
  input: {
    title?: string
    description?: string | null
    folder_id?: number | null
  },
) {
  await findDocumentOrThrow(db, id)
  if (input.folder_id !== undefined && input.folder_id !== null) {
    await findFolderOrThrow(db, input.folder_id)
  }
  const updates: Partial<typeof documents.$inferInsert> = {}
  if (input.title !== undefined) updates.title = input.title
  if (input.description !== undefined) updates.description = input.description
  if (input.folder_id !== undefined) updates.folder_id = input.folder_id
  if (Object.keys(updates).length > 0) {
    await db.update(documents).set(updates).where(eq(documents.id, id))
  }
  return findDocumentOrThrow(db, id)
}

export async function deleteDocument(
  db: Database,
  bucket: R2Bucket,
  id: number,
) {
  const row = await findDocumentOrThrow(db, id)
  await bucket.delete(row.r2_key)
  await db.delete(documents).where(eq(documents.id, id))
}
