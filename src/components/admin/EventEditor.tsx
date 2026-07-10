import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  useAdminEvent,
  useCreateEvent,
  useDeleteEvent,
  useUpdateEvent,
} from '~/services/event.service'
import { Button } from '~/ui/button'
import { DatePicker } from '~/ui/date-picker'
import { Input } from '~/ui/input'
import { Label } from '~/ui/label'
import { Separator } from '~/ui/separator'
import EventWorkspace from './EventWorkspace'
import {
  EditorShell,
  FIELD,
  formatTimeDigits,
  TEXTAREA,
  toIsoDate,
} from './form-ui'

type Props = { eventSlug: string }

export default function EventEditor({ eventSlug }: Props) {
  const isNew = eventSlug === 'new'
  const navigate = useNavigate()
  const { mutate: createEvent, isPending: isCreating } = useCreateEvent()
  const { mutate: updateEvent, isPending: isUpdating } =
    useUpdateEvent(eventSlug)
  const { mutate: deleteEvent, isPending: isDeleting } = useDeleteEvent()

  if (isNew) {
    return (
      <NewEventForm
        isPending={isCreating}
        onSubmit={(data) =>
          createEvent(data, {
            onSuccess: (event) => {
              toast.success('Termin angelegt.')
              void navigate({
                to: '/admin/events/$slug',
                params: { slug: event.slug },
              })
            },
            onError: () => toast.error('Fehler beim Anlegen des Termins.'),
          })
        }
      />
    )
  }

  return (
    <ExistingEventForm
      eventSlug={eventSlug}
      isDeleting={isDeleting}
      isUpdating={isUpdating}
      onDelete={() =>
        deleteEvent(eventSlug, {
          onSuccess: () => {
            toast.success('Termin gelöscht.')
            void navigate({ to: '/admin/events' })
          },
          onError: () => toast.error('Fehler beim Löschen.'),
        })
      }
      onUpdate={(data) =>
        updateEvent(data, {
          onSuccess: () => toast.success('Änderungen gespeichert.'),
          onError: () => toast.error('Fehler beim Speichern.'),
        })
      }
    />
  )
}

type NewEventFormProps = {
  isPending: boolean
  onSubmit: (data: {
    title: string
    scheduled_date: string
    scheduled_time?: string
    location?: string
    agenda?: string
    transcription?: string
    poll_id?: number
  }) => void
}

function NewEventForm({ isPending, onSubmit }: NewEventFormProps) {
  const [title, setTitle] = useState('')
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    new Date(),
  )
  const [scheduledTime, setScheduledTime] = useState('')
  const [location, setLocation] = useState('')
  const [agenda, setAgenda] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Bitte einen Titel eingeben.')
      return
    }
    if (!scheduledDate) {
      toast.error('Bitte ein Datum wählen.')
      return
    }
    onSubmit({
      title: title.trim(),
      scheduled_date: toIsoDate(scheduledDate),
      scheduled_time: scheduledTime.trim() || undefined,
      location: location.trim() || undefined,
      agenda: agenda.trim() || undefined,
    })
  }

  return (
    <EditorShell title="Neuen Termin anlegen">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="event-title">Titel</Label>
          <Input
            className={FIELD}
            id="event-title"
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. Gartentreffen Juni"
            required
            value={title}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr] sm:gap-4">
          <div className="space-y-1.5">
            <Label>Datum</Label>
            <DatePicker onChange={setScheduledDate} value={scheduledDate} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-time">Uhrzeit (optional)</Label>
            <Input
              className={FIELD}
              id="event-time"
              inputMode="numeric"
              maxLength={5}
              onChange={(e) =>
                setScheduledTime(formatTimeDigits(e.target.value))
              }
              placeholder="HH:mm"
              value={scheduledTime}
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
            placeholder="z. B. Kleingarten, Vereinshaus"
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
            placeholder="Was soll alles besprochen werden? Lässt sich später noch anpassen."
            value={agenda}
          />
        </div>
        <Separator />
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link to="/admin/events">Abbrechen</Link>
          </Button>
          <Button disabled={isPending} type="submit">
            {isPending ? 'Wird angelegt …' : 'Termin anlegen'}
          </Button>
        </div>
      </form>
    </EditorShell>
  )
}

type ExistingEventFormProps = {
  eventSlug: string
  isUpdating: boolean
  isDeleting: boolean
  onUpdate: (data: {
    title?: string
    scheduled_date?: string
    scheduled_time?: string | null
    location?: string | null
    agenda?: string | null
    transcription?: string | null
  }) => void
  onDelete: () => void
}

function ExistingEventForm({
  eventSlug,
  isUpdating,
  isDeleting,
  onUpdate,
  onDelete,
}: ExistingEventFormProps) {
  const { data: event, isPending, isError } = useAdminEvent(eventSlug)
  const backLink = (
    <Link className="text-sm text-forest-700/70 underline" to="/admin/events">
      ← Zur Übersicht
    </Link>
  )

  if (isPending) {
    return (
      <EditorShell title="Termin" titleAside={backLink}>
        <p className="text-forest-700/60">Wird geladen …</p>
      </EditorShell>
    )
  }
  if (isError || !event) {
    return (
      <EditorShell title="Termin" titleAside={backLink}>
        <p className="text-forest-700/60">Termin nicht gefunden.</p>
      </EditorShell>
    )
  }

  return (
    <EditorShell title={event.title} titleAside={backLink}>
      <EventWorkspace
        event={event}
        isDeleting={isDeleting}
        isUpdating={isUpdating}
        onDelete={onDelete}
        onUpdate={onUpdate}
      />
    </EditorShell>
  )
}
