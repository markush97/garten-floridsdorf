import { z } from 'zod'

export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024

// Documents are broader than event attachments: besides images and
// PDF we accept the common office and plain-text formats a garden
// association actually passes around.
const ALLOWED_DOCUMENT_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/plain',
  'text/csv',
])

export function isAllowedDocumentContentType(contentType: string): boolean {
  return (
    contentType.startsWith('image/') ||
    ALLOWED_DOCUMENT_CONTENT_TYPES.has(contentType)
  )
}

const optionalDescription = z
  .preprocess(
    (v) => (v == null ? '' : v),
    z
      .string()
      .max(2000)
      .transform((v) => v.trim())
      .transform((v) => (v.length === 0 ? null : v)),
  )
  .nullish()

export const documentSchema = z.object({
  id: z.number(),
  title: z.string(),
  filename: z.string(),
  content_type: z.string(),
  size: z.number(),
  description: z.string().nullable(),
  folder_id: z.number().nullable(),
  uploaded_by_user_id: z.number().nullable(),
  uploaded_by_name: z.string(),
  created_at: z.string(),
})

export const updateDocumentInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: optionalDescription,
    folder_id: z.number().int().positive().nullable().optional(),
  })
  .strict()

// ── Folders ─────────────────────────────────────────────────────────────────

export const documentFolderSchema = z.object({
  id: z.number(),
  name: z.string(),
  parent_id: z.number().nullable(),
  created_by_user_id: z.number().nullable(),
  created_by_name: z.string(),
  created_at: z.string(),
})

export const createFolderInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  parent_id: z.number().int().positive().nullable().optional(),
})

export const updateFolderInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    parent_id: z.number().int().positive().nullable().optional(),
  })
  .strict()

/** A breadcrumb entry — just enough to render the path and link back up. */
export const folderBreadcrumbSchema = z.object({
  id: z.number(),
  name: z.string(),
})

/**
 * The "browse" response for a folder (or the root when `folder` is
 * null): the folder's direct child folders and documents, plus the
 * ancestor chain for the breadcrumb.
 */
export const documentBrowseSchema = z.object({
  folder: documentFolderSchema.nullable(),
  breadcrumb: z.array(folderBreadcrumbSchema),
  folders: z.array(documentFolderSchema),
  documents: z.array(documentSchema),
})

// ── Share links (documents and folders) ─────────────────────────────────────

/**
 * A share link for a document or a folder. Exactly one of
 * `document_id` / `folder_id` is set. Mirrors the event share-token
 * shape: the plaintext is only ever returned once, on creation.
 */
export const documentShareTokenSchema = z.object({
  id: z.number(),
  document_id: z.number().nullable(),
  folder_id: z.number().nullable(),
  token_fingerprint: z.string(),
  label: z.string().nullable(),
  created_at: z.string(),
  expires_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
  last_hit_at: z.string().nullable(),
  is_active: z.boolean(),
})

export const createDocumentShareTokenInputSchema = z
  .object({
    label: z
      .union([z.string().max(200), z.null()])
      .transform((v) => (v == null ? null : v.trim()))
      .transform((v) => (v == null || v.length === 0 ? null : v))
      .optional(),
    // `YYYY-MM-DD` UTC, or null for "never expires".
    expires_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum im Format YYYY-MM-DD')
      .nullable()
      .optional(),
  })
  .strict()

export const createDocumentShareTokenResponseSchema = z.object({
  token: documentShareTokenSchema,
  plaintext: z.string().regex(/^[A-Za-z0-9_-]+$/),
})

/** A single file inside a shared folder's flattened listing. */
export const sharedDocumentSchema = z.object({
  id: z.number(),
  title: z.string(),
  filename: z.string(),
  content_type: z.string(),
  size: z.number(),
  // Folder path relative to the shared folder, e.g. "Rechnungen/2026".
  // Empty string for a document directly inside the shared folder.
  path: z.string(),
})

/**
 * Public, unauthenticated payload for `GET /api/share/documents/:token`.
 * A document token resolves to a single file; a folder token
 * resolves to every document nested under that folder.
 */
export const sharedDocumentTargetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('document'), document: sharedDocumentSchema }),
  z.object({
    type: z.literal('folder'),
    folder_name: z.string(),
    documents: z.array(sharedDocumentSchema),
  }),
])

export type Document = z.infer<typeof documentSchema>
export type UpdateDocumentInput = z.infer<typeof updateDocumentInputSchema>
export type DocumentFolder = z.infer<typeof documentFolderSchema>
export type FolderBreadcrumb = z.infer<typeof folderBreadcrumbSchema>
export type CreateFolderInput = z.infer<typeof createFolderInputSchema>
export type UpdateFolderInput = z.infer<typeof updateFolderInputSchema>
export type DocumentBrowse = z.infer<typeof documentBrowseSchema>
export type DocumentShareToken = z.infer<typeof documentShareTokenSchema>
export type CreateDocumentShareTokenInput = z.infer<
  typeof createDocumentShareTokenInputSchema
>
export type CreateDocumentShareTokenResponse = z.infer<
  typeof createDocumentShareTokenResponseSchema
>
export type SharedDocument = z.infer<typeof sharedDocumentSchema>
export type SharedDocumentTarget = z.infer<typeof sharedDocumentTargetSchema>
