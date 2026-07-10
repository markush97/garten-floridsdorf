import type { EventWithDetails } from '~func/contracts/event'
import AttachmentUploader from './AttachmentUploader'

/**
 * Event-level attachments: the things that aren't tied to a single
 * agenda item. The section is a thin wrapper over [`AttachmentUploader`]
 * that adds a heading + descriptive copy so the workspace has a
 * consistent shape across panels.
 */
export default function AttachmentsSection({
  event,
}: {
  event: EventWithDetails
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-forest-900">Anhänge</p>
        <p className="text-xs text-forest-700/70">
          Fotos, Rechnungen, Skizzen — alles, was zum Termin gehört. Pro
          Agendapunkt gibt es unten eigene Anhänge; diese Liste ist für
          übergreifende Dateien.
        </p>
      </div>
      <AttachmentUploader
        attachments={event.attachments}
        compact
        eventSlug={event.slug}
      />
    </div>
  )
}
