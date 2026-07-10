import { Calendar01Icon, Location01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, Navigate } from '@tanstack/react-router'
import { AGENDA_STATUS_LABELS, formatGermanDate } from '~/lib/event-helpers'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import { useMe } from '~/services/auth.service'
import { useMemberEvent } from '~/services/event.service'
import { Badge } from '~/ui/badge'
import { Separator } from '~/ui/separator'
import type { EventTask } from '~func/contracts/event'
import MemberShell from './MemberShell'

const TASK_STATUS_LABELS: Record<EventTask['status'], string> = {
  open: 'Offen',
  done: 'Erledigt',
}

type Props = { eventSlug: string }

export default function EventDetailPage({ eventSlug }: Props) {
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
      <EventDetailContent eventSlug={eventSlug} />
    </MemberShell>
  )
}

function EventDetailContent({ eventSlug }: Props) {
  const { data: event, isPending, isError } = useMemberEvent(eventSlug)

  if (isPending) {
    return (
      <p className="py-16 text-center text-sm text-forest-700/60">
        Wird geladen …
      </p>
    )
  }
  if (isError || !event) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm text-beet-700">Termin nicht gefunden.</p>
        <Link
          className="text-sm underline text-forest-700"
          to="/intern/termine"
        >
          Zurück zur Übersicht
        </Link>
      </div>
    )
  }

  const sortedAgenda = [...event.agenda_items].sort(
    (a, b) => a.sort_order - b.sort_order || a.id - b.id,
  )
  const sortedDecisions = [...event.decisions].sort(
    (a, b) => a.sort_order - b.sort_order || a.id - b.id,
  )
  const sortedTasks = [...event.tasks].sort(
    (a, b) => a.sort_order - b.sort_order || a.id - b.id,
  )

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          className="text-sm text-forest-700/70 underline"
          to="/intern/termine"
        >
          ← Zur Übersicht
        </Link>
        <h1 className="text-2xl text-forest-900 sm:text-3xl">{event.title}</h1>
        <p className="text-sm text-forest-700/70">
          <HugeiconsIcon
            aria-hidden="true"
            className="mr-1 inline-block align-text-bottom"
            icon={Calendar01Icon}
            size={14}
            strokeWidth={1.6}
          />
          {dayjs(event.scheduled_date)
            .tz(DEFAULT_TIMEZONE)
            .format('dddd, D. MMMM YYYY')}
          {event.scheduled_time && ` · ${event.scheduled_time} Uhr`}
        </p>
        {event.location && (
          <p className="text-sm text-forest-700/70">
            <HugeiconsIcon
              aria-hidden="true"
              className="mr-1 inline-block align-text-bottom"
              icon={Location01Icon}
              size={14}
              strokeWidth={1.6}
            />
            {event.location}
          </p>
        )}
        {event.agenda && (
          <p className="whitespace-pre-line text-sm text-forest-700/80">
            {event.agenda}
          </p>
        )}
      </div>

      {sortedAgenda.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-forest-900">
            Tagesordnung
          </h2>
          <ol className="space-y-2">
            {sortedAgenda.map((item, idx) => (
              <li
                className="flex items-start gap-3 rounded-[1rem] bg-white/70 p-3 ring-1 ring-inset ring-forest-900/8"
                key={item.id}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest-900/5 text-xs font-semibold text-forest-700">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-forest-900">
                      {item.title}
                    </p>
                    <Badge className="bg-forest-900/5 text-forest-700/80 ring-forest-900/10">
                      {AGENDA_STATUS_LABELS[item.status]}
                    </Badge>
                  </div>
                  {item.notes && (
                    <p className="whitespace-pre-line text-sm text-forest-700/80">
                      {item.notes}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {sortedDecisions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-forest-900">Beschlüsse</h2>
          <ul className="space-y-2">
            {sortedDecisions.map((decision) => (
              <li
                className="rounded-[1rem] bg-white/70 p-3 ring-1 ring-inset ring-forest-900/8"
                key={decision.id}
              >
                <p className="text-xs font-semibold text-forest-700/70">
                  {decision.resolution_number}
                </p>
                <p className="text-sm text-forest-900">{decision.wording}</p>
                {decision.result_note && (
                  <p className="mt-1 text-xs text-forest-700/70">
                    {decision.result_note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sortedTasks.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-forest-900">Aufgaben</h2>
          <ul className="space-y-2">
            {sortedTasks.map((task) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] bg-white/70 p-3 ring-1 ring-inset ring-forest-900/8"
                key={task.id}
              >
                <div>
                  <p className="text-sm text-forest-900">{task.title}</p>
                  <p className="text-xs text-forest-700/60">
                    {task.owner_display ?? task.owner_name ?? '–'}
                    {task.due_date &&
                      ` · bis ${formatGermanDate(task.due_date)}`}
                  </p>
                </div>
                <Badge
                  className={
                    task.status === 'open'
                      ? 'bg-leaf-500/15 text-leaf-500 ring-leaf-500/30'
                      : 'bg-wood-600/15 text-wood-600 ring-wood-600/30'
                  }
                >
                  {TASK_STATUS_LABELS[task.status]}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {event.transcription && (
        <section className="space-y-3">
          <Separator />
          <h2 className="text-sm font-semibold text-forest-900">Protokoll</h2>
          <div
            className="prose-content text-base text-forest-800"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: admin-generated WYSIWYG HTML
            dangerouslySetInnerHTML={{ __html: event.transcription }}
          />
        </section>
      )}
    </div>
  )
}
