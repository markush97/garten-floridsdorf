import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import { queryKeys } from '~/lib/query-keys'
import type {
  CreateDocumentShareTokenInput,
  CreateDocumentShareTokenResponse,
  CreateFolderInput,
  Document,
  DocumentBrowse,
  DocumentFolder,
  DocumentShareToken,
  SharedDocumentTarget,
  UpdateDocumentInput,
  UpdateFolderInput,
} from '~func/contracts/document'

function retryExceptAuthErrors(count: number, err: unknown): boolean {
  const status = (err as { status?: number }).status
  if (status === 401 || status === 403 || status === 404) return false
  return count < 1
}

/**
 * Plain (non-react-query) fetch for the public, no-auth share page —
 * mirrors `fetchSharedEvent`. Returns `null` on any failure so the
 * page can render a single "link invalid" state regardless of cause
 * (not found, expired, revoked).
 */
export async function fetchSharedDocumentTarget(
  token: string,
): Promise<SharedDocumentTarget | null> {
  if (!token) return null
  try {
    const res = await fetch(`/api/share/documents/${encodeURIComponent(token)}`)
    if (!res.ok) return null
    return (await res.json()) as SharedDocumentTarget
  } catch {
    return null
  }
}

// ── Browsing ─────────────────────────────────────────────────────────────

export function useDocumentBrowse(folderId: number | null) {
  return useQuery({
    queryKey: queryKeys.documents.browse(folderId),
    queryFn: () =>
      apiClient<DocumentBrowse>(
        folderId === null ? '/documents' : `/documents?folder_id=${folderId}`,
      ),
    retry: retryExceptAuthErrors,
  })
}

export function useAllFolders() {
  return useQuery({
    queryKey: queryKeys.documents.folders,
    queryFn: () => apiClient<DocumentFolder[]>('/folders'),
    retry: retryExceptAuthErrors,
  })
}

// ── Folders ──────────────────────────────────────────────────────────────

function invalidateBrowse(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all })
}

export function useCreateFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFolderInput) =>
      apiClient<DocumentFolder>('/folders', { method: 'POST', body: data }),
    onSuccess: () => invalidateBrowse(queryClient),
  })
}

export function useUpdateFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateFolderInput }) =>
      apiClient<DocumentFolder>(`/folders/${id}`, {
        method: 'PATCH',
        body: data,
      }),
    onSuccess: () => invalidateBrowse(queryClient),
  })
}

export function useDeleteFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<{ ok: boolean }>(`/folders/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateBrowse(queryClient),
  })
}

// ── Documents ────────────────────────────────────────────────────────────

export function useUploadDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      file: File
      title: string
      description: string
      folder_id: number | null
    }) => {
      const formData = new FormData()
      formData.append('file', input.file)
      formData.append('title', input.title)
      formData.append('description', input.description)
      if (input.folder_id !== null) {
        formData.append('folder_id', String(input.folder_id))
      }
      return apiClient<Document>('/documents', {
        method: 'POST',
        body: formData,
      })
    },
    onSuccess: () => invalidateBrowse(queryClient),
  })
}

export function useUpdateDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateDocumentInput }) =>
      apiClient<Document>(`/documents/${id}`, {
        method: 'PATCH',
        body: data,
      }),
    onSuccess: () => invalidateBrowse(queryClient),
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<{ ok: boolean }>(`/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateBrowse(queryClient),
  })
}

// ── Share links ──────────────────────────────────────────────────────────

export function useDocumentShareTokens(documentId: number) {
  return useQuery({
    queryKey: queryKeys.documents.shareTokens(documentId),
    queryFn: () =>
      apiClient<DocumentShareToken[]>(`/documents/${documentId}/share-tokens`),
  })
}

export function useCreateDocumentShareToken(documentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateDocumentShareTokenInput) =>
      apiClient<CreateDocumentShareTokenResponse>(
        `/documents/${documentId}/share-tokens`,
        { method: 'POST', body: data },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documents.shareTokens(documentId),
      })
    },
  })
}

export function useRevokeDocumentShareToken(documentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tokenId: number) =>
      apiClient<DocumentShareToken>(
        `/documents/${documentId}/share-tokens/${tokenId}/revoke`,
        { method: 'POST', body: {} },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documents.shareTokens(documentId),
      })
    },
  })
}

export function useFolderShareTokens(folderId: number) {
  return useQuery({
    queryKey: queryKeys.documents.folderShareTokens(folderId),
    queryFn: () =>
      apiClient<DocumentShareToken[]>(`/folders/${folderId}/share-tokens`),
  })
}

export function useCreateFolderShareToken(folderId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateDocumentShareTokenInput) =>
      apiClient<CreateDocumentShareTokenResponse>(
        `/folders/${folderId}/share-tokens`,
        { method: 'POST', body: data },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documents.folderShareTokens(folderId),
      })
    },
  })
}

export function useRevokeFolderShareToken(folderId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tokenId: number) =>
      apiClient<DocumentShareToken>(
        `/folders/${folderId}/share-tokens/${tokenId}/revoke`,
        { method: 'POST', body: {} },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documents.folderShareTokens(folderId),
      })
    },
  })
}
