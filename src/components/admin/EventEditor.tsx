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
import { Input } from '~/ui/input'
import { Label } from '~/ui/label'
import { Separator } from '~/ui/separator'
import EventWorkspace from './EventWorkspace'

type Props = { eventSlug: string }

const FIELD =
  'w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-2.5 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

const TEXTAREA =
  'min-h-32 w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-3 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

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
  const today = new Date().toISOString().slice(0, 10)
  const [scheduledDate, setScheduledDate] = useState(today)
  const [scheduledTime, setScheduledTime] = useState('')
  const [location, setLocation] = useState('')
  const [agenda, setAgenda] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Bitte einen Titel eingeben.')
      return
    }
    onSubmit({
      title: title.trim(),
      scheduled_date: scheduledDate,
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
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="event-date">Datum</Label>
            <Input
              className={FIELD}
              id="event-date"
              onChange={(e) => setScheduledDate(e.target.value)}
              required
              type="date"
              value={scheduledDate}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-time">Uhrzeit (optional)</Label>
            <Input
              className={FIELD}
              id="event-time"
              onChange={(e) => setScheduledTime(e.target.value)}
              placeholder="HH:mm"
              type="time"
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

  if (isPending) {
    return (
      <EditorShell title="Termin">
        <p className="text-forest-700/60">Wird geladen …</p>
      </EditorShell>
    )
  }
  if (isError || !event) {
    return (
      <EditorShell title="Termin">
        <p className="text-forest-700/60">Termin nicht gefunden.</p>
        <Link
          className="mt-4 inline-block text-sm underline text-forest-700"
          to="/admin/events"
        >
          Zurück zur Übersicht
        </Link>
      </EditorShell>
    )
  }

  return (
    <EditorShell title={event.title}>
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

function EditorShell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8f3e7_0%,#f2ecdc_100%)] text-forest-900">
      <header className="mx-auto flex w-full max-w-[1180px] items-center gap-3 px-3 py-4 sm:px-6 lg:px-8">
        <Link to="/">
          <img
            alt="SV Beet & Bewegung"
            className="h-9 w-9 mix-blend-multiply"
            src="/brand/icon.png"
          />
        </Link>
        <span className="text-sm font-medium text-forest-700">Admin</span>
      </header>
      <main className="mx-auto w-full max-w-[1180px] px-3 pb-20 pt-2 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6 rounded-[1.5rem] bg-white/75 p-5 shadow-[0_8px_24px_rgba(31,61,43,0.07)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl text-forest-900">{title}</h1>
            <Link
              className="text-sm text-forest-700/70 underline"
              to="/admin/events"
            >
              ← Zur Übersicht
            </Link>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
