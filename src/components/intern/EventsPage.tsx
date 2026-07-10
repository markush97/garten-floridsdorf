import { Calendar01Icon, FileEditIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, Navigate } from '@tanstack/react-router'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import { useMe } from '~/services/auth.service'
import { useMemberEvents } from '~/services/event.service'
import { Badge } from '~/ui/badge'
import MemberShell from './MemberShell'

export default function EventsPage() {
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
      <EventsContent />
    </MemberShell>
  )
}

function EventsContent() {
  const { data: events, isPending, isError } = useMemberEvents()

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl text-forest-900">Termine</h1>
        <p className="text-sm text-forest-700/70">
          Alle Vereinstreffen mit Tagesordnung, Beschlüssen und Protokoll.
        </p>
      </div>

      {isPending ? (
        <p className="py-8 text-center text-sm text-forest-700/60">
          Wird geladen …
        </p>
      ) : isError ? (
        <p className="py-8 text-center text-sm text-beet-700">
          Termine konnten nicht geladen werden.
        </p>
      ) : events?.length === 0 ? (
        <p className="py-8 text-center text-sm text-forest-700/60">
          Noch keine Termine angelegt.
        </p>
      ) : (
        <ul className="space-y-3">
          {events?.map((event) => (
            <li
              className="rounded-[1.25rem] bg-white/75 p-4 shadow-[0_4px_16px_rgba(31,61,43,0.06)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-5"
              key={event.id}
            >
              <Link
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                params={{ slug: event.slug }}
                to="/intern/termine/$slug"
              >
                <div className="space-y-1">
                  <p className="font-medium text-forest-900 hover:text-forest-700">
                    {event.title}
                  </p>
                  <p className="text-xs text-forest-700/60">
                    <HugeiconsIcon
                      aria-hidden="true"
                      className="mr-1 inline-block align-text-bottom"
                      icon={Calendar01Icon}
                      size={12}
                      strokeWidth={1.6}
                    />
                    {dayjs(event.scheduled_date)
                      .tz(DEFAULT_TIMEZONE)
                      .format('dddd, D. MMMM YYYY')}
                    {event.scheduled_time && ` · ${event.scheduled_time} Uhr`}
                    {event.location && ` · ${event.location}`}
                  </p>
                </div>
                {event.transcription && (
                  <Badge className="w-fit bg-leaf-500/15 text-forest-700 ring-1 ring-inset ring-leaf-500/30">
                    <HugeiconsIcon
                      aria-hidden="true"
                      icon={FileEditIcon}
                      size={12}
                      strokeWidth={1.6}
                    />
                    Protokoll vorhanden
                  </Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
