import {
  Calendar01Icon,
  Delete02Icon,
  Edit02Icon,
  PlusSignIcon,
  RepeatIcon,
  UserIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { formatEuro } from '~/lib/money'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import { cn } from '~/lib/ui-utils'
import {
  useAddSubtask,
  useDeleteSubtask,
  useDeleteTask,
  useUpdateSubtask,
  useUpdateTask,
} from '~/services/task.service'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import type { SessionUser } from '~func/contracts/auth'
import {
  CLOSED_TASK_STATES,
  TASK_STATE_LABELS,
  TASK_STATES,
  type Task,
  type TaskState,
} from '~func/contracts/task'
import { FIELD, StateBadge } from './task-ui'

function formatDue(date: string): string {
  return dayjs(date).tz(DEFAULT_TIMEZONE).format('dd, D. MMM YYYY')
}

export default function TaskCard({
  task,
  me,
  onEdit,
}: {
  task: Task
  me: SessionUser
  onEdit: (task: Task) => void
}) {
  const { mutate: updateTask } = useUpdateTask()
  const { mutate: deleteTask, isPending: isDeleting } = useDeleteTask()
  const { mutate: addSubtask, isPending: isAdding } = useAddSubtask()
  const { mutate: updateSubtask } = useUpdateSubtask()
  const { mutate: deleteSubtask } = useDeleteSubtask()
  const [newSubtask, setNewSubtask] = useState('')

  const canDelete =
    me.role === 'admin' || task.created_by_user_id === me.user_id
  const isClosed = CLOSED_TASK_STATES.includes(task.state)
  const doneCount = task.subtasks.filter((s) => s.done).length
  const isOverdue =
    !isClosed &&
    task.due_date != null &&
    task.due_date < dayjs().tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD')

  function handleAddSubtask(e: React.FormEvent) {
    e.preventDefault()
    if (!newSubtask.trim()) return
    addSubtask(
      { id: task.id, data: { title: newSubtask.trim(), description: null } },
      {
        onSuccess: () => setNewSubtask(''),
        onError: () => toast.error('Teilaufgabe konnte nicht angelegt werden.'),
      },
    )
  }

  return (
    <li
      className={cn(
        'rounded-[1.25rem] bg-white/75 p-4 shadow-[0_4px_16px_rgba(31,61,43,0.06)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-5',
        isClosed && 'opacity-70',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn(
                'font-medium text-forest-900',
                task.state === 'abgeschlossen' && 'line-through',
              )}
            >
              {task.title}
            </p>
            {task.series_id != null && (
              <HugeiconsIcon
                aria-label="Wiederkehrend"
                className="text-forest-700/50"
                icon={RepeatIcon}
                size={14}
                strokeWidth={1.6}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-forest-700/60">
            {task.assignee_name && (
              <span className="inline-flex items-center gap-1">
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={UserIcon}
                  size={12}
                  strokeWidth={1.6}
                />
                {task.assignee_name}
              </span>
            )}
            {task.due_date && (
              <span
                className={cn(
                  'inline-flex items-center gap-1',
                  isOverdue && 'font-medium text-beet-700',
                )}
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={Calendar01Icon}
                  size={12}
                  strokeWidth={1.6}
                />
                {formatDue(task.due_date)}
              </span>
            )}
            {task.price_estimate_cents != null && (
              <span>{formatEuro(task.price_estimate_cents)}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StateBadge state={task.state} />
          <Button
            aria-label="Aufgabe bearbeiten"
            onClick={() => onEdit(task)}
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
              aria-label="Aufgabe löschen"
              disabled={isDeleting}
              onClick={() => {
                if (!confirm('Diese Aufgabe wirklich löschen?')) return
                deleteTask(task.id, {
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
      </div>

      {task.description && (
        <p className="mt-2 text-sm whitespace-pre-wrap text-forest-700/80">
          {task.description}
        </p>
      )}

      {(task.subtasks.length > 0 || !isClosed) && (
        <div className="mt-3 space-y-1.5">
          {task.subtasks.length > 0 && (
            <p className="text-xs font-medium text-forest-700/60">
              Checkliste {doneCount}/{task.subtasks.length}
            </p>
          )}
          <ul className="space-y-1">
            {task.subtasks.map((sub) => (
              <li className="group flex items-center gap-2" key={sub.id}>
                <input
                  aria-label={sub.title}
                  checked={sub.done}
                  className="size-4 shrink-0 accent-forest-700"
                  onChange={(e) =>
                    updateSubtask({
                      id: task.id,
                      subId: sub.id,
                      data: { done: e.target.checked },
                    })
                  }
                  type="checkbox"
                />
                <span
                  className={cn(
                    'flex-1 text-sm text-forest-800',
                    sub.done && 'text-forest-700/50 line-through',
                  )}
                >
                  {sub.title}
                </span>
                <Button
                  aria-label="Teilaufgabe entfernen"
                  className="opacity-0 transition group-hover:opacity-100"
                  onClick={() => deleteSubtask({ id: task.id, subId: sub.id })}
                  size="icon-xs"
                  variant="ghost"
                >
                  <HugeiconsIcon
                    aria-hidden="true"
                    icon={Delete02Icon}
                    size={14}
                    strokeWidth={1.6}
                  />
                </Button>
              </li>
            ))}
          </ul>
          {!isClosed && (
            <form className="flex gap-2" onSubmit={handleAddSubtask}>
              <Input
                className={cn(FIELD, 'h-9 py-1.5 text-sm')}
                maxLength={200}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="Teilaufgabe hinzufügen …"
                value={newSubtask}
              />
              <Button
                disabled={isAdding || !newSubtask.trim()}
                size="icon"
                type="submit"
                variant="outline"
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={PlusSignIcon}
                  size={16}
                  strokeWidth={1.6}
                />
              </Button>
            </form>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <label
          className="text-xs text-forest-700/50"
          htmlFor={`state-${task.id}`}
        >
          Status ändern
        </label>
        <select
          className="h-8 rounded-full border border-forest-900/12 bg-white/80 px-2 text-xs text-forest-900 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none"
          id={`state-${task.id}`}
          onChange={(e) =>
            updateTask({
              id: task.id,
              data: { state: e.target.value as TaskState },
            })
          }
          value={task.state}
        >
          {TASK_STATES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
    </li>
  )
}
