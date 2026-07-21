import {
  Delete02Icon,
  Edit02Icon,
  PauseIcon,
  PlayIcon,
  PlusSignIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Navigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import { useMe } from '~/services/auth.service'
import {
  useDeleteTaskSeries,
  useTaskMembers,
  useTasks,
  useUpdateTaskSeries,
} from '~/services/task.service'
import { Button } from '~/ui/button'
import type { SessionUser } from '~func/contracts/auth'
import {
  CLOSED_TASK_STATES,
  type Task,
  type TaskSeries,
} from '~func/contracts/task'
import MemberShell from './MemberShell'
import TaskCard from './TaskCard'
import TaskFormDialog from './TaskFormDialog'
import TaskSeriesDialog from './TaskSeriesDialog'
import { intervalLabel } from './task-ui'

export default function TasksPage() {
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
      <TasksContent me={me} />
    </MemberShell>
  )
}

function TasksContent({ me }: { me: SessionUser }) {
  const { data, isPending, isError } = useTasks()
  const { data: members = [] } = useTaskMembers()

  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editingSeries, setEditingSeries] = useState<TaskSeries | null>(null)

  const tasks = data?.tasks ?? []
  const series = data?.series ?? []
  const openTasks = tasks.filter((t) => !CLOSED_TASK_STATES.includes(t.state))
  const closedTasks = tasks.filter((t) => CLOSED_TASK_STATES.includes(t.state))

  function openNew() {
    setEditingTask(null)
    setFormOpen(true)
  }
  function openEdit(task: Task) {
    setEditingTask(task)
    setFormOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl text-forest-900">Aufgaben</h1>
          <p className="text-sm text-forest-700/70">
            Gemeinsame To-do-Liste des Vereins – einmalig oder wiederkehrend,
            mit Zuständigkeit, Fälligkeit und Checkliste.
          </p>
        </div>
        <Button onClick={openNew}>
          <HugeiconsIcon
            aria-hidden="true"
            icon={PlusSignIcon}
            size={16}
            strokeWidth={1.6}
          />
          Neue Aufgabe
        </Button>
      </div>

      {isPending ? (
        <p className="py-8 text-center text-sm text-forest-700/60">
          Wird geladen …
        </p>
      ) : isError ? (
        <p className="py-8 text-center text-sm text-beet-700">
          Aufgaben konnten nicht geladen werden.
        </p>
      ) : (
        <>
          <section className="space-y-3">
            {openTasks.length === 0 ? (
              <p className="py-8 text-center text-sm text-forest-700/60">
                Keine offenen Aufgaben. Zeit für eine neue?
              </p>
            ) : (
              <ul className="space-y-3">
                {openTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    me={me}
                    onEdit={openEdit}
                    task={task}
                  />
                ))}
              </ul>
            )}
          </section>

          {series.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-forest-700/70">
                Wiederkehrende Serien
              </h2>
              <ul className="space-y-2">
                {series.map((s) => (
                  <SeriesRow
                    key={s.id}
                    me={me}
                    onEdit={setEditingSeries}
                    series={s}
                  />
                ))}
              </ul>
            </section>
          )}

          {closedTasks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-forest-700/70">
                Erledigt &amp; abgebrochen ({closedTasks.length})
              </h2>
              <ul className="space-y-3">
                {closedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    me={me}
                    onEdit={openEdit}
                    task={task}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <TaskFormDialog
        editing={editingTask}
        members={members}
        onOpenChange={setFormOpen}
        open={formOpen}
      />
      <TaskSeriesDialog
        editing={editingSeries}
        members={members}
        onOpenChange={(open) => {
          if (!open) setEditingSeries(null)
        }}
        open={editingSeries !== null}
      />
    </div>
  )
}

function SeriesRow({
  series,
  me,
  onEdit,
}: {
  series: TaskSeries
  me: SessionUser
  onEdit: (series: TaskSeries) => void
}) {
  const { mutate: updateSeries, isPending: isToggling } = useUpdateTaskSeries()
  const { mutate: deleteSeries, isPending: isDeleting } = useDeleteTaskSeries()

  const canDelete =
    me.role === 'admin' || series.created_by_user_id === me.user_id

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/60 px-4 py-3 ring-1 ring-inset ring-white/40">
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium text-forest-900">{series.title}</p>
        <p className="text-xs text-forest-700/60">
          {intervalLabel(series.interval_count, series.interval_unit)}
          {series.active
            ? ` · nächste am ${dayjs(series.next_occurrence_date).tz(DEFAULT_TIMEZONE).format('D. MMM YYYY')}`
            : ' · pausiert'}
          {series.assignee_name && ` · ${series.assignee_name}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          aria-label={series.active ? 'Serie pausieren' : 'Serie fortsetzen'}
          disabled={isToggling}
          onClick={() =>
            updateSeries({ id: series.id, data: { active: !series.active } })
          }
          size="icon-sm"
          variant="ghost"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={series.active ? PauseIcon : PlayIcon}
            size={16}
            strokeWidth={1.6}
          />
        </Button>
        <Button
          aria-label="Serie bearbeiten"
          onClick={() => onEdit(series)}
          size="icon-sm"
          variant="ghost"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={Edit02Icon}
            size={16}
            strokeWidth={1.6}
          />
        </Button>
        {canDelete && (
          <Button
            aria-label="Serie beenden"
            disabled={isDeleting}
            onClick={() => {
              if (
                !confirm(
                  'Serie beenden? Bereits erstellte Aufgaben bleiben erhalten.',
                )
              )
                return
              deleteSeries(series.id, {
                onError: () => toast.error('Löschen fehlgeschlagen.'),
              })
            }}
            size="icon-sm"
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
    </li>
  )
}
