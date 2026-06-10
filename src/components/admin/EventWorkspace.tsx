import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '~/lib/ui-utils'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { Label } from '~/ui/label'
import { RichTextEditor } from '~/ui/rich-text-editor'
import { Separator } from '~/ui/separator'
import type { EventWithDetails, UpdateEventInput } from '~func/contracts/event'
import AgendaPanel from './AgendaPanel'
import AttendeesPanel from './AttendeesPanel'
import EventPdfButton from './EventPdfButton'

const FIELD =
  'w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-2.5 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

const TEXTAREA =
  'min-h-28 w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-3 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

type Props = {
  event: EventWithDetails
  isUpdating: boolean
  isDeleting: boolean
  onUpdate: (data: UpdateEventInput) => void
  onDelete: () => void
}

export default function EventWorkspace({
  event,
  isUpdating,
  isDeleting,
  onUpdate,
  onDelete,
}: Props) {
  // Lifted to the workspace so the PDF button can render the latest
  // in-progress edits (the user shouldn't have to save first).
  const [transcriptionDraft, setTranscriptionDraft] = useState(
    event.transcription ?? '',
  )

  return (
    <div className="space-y-8">
      <DetailsForm
        event={event}
        isUpdating={isUpdating}
        onTranscriptionChange={setTranscriptionDraft}
        onUpdate={onUpdate}
        transcriptionDraft={transcriptionDraft}
      />
      <Separator />
      <AttendeesPanel event={event} />
      <Separator />
      <AgendaPanel event={event} />
      <Separator />
      <ProtocolSection
        event={event}
        isDeleting={isDeleting}
        onDelete={onDelete}
        transcriptionHtml={transcriptionDraft}
      />
    </div>
  )
}

function DetailsForm({
  event,
  isUpdating,
  onUpdate,
  transcriptionDraft,
  onTranscriptionChange,
}: {
  event: EventWithDetails
  isUpdating: boolean
  onUpdate: (data: UpdateEventInput) => void
  transcriptionDraft: string
  onTranscriptionChange: (html: string) => void
}) {
  const [title, setTitle] = useState(event.title)
  const [date, setDate] = useState(event.scheduled_date)
  const [time, setTime] = useState(event.scheduled_time ?? '')
  const [location, setLocation] = useState(event.location ?? '')
  const [agenda, setAgenda] = useState(event.agenda ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Bitte einen Titel eingeben.')
      return
    }
    onUpdate({
      title: title.trim(),
      scheduled_date: date,
      scheduled_time: time.trim() ? time.trim() : null,
      location: location.trim() ? location.trim() : null,
      agenda: agenda.trim() ? agenda.trim() : null,
      // Send the HTML as-is when non-empty — `RichTextEditor` already
      // emits well-formed HTML, and we only need to translate "empty"
      // into `null` for the server.
      transcription: isHtmlEmpty(transcriptionDraft)
        ? null
        : transcriptionDraft,
    })
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="event-title">Titel</Label>
        <Input
          className={FIELD}
          id="event-title"
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          required
          value={title}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="event-date">Datum</Label>
          <Input
            className={FIELD}
            id="event-date"
            onChange={(e) => setDate(e.target.value)}
            required
            type="date"
            value={date}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="event-time">Uhrzeit (optional)</Label>
          <Input
            className={FIELD}
            id="event-time"
            onChange={(e) => setTime(e.target.value)}
            placeholder="HH:mm"
            type="time"
            value={time}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="event-location">Ort (optional)</Label>
        <Input
          className={FIELD}
          id="event-location"
          maxLength={500}
          onChange={(e) => setLocation(e.target.value)}
          value={location}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="event-agenda">Erste Tagesordnung (optional)</Label>
        <textarea
          className={TEXTAREA}
          id="event-agenda"
          maxLength={50000}
          onChange={(e) => setAgenda(e.target.value)}
          placeholder="Wird im Tagesordnungs-Bereich weitergeführt."
          value={agenda}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="event-transcription">Protokoll (optional)</Label>
        <RichTextEditor
          className="min-h-40"
          onChange={onTranscriptionChange}
          placeholder="Was wurde besprochen, was wurde beschlossen? Nutze Überschriften für Abschnitte — das Inhaltsverzeichnis im PDF baut sich automatisch auf."
          value={transcriptionDraft}
        />
      </div>
      <div className="flex justify-end">
        <Button
          className={cn(isUpdating && 'opacity-60')}
          disabled={isUpdating}
          type="submit"
        >
          {isUpdating ? 'Wird gespeichert …' : 'Details speichern'}
        </Button>
      </div>
    </form>
  )
}

function ProtocolSection({
  event,
  isDeleting,
  onDelete,
  transcriptionHtml,
}: {
  event: EventWithDetails
  isDeleting: boolean
  onDelete: () => void
  transcriptionHtml: string
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-forest-900">
            Protokoll & PDF
          </p>
          <p className="text-xs text-forest-700/70">
            Lade das fertige Protokoll mit Inhaltsverzeichnis herunter oder
            drucke es direkt als PDF.
          </p>
        </div>
        <EventPdfButton event={event} transcriptionHtml={transcriptionHtml} />
      </div>
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-forest-700/60">
          Gelöschte Termine können nicht wiederhergestellt werden.
        </p>
        <Button
          className="bg-beet-700 text-white hover:bg-beet-700/90"
          disabled={isDeleting}
          onClick={onDelete}
          size="sm"
          type="button"
        >
          {isDeleting ? 'Wird gelöscht …' : 'Termin löschen'}
        </Button>
      </div>
    </div>
  )
}

/**
 * Returns true when the editor's HTML output is effectively empty —
 * either an empty string, the `<p></p>` Tiptap emits for an empty
 * document, or only whitespace inside the paragraph.
 */
function isHtmlEmpty(html: string): boolean {
  if (!html) return true
  const stripped = html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, '')
    .trim()
  return stripped.length === 0
}
