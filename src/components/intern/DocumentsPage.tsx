import {
  ArrowRight01Icon,
  Delete02Icon,
  Edit01Icon,
  Folder01Icon,
  FolderAddIcon,
  Home01Icon,
  Share01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Navigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { SelectField, toIsoDate } from '~/components/admin/form-ui'
import { fileIcon, formatFileSize } from '~/lib/file-helpers'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import { useMe } from '~/services/auth.service'
import {
  useAllFolders,
  useCreateDocumentShareToken,
  useCreateFolder,
  useCreateFolderShareToken,
  useDeleteDocument,
  useDeleteFolder,
  useDocumentBrowse,
  useDocumentShareTokens,
  useFolderShareTokens,
  useRevokeDocumentShareToken,
  useRevokeFolderShareToken,
  useUpdateDocument,
  useUpdateFolder,
  useUploadDocument,
} from '~/services/document.service'
import { Button } from '~/ui/button'
import { DatePicker } from '~/ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/ui/dialog'
import { Input } from '~/ui/input'
import { Label } from '~/ui/label'
import type { SessionUser } from '~func/contracts/auth'
import type {
  CreateDocumentShareTokenInput,
  CreateDocumentShareTokenResponse,
  Document,
  DocumentFolder,
  DocumentShareToken,
  FolderBreadcrumb,
} from '~func/contracts/document'
import MemberShell from './MemberShell'

export default function DocumentsPage({
  folderId,
  onFolderChange,
}: {
  folderId: number | null
  onFolderChange: (folderId: number | null) => void
}) {
  const { data: me, isPending, isError } = useMe()

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8f3e7_0%,#f2ecdc_100%)] text-sm text-forest-700/60">
        Wird geladen …
      </div>
    )
  }
  if (isError || !me) {
    return <Navigate to="/login" />
  }
  return (
    <MemberShell me={me}>
      <FileExplorer
        folderId={folderId}
        me={me}
        onFolderChange={onFolderChange}
      />
    </MemberShell>
  )
}

/** Payload carried by the browser's native drag-and-drop `dataTransfer`. */
type DragPayload = { type: 'document' | 'folder'; id: number; name: string }

const DRAG_MIME = 'application/x-garten-document'

function setDragPayload(dataTransfer: DataTransfer, payload: DragPayload) {
  dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
  dataTransfer.effectAllowed = 'move'
}

function readDragPayload(dataTransfer: DataTransfer): DragPayload | null {
  const raw = dataTransfer.getData(DRAG_MIME)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      (parsed.type === 'document' || parsed.type === 'folder') &&
      typeof parsed.id === 'number' &&
      typeof parsed.name === 'string'
    ) {
      return parsed as DragPayload
    }
  } catch {
    return null
  }
  return null
}

type DeleteTarget =
  | { type: 'document'; document: Document }
  | { type: 'folder'; folder: DocumentFolder }
type RenameTarget =
  | { type: 'document'; document: Document }
  | { type: 'folder'; folder: DocumentFolder }
type MoveTarget =
  | { type: 'document'; document: Document }
  | { type: 'folder'; folder: DocumentFolder }
type ShareTarget =
  | { type: 'document'; document: Document }
  | { type: 'folder'; folder: DocumentFolder }

function FileExplorer({
  me,
  folderId,
  onFolderChange,
}: {
  me: SessionUser
  folderId: number | null
  onFolderChange: (folderId: number | null) => void
}) {
  const [search, setSearch] = useState('')
  const { data: browse, isPending, isError } = useDocumentBrowse(folderId)
  const { mutate: deleteDocument } = useDeleteDocument()
  const { mutate: deleteFolder } = useDeleteFolder()
  const { mutate: moveDocument } = useUpdateDocument()
  const { mutate: moveFolder } = useUpdateFolder()

  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null)
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)

  const normalizedSearch = search.trim().toLowerCase()
  const filteredFolders = (browse?.folders ?? []).filter(
    (f) =>
      normalizedSearch.length === 0 ||
      f.name.toLowerCase().includes(normalizedSearch),
  )
  const filteredDocuments = (browse?.documents ?? []).filter(
    (d) =>
      normalizedSearch.length === 0 ||
      d.title.toLowerCase().includes(normalizedSearch) ||
      d.filename.toLowerCase().includes(normalizedSearch) ||
      d.uploaded_by_name.toLowerCase().includes(normalizedSearch),
  )

  function canManage(ownerUserId: number | null): boolean {
    return (
      me.role === 'admin' || (me.user_id !== null && ownerUserId === me.user_id)
    )
  }

  function moveItem(payload: DragPayload, targetFolderId: number | null) {
    if (payload.type === 'folder') {
      if (payload.id === targetFolderId) return
      moveFolder(
        { id: payload.id, data: { parent_id: targetFolderId } },
        {
          onSuccess: () => toast.success('Verschoben.'),
          onError: (err) =>
            toast.error(
              (err as { message?: string }).message ??
                'Verschieben fehlgeschlagen.',
            ),
        },
      )
    } else {
      moveDocument(
        { id: payload.id, data: { folder_id: targetFolderId } },
        {
          onSuccess: () => toast.success('Verschoben.'),
          onError: () => toast.error('Verschieben fehlgeschlagen.'),
        },
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl text-forest-900">Dokumente</h1>
        <p className="text-sm text-forest-700/70">
          Statuten, Protokolle, Formulare — alles, was der Verein gemeinsam
          braucht.
        </p>
      </div>

      <Breadcrumb
        breadcrumb={browse?.breadcrumb ?? []}
        onDropItem={moveItem}
        onNavigate={onFolderChange}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative max-w-xs flex-1">
          <Input
            aria-label="Dokumente durchsuchen"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen …"
            type="search"
            value={search}
          />
        </div>
        <Button
          onClick={() => setNewFolderOpen(true)}
          size="sm"
          type="button"
          variant="outline"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={FolderAddIcon}
            size={14}
            strokeWidth={1.8}
          />
          Neuer Ordner
        </Button>
      </div>

      <UploadCard folderId={folderId} />

      {isPending ? (
        <p className="py-8 text-center text-sm text-forest-700/60">
          Wird geladen …
        </p>
      ) : isError ? (
        <p className="py-8 text-center text-sm text-beet-700">
          Inhalt konnte nicht geladen werden.
        </p>
      ) : filteredFolders.length === 0 && filteredDocuments.length === 0 ? (
        <p className="py-8 text-center text-sm text-forest-700/60">
          {normalizedSearch.length > 0
            ? 'Nichts gefunden.'
            : 'Noch nichts hier. Leg einen Ordner an oder lade eine Datei hoch.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {filteredFolders.map((folder) => (
            <FolderRow
              canManage={canManage(folder.created_by_user_id)}
              folder={folder}
              key={`folder-${folder.id}`}
              onDelete={() => setDeleteTarget({ type: 'folder', folder })}
              onDropItem={(payload) => moveItem(payload, folder.id)}
              onMove={() => setMoveTarget({ type: 'folder', folder })}
              onOpen={() => onFolderChange(folder.id)}
              onRename={() => setRenameTarget({ type: 'folder', folder })}
              onShare={() => setShareTarget({ type: 'folder', folder })}
            />
          ))}
          {filteredDocuments.map((doc) => (
            <DocumentRow
              canManage={canManage(doc.uploaded_by_user_id)}
              doc={doc}
              key={`doc-${doc.id}`}
              onDelete={() =>
                setDeleteTarget({ type: 'document', document: doc })
              }
              onMove={() => setMoveTarget({ type: 'document', document: doc })}
              onRename={() =>
                setRenameTarget({ type: 'document', document: doc })
              }
              onShare={() =>
                setShareTarget({ type: 'document', document: doc })
              }
            />
          ))}
        </ul>
      )}

      <NewFolderDialog
        onOpenChange={setNewFolderOpen}
        open={newFolderOpen}
        parentId={folderId}
      />
      <RenameDialog
        key={
          renameTarget
            ? `${renameTarget.type}-${renameTarget.type === 'folder' ? renameTarget.folder.id : renameTarget.document.id}`
            : 'none'
        }
        onOpenChange={(open) => !open && setRenameTarget(null)}
        target={renameTarget}
      />
      <MoveDialog
        onOpenChange={(open) => !open && setMoveTarget(null)}
        target={moveTarget}
      />
      <ShareDialog
        onOpenChange={(open) => !open && setShareTarget(null)}
        target={shareTarget}
      />
      <Dialog
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        open={deleteTarget !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.type === 'folder' ? 'Ordner' : 'Dokument'} löschen?
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === 'folder' ? (
                <>
                  <span className="font-semibold text-forest-900">
                    „{deleteTarget.folder.name}“
                  </span>{' '}
                  und alle darin enthaltenen Ordner und Dateien werden endgültig
                  gelöscht.
                </>
              ) : deleteTarget?.type === 'document' ? (
                <>
                  <span className="font-semibold text-forest-900">
                    „{deleteTarget.document.title}“
                  </span>{' '}
                  wird endgültig gelöscht.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeleteTarget(null)} variant="outline">
              Abbrechen
            </Button>
            <Button
              className="bg-beet-700 text-white hover:bg-beet-700/90"
              onClick={() => {
                if (!deleteTarget) return
                if (deleteTarget.type === 'folder') {
                  deleteFolder(deleteTarget.folder.id, {
                    onSuccess: () => toast.success('Ordner gelöscht.'),
                    onError: (err) =>
                      toast.error(
                        (err as { message?: string }).message ??
                          'Fehler beim Löschen.',
                      ),
                  })
                } else {
                  deleteDocument(deleteTarget.document.id, {
                    onSuccess: () => toast.success('Dokument gelöscht.'),
                    onError: (err) =>
                      toast.error(
                        (err as { message?: string }).message ??
                          'Fehler beim Löschen.',
                      ),
                  })
                }
                setDeleteTarget(null)
              }}
            >
              Endgültig löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Breadcrumb({
  breadcrumb,
  onNavigate,
  onDropItem,
}: {
  breadcrumb: FolderBreadcrumb[]
  onNavigate: (folderId: number | null) => void
  onDropItem: (payload: DragPayload, targetFolderId: number | null) => void
}) {
  return (
    <nav
      aria-label="Ordnerpfad"
      className="flex flex-wrap items-center gap-1 text-sm text-forest-700/80"
    >
      <BreadcrumbButton
        folderId={null}
        onDropItem={onDropItem}
        onNavigate={onNavigate}
      >
        <HugeiconsIcon
          aria-hidden="true"
          icon={Home01Icon}
          size={14}
          strokeWidth={1.8}
        />
        Dokumente
      </BreadcrumbButton>
      {breadcrumb.map((folder) => (
        <span className="flex items-center gap-1" key={folder.id}>
          <HugeiconsIcon
            aria-hidden="true"
            className="text-forest-700/40"
            icon={ArrowRight01Icon}
            size={12}
            strokeWidth={2}
          />
          <BreadcrumbButton
            folderId={folder.id}
            onDropItem={onDropItem}
            onNavigate={onNavigate}
          >
            {folder.name}
          </BreadcrumbButton>
        </span>
      ))}
    </nav>
  )
}

function BreadcrumbButton({
  folderId,
  onNavigate,
  onDropItem,
  children,
}: {
  folderId: number | null
  onNavigate: (folderId: number | null) => void
  onDropItem: (payload: DragPayload, targetFolderId: number | null) => void
  children: React.ReactNode
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  return (
    <button
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium hover:bg-forest-900/5 hover:text-forest-900 ${
        isDragOver
          ? 'bg-leaf-500/15 text-forest-900 ring-2 ring-leaf-500/50'
          : ''
      }`}
      onClick={() => onNavigate(folderId)}
      onDragEnter={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragOver(false)
        const payload = readDragPayload(e.dataTransfer)
        if (payload) onDropItem(payload, folderId)
      }}
      type="button"
    >
      {children}
    </button>
  )
}

function FolderRow({
  folder,
  canManage,
  onOpen,
  onRename,
  onMove,
  onShare,
  onDelete,
  onDropItem,
}: {
  folder: DocumentFolder
  canManage: boolean
  onOpen: () => void
  onRename: () => void
  onMove: () => void
  onShare: () => void
  onDelete: () => void
  onDropItem: (payload: DragPayload) => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  return (
    <li
      className={`rounded-[1.25rem] bg-white/75 p-4 shadow-[0_4px_16px_rgba(31,61,43,0.06)] ring-1 ring-inset backdrop-blur transition sm:p-5 ${
        isDragOver ? 'bg-leaf-500/10 ring-2 ring-leaf-500/50' : 'ring-white/40'
      }`}
      onDragEnter={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragOver(false)
        const payload = readDragPayload(e.dataTransfer)
        if (payload) onDropItem(payload)
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          className="flex min-w-0 items-center gap-3 text-left"
          draggable
          onClick={onOpen}
          onDragStart={(e) =>
            setDragPayload(e.dataTransfer, {
              type: 'folder',
              id: folder.id,
              name: folder.name,
            })
          }
          type="button"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-wood-600/10 text-wood-600">
            <HugeiconsIcon
              aria-hidden="true"
              icon={Folder01Icon}
              size={22}
              strokeWidth={1.6}
            />
          </span>
          <span className="truncate font-medium text-forest-900">
            {folder.name}
          </span>
        </button>
        <RowActions
          canManage={canManage}
          onDelete={onDelete}
          onMove={onMove}
          onRename={onRename}
          onShare={onShare}
        />
      </div>
    </li>
  )
}

function DocumentRow({
  doc,
  canManage,
  onRename,
  onMove,
  onShare,
  onDelete,
}: {
  doc: Document
  canManage: boolean
  onRename: () => void
  onMove: () => void
  onShare: () => void
  onDelete: () => void
}) {
  const uploadedAt = dayjs
    .utc(doc.created_at)
    .tz(DEFAULT_TIMEZONE)
    .format('DD.MM.YYYY')
  return (
    <li className="rounded-[1.25rem] bg-white/75 p-4 shadow-[0_4px_16px_rgba(31,61,43,0.06)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          className="flex min-w-0 cursor-grab items-start gap-3 text-left"
          draggable
          onDragStart={(e) =>
            setDragPayload(e.dataTransfer, {
              type: 'document',
              id: doc.id,
              name: doc.title,
            })
          }
          type="button"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-900/5 text-forest-700">
            <HugeiconsIcon
              aria-hidden="true"
              icon={fileIcon(doc.content_type)}
              size={22}
              strokeWidth={1.6}
            />
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="truncate font-medium text-forest-900">{doc.title}</p>
            <p className="truncate text-xs text-forest-700/70">
              {doc.filename} · {formatFileSize(doc.size)} · {uploadedAt} · von{' '}
              {doc.uploaded_by_name}
            </p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <Button asChild className="text-xs" size="sm" variant="outline">
            <a href={`/api/documents/${doc.id}/download`}>Herunterladen</a>
          </Button>
          <RowActions
            canManage={canManage}
            onDelete={onDelete}
            onMove={onMove}
            onRename={onRename}
            onShare={onShare}
          />
        </div>
      </div>
    </li>
  )
}

function RowActions({
  canManage,
  onRename,
  onMove,
  onShare,
  onDelete,
}: {
  canManage: boolean
  onRename: () => void
  onMove: () => void
  onShare: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex shrink-0 flex-wrap gap-1">
      <Button
        aria-label="Umbenennen"
        onClick={onRename}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <HugeiconsIcon
          aria-hidden="true"
          icon={Edit01Icon}
          size={16}
          strokeWidth={1.6}
        />
      </Button>
      <Button
        aria-label="Verschieben"
        onClick={onMove}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <HugeiconsIcon
          aria-hidden="true"
          icon={ArrowRight01Icon}
          size={16}
          strokeWidth={1.6}
        />
      </Button>
      <Button
        aria-label="Teilen"
        onClick={onShare}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <HugeiconsIcon
          aria-hidden="true"
          icon={Share01Icon}
          size={16}
          strokeWidth={1.6}
        />
      </Button>
      {canManage && (
        <Button
          aria-label="Löschen"
          className="text-beet-700 hover:bg-beet-700/10 hover:text-beet-700"
          onClick={onDelete}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={Delete02Icon}
            size={16}
            strokeWidth={1.6}
          />
        </Button>
      )}
    </div>
  )
}

function UploadCard({ folderId }: { folderId: number | null }) {
  const { mutate: uploadDocument, isPending } = useUploadDocument()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [fileInputKey, setFileInputKey] = useState(0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      toast.error('Bitte zuerst eine Datei auswählen.')
      return
    }
    uploadDocument(
      { file, title: title.trim(), description: '', folder_id: folderId },
      {
        onSuccess: () => {
          toast.success('Dokument hochgeladen.')
          setFile(null)
          setTitle('')
          setFileInputKey((k) => k + 1)
        },
        onError: (err) =>
          toast.error(
            (err as { message?: string }).message ?? 'Upload fehlgeschlagen.',
          ),
      },
    )
  }

  return (
    <form
      className="space-y-4 rounded-[1.25rem] bg-white/75 p-4 shadow-[0_4px_16px_rgba(31,61,43,0.06)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-5"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="document-file">Datei</Label>
          <Input
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.txt,.csv"
            id="document-file"
            key={fileInputKey}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            type="file"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="document-title">Titel (optional)</Label>
          <Input
            id="document-title"
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. Protokoll Frühjahrsversammlung"
            value={title}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-forest-700/60">
          PDF, Bilder, Office- und Textdateien bis 20 MB.
        </p>
        <Button disabled={isPending || !file} type="submit">
          {isPending ? 'Wird hochgeladen …' : 'Hochladen'}
        </Button>
      </div>
    </form>
  )
}

function NewFolderDialog({
  open,
  onOpenChange,
  parentId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  parentId: number | null
}) {
  const { mutate: createFolder, isPending } = useCreateFolder()
  const [name, setName] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Bitte einen Namen eingeben.')
      return
    }
    createFolder(
      { name: name.trim(), parent_id: parentId },
      {
        onSuccess: () => {
          toast.success('Ordner angelegt.')
          setName('')
          onOpenChange(false)
        },
        onError: (err) =>
          toast.error(
            (err as { message?: string }).message ?? 'Anlegen fehlgeschlagen.',
          ),
      },
    )
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Neuer Ordner</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="new-folder-name">Name</Label>
            <Input
              autoFocus
              id="new-folder-name"
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Rechnungen"
              value={name}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Abbrechen
            </Button>
            <Button disabled={isPending} type="submit">
              {isPending ? 'Wird angelegt …' : 'Anlegen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RenameDialog({
  target,
  onOpenChange,
}: {
  target: RenameTarget | null
  onOpenChange: (open: boolean) => void
}) {
  const { mutate: updateDocument, isPending: isSavingDocument } =
    useUpdateDocument()
  const { mutate: updateFolder, isPending: isSavingFolder } = useUpdateFolder()
  const initialName =
    target?.type === 'folder'
      ? target.folder.name
      : (target?.document.title ?? '')
  const [name, setName] = useState(initialName)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!target || !name.trim()) return
    if (target.type === 'folder') {
      updateFolder(
        { id: target.folder.id, data: { name: name.trim() } },
        {
          onSuccess: () => {
            toast.success('Umbenannt.')
            onOpenChange(false)
          },
          onError: () => toast.error('Umbenennen fehlgeschlagen.'),
        },
      )
    } else {
      updateDocument(
        { id: target.document.id, data: { title: name.trim() } },
        {
          onSuccess: () => {
            toast.success('Umbenannt.')
            onOpenChange(false)
          },
          onError: () => toast.error('Umbenennen fehlgeschlagen.'),
        },
      )
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={target !== null}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {target?.type === 'folder' ? 'Ordner' : 'Dokument'} umbenennen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="rename-name">Name</Label>
            <Input
              autoFocus
              id="rename-name"
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
              value={name}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Abbrechen
            </Button>
            <Button disabled={isSavingDocument || isSavingFolder} type="submit">
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Root-to-leaf path string for a folder, e.g. "Rechnungen / 2026". */
function folderPath(folders: DocumentFolder[], folder: DocumentFolder): string {
  const byId = new Map(folders.map((f) => [f.id, f]))
  const chain: string[] = []
  let current: DocumentFolder | undefined = folder
  while (current) {
    chain.unshift(current.name)
    current =
      current.parent_id !== null ? byId.get(current.parent_id) : undefined
  }
  return chain.join(' / ')
}

function MoveDialog({
  target,
  onOpenChange,
}: {
  target: MoveTarget | null
  onOpenChange: (open: boolean) => void
}) {
  const { data: folders } = useAllFolders()
  const { mutate: updateDocument, isPending: isSavingDocument } =
    useUpdateDocument()
  const { mutate: updateFolder, isPending: isSavingFolder } = useUpdateFolder()
  const [destination, setDestination] = useState<number | ''>('')

  const options = (folders ?? [])
    // A folder can't be moved into itself.
    .filter((f) => !(target?.type === 'folder' && f.id === target.folder.id))
    .map((f) => ({ id: f.id, path: folderPath(folders ?? [], f) }))
    .sort((a, b) => a.path.localeCompare(b.path))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!target) return
    const folderId = destination === '' ? null : destination
    if (target.type === 'folder') {
      updateFolder(
        { id: target.folder.id, data: { parent_id: folderId } },
        {
          onSuccess: () => {
            toast.success('Verschoben.')
            onOpenChange(false)
          },
          onError: (err) =>
            toast.error(
              (err as { message?: string }).message ??
                'Verschieben fehlgeschlagen.',
            ),
        },
      )
    } else {
      updateDocument(
        { id: target.document.id, data: { folder_id: folderId } },
        {
          onSuccess: () => {
            toast.success('Verschoben.')
            onOpenChange(false)
          },
          onError: () => toast.error('Verschieben fehlgeschlagen.'),
        },
      )
    }
  }

  return (
    <Dialog
      onOpenChange={onOpenChange}
      open={target !== null}
      key={
        target
          ? `${target.type}-${target.type === 'folder' ? target.folder.id : target.document.id}`
          : 'none'
      }
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {target?.type === 'folder'
                ? target.folder.name
                : target?.document.title}{' '}
              verschieben
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="move-destination">Zielordner</Label>
            <SelectField
              id="move-destination"
              onChange={(e) =>
                setDestination(
                  e.target.value === '' ? '' : Number(e.target.value),
                )
              }
              value={destination}
            >
              <option value="">Dokumente (Hauptebene)</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.path}
                </option>
              ))}
            </SelectField>
          </div>
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Abbrechen
            </Button>
            <Button disabled={isSavingDocument || isSavingFolder} type="submit">
              Verschieben
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ShareDialog({
  target,
  onOpenChange,
}: {
  target: ShareTarget | null
  onOpenChange: (open: boolean) => void
}) {
  if (!target) {
    return <Dialog onOpenChange={onOpenChange} open={false} />
  }
  return target.type === 'document' ? (
    <DocumentShareDialogBody
      documentId={target.document.id}
      onOpenChange={onOpenChange}
      title={target.document.title}
    />
  ) : (
    <FolderShareDialogBody
      folderId={target.folder.id}
      onOpenChange={onOpenChange}
      title={target.folder.name}
    />
  )
}

function DocumentShareDialogBody({
  documentId,
  title,
  onOpenChange,
}: {
  documentId: number
  title: string
  onOpenChange: (open: boolean) => void
}) {
  const { data: tokens } = useDocumentShareTokens(documentId)
  const { mutate: createToken, isPending: isCreating } =
    useCreateDocumentShareToken(documentId)
  const { mutate: revokeToken } = useRevokeDocumentShareToken(documentId)
  return (
    <ShareDialogFrame
      createToken={createToken}
      isCreating={isCreating}
      onOpenChange={onOpenChange}
      revokeToken={revokeToken}
      title={title}
      tokens={tokens ?? []}
    />
  )
}

function FolderShareDialogBody({
  folderId,
  title,
  onOpenChange,
}: {
  folderId: number
  title: string
  onOpenChange: (open: boolean) => void
}) {
  const { data: tokens } = useFolderShareTokens(folderId)
  const { mutate: createToken, isPending: isCreating } =
    useCreateFolderShareToken(folderId)
  const { mutate: revokeToken } = useRevokeFolderShareToken(folderId)
  return (
    <ShareDialogFrame
      createToken={createToken}
      isCreating={isCreating}
      onOpenChange={onOpenChange}
      revokeToken={revokeToken}
      title={title}
      tokens={tokens ?? []}
    />
  )
}

type CreateTokenMutate = (
  input: CreateDocumentShareTokenInput,
  callbacks: {
    onSuccess: (res: CreateDocumentShareTokenResponse) => void
    onError: (err: unknown) => void
  },
) => void

function ShareDialogFrame({
  title,
  tokens,
  isCreating,
  createToken,
  revokeToken,
  onOpenChange,
}: {
  title: string
  tokens: DocumentShareToken[]
  isCreating: boolean
  createToken: CreateTokenMutate
  revokeToken: (tokenId: number) => void
  onOpenChange: (open: boolean) => void
}) {
  const [label, setLabel] = useState('')
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(
    dayjs().add(30, 'day').toDate(),
  )
  const [revealed, setRevealed] = useState<string | null>(null)

  function origin(): string {
    if (typeof window === 'undefined') return ''
    return window.location.origin
  }

  function handleCreate() {
    createToken(
      {
        label: label.trim() ? label.trim() : null,
        expires_at: expiresAt ? toIsoDate(expiresAt) : null,
      },
      {
        onSuccess: (res) => {
          setRevealed(`${origin()}/dokumente/${res.plaintext}`)
          setLabel('')
          toast.success('Share-Link erstellt.')
        },
        onError: (err) =>
          toast.error(
            (err as { message?: string }).message ??
              'Erstellen fehlgeschlagen.',
          ),
      },
    )
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>„{title}“ teilen</DialogTitle>
          <DialogDescription>
            Wer den Link hat, kann ohne Anmeldung darauf zugreifen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 rounded-[1rem] bg-forest-900/4 p-3 ring-1 ring-inset ring-forest-900/8 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="share-label">Label (optional)</Label>
              <Input
                id="share-label"
                maxLength={200}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="z. B. „Kassier“"
                value={label}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gültig bis (optional)</Label>
              <DatePicker
                onChange={setExpiresAt}
                placeholder="Läuft nie ab"
                value={expiresAt}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              disabled={isCreating}
              onClick={handleCreate}
              size="sm"
              type="button"
            >
              {isCreating ? 'Wird erstellt …' : 'Link erzeugen'}
            </Button>
          </div>

          {revealed && (
            <div className="space-y-2 rounded-[1rem] bg-leaf-500/8 p-3 ring-1 ring-inset ring-leaf-500/30">
              <p className="text-xs text-forest-700/80">
                Der Link wird nur einmal angezeigt — jetzt kopieren.
              </p>
              <div className="flex items-stretch gap-2">
                <Input
                  aria-label="Share-Link"
                  onFocus={(e) => e.currentTarget.select()}
                  readOnly
                  value={revealed}
                />
                <Button
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(revealed)
                      .then(() => toast.success('Kopiert.'))
                      .catch(() => toast.error('Kopieren fehlgeschlagen.'))
                  }}
                  size="sm"
                  type="button"
                >
                  Kopieren
                </Button>
              </div>
            </div>
          )}

          {tokens.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-forest-900">
                Aktive Links
              </p>
              <ul className="space-y-2">
                {tokens.map((t) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] bg-white/65 p-3 ring-1 ring-inset ring-forest-900/8"
                    key={t.id}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-forest-900/5 px-1.5 py-0.5 font-mono text-xs text-forest-900">
                          {t.token_fingerprint}…
                        </code>
                        <span
                          className={
                            t.is_active
                              ? 'rounded-full bg-leaf-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-leaf-500 ring-1 ring-inset ring-leaf-500/30'
                              : 'rounded-full bg-wood-600/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-wood-600 ring-1 ring-inset ring-wood-600/30'
                          }
                        >
                          {t.is_active ? 'Aktiv' : 'Aufgehoben'}
                        </span>
                        {t.label && (
                          <span className="text-xs text-forest-700/80">
                            {t.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-forest-700/60">
                        {t.expires_at
                          ? `Läuft ${t.expires_at} ab`
                          : 'Läuft nie ab'}
                      </p>
                    </div>
                    {t.is_active && (
                      <Button
                        className="text-xs text-beet-700 hover:bg-beet-700/10 hover:text-beet-700"
                        onClick={() => revokeToken(t.id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Aufheben
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
