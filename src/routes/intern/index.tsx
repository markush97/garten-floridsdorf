import { createFileRoute, useNavigate } from '@tanstack/react-router'
import DocumentsPage from '~/components/intern/DocumentsPage'

type DocumentsSearch = {
  folder?: number
}

export const Route = createFileRoute('/intern/')({
  validateSearch: (search: Record<string, unknown>): DocumentsSearch => {
    const raw = search.folder
    const parsed =
      typeof raw === 'string'
        ? Number(raw)
        : typeof raw === 'number'
          ? raw
          : Number.NaN
    return {
      folder: Number.isInteger(parsed) && parsed > 0 ? parsed : undefined,
    }
  },
  component: DocumentsRoute,
})

function DocumentsRoute() {
  const { folder } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <DocumentsPage
      folderId={folder ?? null}
      onFolderChange={(folderId) => {
        void navigate({ search: folderId === null ? {} : { folder: folderId } })
      }}
    />
  )
}
