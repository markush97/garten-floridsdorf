import {
  Attachment01Icon,
  Delete02Icon,
  Download01Icon,
  File01Icon,
  Pdf01Icon,
  Upload01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '~/lib/ui-utils'
import {
  useDeleteAttachment,
  useUpdateAttachment,
  useUploadAttachment,
} from '~/services/event.service'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import type { EventAttachment } from '~func/contracts/event'
import {
  isAllowedAttachmentContentType,
  MAX_ATTACHMENT_SIZE_BYTES,
} from '~func/contracts/event'

const FIELD =
  'w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-2 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

type Props = {
  eventSlug: string
  /** When set, the uploader scopes new uploads to this agenda item and
   *  filters the existing list to those belonging to it. */
  agendaItemId?: number
  attachments: EventAttachment[]
  /** When true, renders the compact "section" form (no per-row caption
   *  editor, no inline rename) suitable for the event-level block. */
  compact?: boolean
}

const MAX_BYTES_HUMAN = `${Math.round(MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024)} MB`

/**
 * Drag-and-drop attachment uploader. Shared between the event-level
 * "Anhänge" section and each agenda item — the difference is just the
 * `agendaItemId` scope and a `compact` mode for the simpler event-level
 * presentation.
 */
export default function AttachmentUploader({
  eventSlug,
  agendaItemId,
  attachments,
  compact = false,
}: Props) {
  const { mutate: upload, isPending: isUploading } =
    useUploadAttachment(eventSlug)
  const { mutate: deleteAttachment, isPending: isDeleting } =
    useDeleteAttachment(eventSlug)
  const { mutate: updateAttachment } = useUpdateAttachment(eventSlug)
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [pendingCaption, setPendingCaption] = useState('')

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return
      for (const file of Array.from(files)) {
        if (!isAllowedAttachmentContentType(file.type)) {
          toast.error(
            `${file.name}: Dateityp nicht erlaubt. Erlaubt: Bilder und PDF.`,
          )
          continue
        }
        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
          toast.error(`${file.name}: Datei zu groß (max ${MAX_BYTES_HUMAN}).`)
          continue
        }
        upload(
          {
            file,
            agenda_item_id: agendaItemId ?? null,
            caption: pendingCaption.trim() || undefined,
          },
          {
            onSuccess: () => {
              toast.success(`${file.name} hochgeladen.`)
              setPendingCaption('')
            },
            onError: () =>
              toast.error(`${file.name} konnte nicht hochgeladen werden.`),
          },
        )
      }
    },
    [agendaItemId, pendingCaption, upload],
  )

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="space-y-3">
      <label
        aria-label="Dateien per Klick oder per Drag-and-drop hochladen"
        className={cn(
          'block cursor-pointer rounded-2xl border-2 border-dashed p-4 text-center transition',
          isDragOver
            ? 'border-forest-700 bg-forest-700/5'
            : 'border-forest-900/15 bg-forest-900/4',
        )}
        onDragEnter={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={(e) => {
          // Only set false when we actually leave the zone, not when
          // we transition between child elements.
          if (e.currentTarget === e.target) setIsDragOver(false)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <HugeiconsIcon
            aria-hidden="true"
            className="text-forest-700"
            icon={Upload01Icon}
            size={20}
            strokeWidth={1.6}
          />
          <p className="text-sm text-forest-700/80">
            Datei hierher ziehen oder{' '}
            <span className="font-semibold text-forest-700 underline underline-offset-2">
              auswählen
            </span>
          </p>
          <p className="text-xs text-forest-700/55">
            Bilder und PDF · max {MAX_BYTES_HUMAN}
          </p>
        </div>
        <input
          accept="image/*,application/pdf"
          className="sr-only"
          multiple
          onChange={(e) => {
            handleFiles(e.target.files)
            // Reset so picking the same file twice still fires onChange.
            e.target.value = ''
          }}
          ref={inputRef}
          type="file"
        />
      </label>

      {!compact && (
        <div className="space-y-1.5">
          <label
            className="text-xs font-medium text-forest-700/80"
            htmlFor={`upload-caption-${agendaItemId ?? 'event'}`}
          >
            Bildunterschrift für nächste Uploads (optional)
          </label>
          <Input
            className={FIELD}
            id={`upload-caption-${agendaItemId ?? 'event'}`}
            maxLength={500}
            onChange={(e) => setPendingCaption(e.target.value)}
            placeholder="z. B. Foto der reparierten Wasserleitung"
            value={pendingCaption}
          />
        </div>
      )}

      {isUploading && (
        <p className="text-xs text-forest-700/70" role="status">
          Wird hochgeladen …
        </p>
      )}

      {attachments.length === 0 ? (
        <p className="text-sm text-forest-700/60">Noch keine Anhänge.</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((att) => (
            <AttachmentRow
              attachment={att}
              compact={compact}
              eventSlug={eventSlug}
              isDeleting={isDeleting}
              key={att.id}
              onDelete={() =>
                deleteAttachment(att.id, {
                  onSuccess: () => toast.success('Anhang gelöscht.'),
                  onError: () => toast.error('Löschen fehlgeschlagen.'),
                })
              }
              onRename={(caption) =>
                updateAttachment(
                  { id: att.id, data: { caption } },
                  {
                    onError: () =>
                      toast.error(
                        'Bildunterschrift konnte nicht gespeichert werden.',
                      ),
                  },
                )
              }
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function AttachmentRow({
  attachment,
  compact,
  eventSlug,
  isDeleting,
  onDelete,
  onRename,
}: {
  attachment: EventAttachment
  compact: boolean
  eventSlug: string
  isDeleting: boolean
  onDelete: () => void
  onRename: (caption: string | null) => void
}) {
  const [isEditingCaption, setIsEditingCaption] = useState(false)
  const [draftCaption, setDraftCaption] = useState(attachment.caption ?? '')
  const isImage = attachment.content_type.startsWith('image/')
  const isPdf = attachment.content_type === 'application/pdf'
  const downloadHref = `/api/admin/events/${eventSlug}/attachments/${attachment.id}/download`

  function saveCaption() {
    onRename(draftCaption.trim() ? draftCaption.trim() : null)
    setIsEditingCaption(false)
  }

  return (
    <li className="flex flex-col gap-2 rounded-[1rem] bg-white/65 p-3 ring-1 ring-inset ring-forest-900/8 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-3 overflow-hidden">
        {isImage ? (
          <img
            alt={attachment.caption ?? attachment.filename}
            className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-forest-900/10"
            src={downloadHref}
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-forest-900/5 text-forest-700">
            <HugeiconsIcon
              aria-hidden="true"
              icon={isPdf ? Pdf01Icon : File01Icon}
              size={22}
              strokeWidth={1.6}
            />
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          {isEditingCaption && !compact ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label="Bildunterschrift bearbeiten"
                className={cn(FIELD, 'h-8 py-1 text-sm')}
                maxLength={500}
                onChange={(e) => setDraftCaption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveCaption()
                  if (e.key === 'Escape') setIsEditingCaption(false)
                }}
                value={draftCaption}
              />
              <Button onClick={saveCaption} size="sm" type="button">
                OK
              </Button>
              <Button
                onClick={() => setIsEditingCaption(false)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Abbrechen
              </Button>
            </div>
          ) : (
            <p className="truncate text-sm font-medium text-forest-900">
              {attachment.caption || attachment.filename}
            </p>
          )}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-forest-700/60">
            <HugeiconsIcon
              aria-hidden="true"
              className="inline-block align-text-bottom"
              icon={Attachment01Icon}
              size={12}
              strokeWidth={1.6}
            />
            <span className="truncate">{attachment.filename}</span>
            <span>· {formatSize(attachment.size)}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:flex-nowrap">
        {!compact && (
          <Button
            aria-label="Bildunterschrift bearbeiten"
            className="text-xs"
            onClick={() => {
              setDraftCaption(attachment.caption ?? '')
              setIsEditingCaption((v) => !v)
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Unterschrift
          </Button>
        )}
        <Button asChild className="text-xs" size="sm" variant="outline">
          <a
            aria-label={`${attachment.filename} herunterladen`}
            download={attachment.filename}
            href={downloadHref}
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={Download01Icon}
              size={14}
              strokeWidth={1.6}
            />
            Laden
          </a>
        </Button>
        <Button
          aria-label={`${attachment.filename} löschen`}
          className="text-xs text-beet-700 hover:bg-beet-700/10 hover:text-beet-700"
          disabled={isDeleting}
          onClick={onDelete}
          size="sm"
          type="button"
          variant="outline"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={Delete02Icon}
            size={14}
            strokeWidth={1.6}
          />
          Löschen
        </Button>
      </div>
    </li>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
