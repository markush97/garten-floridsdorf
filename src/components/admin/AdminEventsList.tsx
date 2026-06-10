import {
  ArrowRight01Icon,
  CalendarIcon,
  CheckmarkCircle01Icon,
  Edit01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { stripHtmlTags } from '~/lib/event-helpers'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import { cn } from '~/lib/ui-utils'
import { useAdminEvents, useDeleteEvent } from '~/services/event.service'
import { Badge } from '~/ui/badge'
import { Button } from '~/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/ui/dialog'
import type { Event } from '~func/contracts/event'
import AdminShell from './AdminShell'

function statusLabel(date: string) {
  const eventDay = dayjs(date).tz(DEFAULT_TIMEZONE)
  const today = dayjs().tz(DEFAULT_TIMEZONE).startOf('day')
  if (eventDay.isSame(today, 'day')) return 'Heute'
  if (eventDay.isBefore(today, 'day')) return 'Vergangen'
  const days = eventDay.diff(today, 'day')
  if (days <= 7) return `In ${days} ${days === 1 ? 'Tag' : 'Tagen'}`
  return eventDay.format('D. MMM YYYY')
}

function AdminEventsList() {
  const { data: events, isPending, isError } = useAdminEvents()
  const { mutate: deleteEvent, isPending: isDeleting } = useDeleteEvent()
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null)

  if (isPending) {
    return (
      <AdminShell>
        <div className="py-16 text-center text-forest-700/60">
          Wird geladen …
        </div>
      </AdminShell>
    )
  }

  if (isError) {
    return (
      <AdminShell>
        <div className="py-16 text-center space-y-3">
          <p className="text-beet-700">
            Zugriff verweigert oder Fehler beim Laden.
          </p>
          <Link className="text-sm underline text-forest-700" to="/admin">
            Zur Anmeldung
          </Link>
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl text-forest-900">Termine</h1>
            <p className="text-sm text-forest-700/70">
              Geplante Treffen mit Teilnehmer:innen, Tagesordnung und Protokoll.
            </p>
          </div>
          <Button asChild>
            <Link to="/admin/events/$slug" params={{ slug: 'new' }}>
              Neuer Termin
            </Link>
          </Button>
        </div>

        {events?.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-3">
            {events?.map((event) => (
              <li
                className="rounded-[1.25rem] bg-white/75 p-4 shadow-[0_4px_16px_rgba(31,61,43,0.06)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-5"
                key={event.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <EventStatusBadge event={event} />
                      <Link
                        className="font-medium text-forest-900 hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-forest-700"
                        to="/admin/events/$slug"
                        params={{ slug: event.slug }}
                      >
                        {event.title}
                      </Link>
                    </div>
                    <p className="text-xs text-forest-700/60">
                      <HugeiconsIcon
                        aria-hidden="true"
                        className="mr-1 inline-block align-text-bottom"
                        icon={CalendarIcon}
                        size={12}
                        strokeWidth={1.6}
                      />
                      {dayjs(event.scheduled_date)
                        .tz(DEFAULT_TIMEZONE)
                        .format('dddd, D. MMMM YYYY')}
                      {event.scheduled_time && ` · ${event.scheduled_time} Uhr`}
                      {event.location && ` · ${event.location}`}
                    </p>
                    {event.transcription && (
                      <p className="line-clamp-2 text-sm text-forest-700/80">
                        {stripHtmlTags(event.transcription)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      asChild
                      className="text-xs"
                      size="sm"
                      variant="outline"
                    >
                      <Link
                        params={{ slug: event.slug }}
                        to="/admin/events/$slug"
                      >
                        <HugeiconsIcon
                          aria-hidden="true"
                          icon={Edit01Icon}
                          size={14}
                          strokeWidth={1.6}
                        />
                        Bearbeiten
                      </Link>
                    </Button>
                    <Button
                      aria-label={`Termin "${event.title}" löschen`}
                      className={cn(
                        'text-xs text-beet-700 hover:bg-beet-700/10 hover:text-beet-700',
                      )}
                      onClick={() => setDeleteSlug(event.slug)}
                      size="sm"
                      variant="outline"
                    >
                      Löschen
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        onOpenChange={(open) => !open && setDeleteSlug(null)}
        open={deleteSlug !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Termin löschen?</DialogTitle>
            <DialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Tagesordnung,
              Protokoll und alle Anwesenheitsdaten werden gelöscht.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeleteSlug(null)} variant="outline">
              Abbrechen
            </Button>
            <Button
              className="bg-beet-700 text-white hover:bg-beet-700/90"
              disabled={isDeleting}
              onClick={() => {
                if (!deleteSlug) return
                deleteEvent(deleteSlug, {
                  onSuccess: () => {
                    toast.success('Termin gelöscht.')
                    setDeleteSlug(null)
                  },
                  onError: () => toast.error('Fehler beim Löschen.'),
                })
              }}
            >
              {isDeleting ? 'Wird gelöscht …' : 'Endgültig löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  )
}

function EventStatusBadge({ event }: { event: Event }) {
  const eventDay = dayjs(event.scheduled_date).tz(DEFAULT_TIMEZONE)
  const today = dayjs().tz(DEFAULT_TIMEZONE).startOf('day')
  const isPast = eventDay.isBefore(today, 'day')
  const isToday = eventDay.isSame(today, 'day')
  if (eventDay.isAfter(today, 'day')) {
    return (
      <Badge className="bg-forest-900/8 text-forest-700 ring-forest-900/15">
        Geplant
      </Badge>
    )
  }
  if (isToday) {
    return (
      <Badge className="bg-leaf-500/15 text-leaf-500 ring-leaf-500/30">
        Heute
      </Badge>
    )
  }
  if (isPast) {
    return (
      <Badge className="bg-wood-600/15 text-wood-600 ring-wood-600/30">
        <HugeiconsIcon
          aria-hidden="true"
          icon={CheckmarkCircle01Icon}
          size={12}
          strokeWidth={2}
        />
        Abgeschlossen
      </Badge>
    )
  }
  return null
}

function EmptyState() {
  return (
    <div className="rounded-[1.5rem] bg-white/60 p-6 ring-1 ring-inset ring-white/40 sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-900/5 text-forest-700">
          <HugeiconsIcon
            aria-hidden="true"
            icon={ArrowRight01Icon}
            size={20}
            strokeWidth={1.8}
          />
        </span>
        <div className="space-y-1 text-sm text-forest-700/80">
          <p className="font-semibold text-forest-900">
            Noch kein Termin angelegt
          </p>
          <p>
            Lege einen Termin manuell an oder öffne im Admin-Bereich eine
            abgestimmte Umfrage, deren Termin bereits festgelegt wurde – dort
            findest du den Button „Termin anlegen“.
          </p>
        </div>
      </div>
    </div>
  )
}

void statusLabel
export default AdminEventsList
