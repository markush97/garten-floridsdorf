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
import AttachmentsSection from './AttachmentsSection'
import AttendeesPanel from './AttendeesPanel'
import DecisionsPanel from './DecisionsPanel'
import EventPdfButton from './EventPdfButton'
import TasksPanel from './TasksPanel'

const FIELD =
  'w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-2.5 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

const TEXTAREA =
  'min-h-24 w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-3 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

type Props = {
  event: EventWithDetails
  isUpdating: boolean
  isDeleting: boolean
  onUpdate: (data: UpdateEventInput) => void
  onDelete: () => void
}

/**
 * The whole editor for one event. The page is laid out in three
 * vertical bands:
 *
 *   1. EventMetaCard — title / date / time / location / agenda draft,
 *      saved as a single unit ("Details speichern").
 *   2. The structured work — attendees, agenda items, decisions,
 *      tasks, attachments. Each has its own save lifecycle; nothing
 *      in this band is conditional on the others.
 *   3. LiveTranscript — a TWO-COLUMN workspace at `lg:` and up: the
 *      read-only agenda reference on the left, the WYSIWYG
 *      protocol editor on the right. Below `lg:` the columns
 *      stack. This is the meeting-time view: the scribe works on
 *      the right, with the agenda they're transcribing always
 *      visible on the left.
 */
export default function EventWorkspace({
  event,
  isUpdating,
  isDeleting,
  onUpdate,
  onDelete,
}: Props) {
  // Lifted to the workspace so the PDF/HTML/iCal buttons can render
  // the latest in-progress edits (the user shouldn't have to save
  // first).
  const [transcriptionDraft, setTranscriptionDraft] = useState(
    event.transcription ?? '',
  )

  return (
    <div className="space-y-8">
      <EventMetaCard
        event={event}
        isUpdating={isUpdating}
        onTranscriptionChange={setTranscriptionDraft}
        onUpdate={onUpdate}
        transcriptionDraft={transcriptionDraft}
      />
      <Separator />
      <div className="space-y-8">
        <AttendeesPanel event={event} />
        <AgendaPanel event={event} />
        <AttachmentsSection event={event} />
        <DecisionsPanel event={event} />
        <TasksPanel event={event} />
      </div>
      <Separator />
      <LiveTranscript
        event={event}
        isDeleting={isDeleting}
        onDelete={onDelete}
        onTranscriptionChange={setTranscriptionDraft}
        transcriptionDraft={transcriptionDraft}
      />
    </div>
  )
}

// ── Event meta (top) ────────────────────────────────────────────────────────

function EventMetaCard({
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
      transcription: isHtmlEmpty(transcriptionDraft)
        ? null
        : transcriptionDraft,
    })
  }

  return (
    <form
      className="space-y-5 rounded-[1.5rem] bg-white/75 p-5 ring-1 ring-inset ring-white/40 sm:p-6"
      data-testid="event-meta-card"
      onSubmit={handleSubmit}
    >
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
        <Label htmlFor="event-agenda">
          Tagesordnung — Kurzfassung (optional)
        </Label>
        <textarea
          className={TEXTAREA}
          id="event-agenda"
          maxLength={50000}
          onChange={(e) => setAgenda(e.target.value)}
          placeholder="Wird auf der Titelseite des PDFs angezeigt. Die strukturierten Agendapunkte verwaltest du unten in 'Agendapunkte'."
          value={agenda}
        />
      </div>
      <details className="group">
        <summary className="cursor-pointer text-xs font-medium text-forest-700/70 hover:text-forest-700">
          Protokoll im Detail-Formular bearbeiten (falls du es nicht im
          Live-Modus unten haben willst)
        </summary>
        <div className="mt-2 space-y-1.5">
          <span className="text-xs font-medium text-forest-700">
            Protokoll (HTML — Inhaltsverzeichnis baut sich aus den Überschriften
            auf)
          </span>
          <RichTextEditor
            className="min-h-40"
            onChange={onTranscriptionChange}
            placeholder="Was wurde besprochen, was wurde beschlossen? Nutze Überschriften für Abschnitte — das Inhaltsverzeichnis im PDF baut sich automatisch auf."
            value={transcriptionDraft}
          />
        </div>
      </details>
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

// ── Live transcript workspace (two-column on lg) ──────────────────────────

function LiveTranscript({
  event,
  isDeleting,
  onDelete,
  transcriptionDraft,
  onTranscriptionChange,
}: {
  event: EventWithDetails
  isDeleting: boolean
  onDelete: () => void
  transcriptionDraft: string
  onTranscriptionChange: (html: string) => void
}) {
  return (
    <section
      aria-label="Live-Protokoll"
      className="space-y-4"
      data-testid="live-transcript"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-forest-900">
            Protokoll live schreiben
          </p>
          <p className="text-xs text-forest-700/70">
            Links steht die Tagesordnung als Referenz, rechts der Editor für
            dein Protokoll. Wird automatisch gespeichert — klicke „Speichern",
            um eine neue Version festzuschreiben.
          </p>
        </div>
        <EventPdfButton event={event} transcriptionHtml={transcriptionDraft} />
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <AgendaReferenceSidebar event={event} />
        <TranscriptionEditorPanel
          isUpdating={false}
          onChange={onTranscriptionChange}
          transcriptionDraft={transcriptionDraft}
        />
      </div>

      <Separator />

      <footer className="flex flex-wrap items-center justify-between gap-3">
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
      </footer>
    </section>
  )
}

/**
 * Left column of the live workspace — a read-only agenda reference
 * card. Each agenda item is rendered with its status badge so the
 * scribe can keep track of where they are in the meeting at a
 * glance. Empty state surfaces a gentle hint that the structural
 * panels above are where items are created.
 */
function AgendaReferenceSidebar({ event }: { event: EventWithDetails }) {
  const items = [...event.agenda_items].sort(
    (a, b) => a.sort_order - b.sort_order || a.id - b.id,
  )
  return (
    <aside
      aria-label="Tagesordnung als Referenz"
      className="space-y-3 rounded-[1.25rem] bg-forest-900/4 p-4 ring-1 ring-inset ring-forest-900/8 lg:col-span-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
      data-testid="agenda-reference"
    >
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest-700">
          Tagesordnung
        </p>
        <p className="text-xs text-forest-700/70">
          {items.length === 0
            ? 'Noch keine Punkte — füge sie oben in „Agendapunkte" hinzu.'
            : `${items.length} ${items.length === 1 ? 'Punkt' : 'Punkte'} · Status wird mitprotokolliert.`}
        </p>
      </header>
      {items.length === 0 ? (
        <p className="rounded-xl bg-white/70 p-3 text-xs text-forest-700/70 ring-1 ring-inset ring-forest-900/8">
          Lege die Agendapunkte weiter oben an. Sie erscheinen dann hier
          automatisch mit Status-Badge.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((item, idx) => (
            <li
              className="flex items-start gap-2 rounded-xl bg-white/70 p-2.5 ring-1 ring-inset ring-forest-900/8"
              key={item.id}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest-900/5 text-xs font-semibold text-forest-700">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm font-medium text-forest-900">
                  {item.title}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-forest-700/70">
                  {statusLabel(item.status)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}

function statusLabel(status: string): string {
  switch (status) {
    case 'discussed':
      return 'Besprochen'
    case 'skipped':
      return 'Übersprungen'
    default:
      return 'Offen'
  }
}

/**
 * Right column of the live workspace — the WYSIWYG transcription
 * editor. Saving is a single click; the [`LiveTranscript`] parent
 * owns the draft state so the PDF/HTML/iCal buttons see live
 * edits.
 */
function TranscriptionEditorPanel({
  transcriptionDraft,
  onChange,
  isUpdating,
}: {
  transcriptionDraft: string
  onChange: (html: string) => void
  isUpdating: boolean
}) {
  return (
    <div
      className="space-y-3 rounded-[1.25rem] bg-white/80 p-4 ring-1 ring-inset ring-forest-900/8 lg:col-span-3"
      data-testid="transcription-panel"
    >
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-forest-700">Protokoll</span>
        <RichTextEditor
          className="min-h-72"
          onChange={onChange}
          placeholder="Was wurde besprochen, was wurde beschlossen? Nutze Überschriften (Überschrift 2 / Überschrift 3) für Abschnitte — das Inhaltsverzeichnis im PDF baut sich automatisch auf."
          value={transcriptionDraft}
        />
      </div>
      {isUpdating && (
        <p className="text-xs text-forest-700/70" role="status">
          Wird gespeichert …
        </p>
      )}
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
