import {
  Add01Icon,
  ArrowRight01Icon,
  Calendar01Icon,
  ClipboardIcon,
  Delete02Icon,
  FileEditIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { formatGermanDate } from '~/lib/event-helpers'
import { cn } from '~/lib/ui-utils'
import {
  useCarryOverCandidates,
  useCarryOverTask,
  useCreateTask,
  useDeleteTask,
  useUpdateTask,
} from '~/services/event.service'
import { useAdminUsers } from '~/services/user.service'
import { Badge } from '~/ui/badge'
import { Button } from '~/ui/button'
import { DatePicker } from '~/ui/date-picker'
import { Input } from '~/ui/input'
import { Label } from '~/ui/label'
import { Separator } from '~/ui/separator'
import type {
  CreateEventTaskInput,
  EventTask,
  EventWithDetails,
  UpdateEventTaskInput,
} from '~func/contracts/event'
import {
  ConfirmDeleteBar,
  FIELD,
  PersonPicker,
  parseIsoDate,
  TEXTAREA,
  toIsoDate,
} from './form-ui'

type Props = { event: EventWithDetails }

const TASK_STATUS_LABELS: Record<EventTask['status'], string> = {
  open: 'Offen',
  done: 'Erledigt',
}

export default function TasksPanel({ event }: Props) {
  const { data: users } = useAdminUsers()
  const { data: carryOverCandidates } = useCarryOverCandidates(event.slug)
  const { mutate: createTask, isPending: isCreating } = useCreateTask(
    event.slug,
  )
  const { mutate: updateTask, isPending: isUpdating } = useUpdateTask(
    event.slug,
  )
  const { mutate: deleteTask, isPending: isDeleting } = useDeleteTask(
    event.slug,
  )
  const { mutate: carryOverTask, isPending: isCarryingOver } = useCarryOverTask(
    event.slug,
  )

  const sorted = useMemo(
    () =>
      [...event.tasks].sort(
        (a, b) => a.sort_order - b.sort_order || a.id - b.id,
      ),
    [event.tasks],
  )

  const openCount = sorted.filter((t) => t.status === 'open').length
  const doneCount = sorted.length - openCount

  // Drop carry-over candidates that are already on this event
  // (server also does this but we want to be safe).
  const alreadyCarriedSet = useMemo(
    () =>
      new Set(
        sorted
          .map((t) => t.carried_from_task_id)
          .filter((id): id is number => id !== null),
      ),
    [sorted],
  )
  const candidates = useMemo(
    () =>
      (carryOverCandidates ?? []).filter((c) => !alreadyCarriedSet.has(c.id)),
    [carryOverCandidates, alreadyCarriedSet],
  )

  return (
    <div className="space-y-5">
      <CarryOverPanel
        candidates={candidates}
        isPending={isCarryingOver}
        onCarryOver={(id) =>
          carryOverTask(id, {
            onSuccess: () => toast.success('Aufgabe mitgenommen.'),
            onError: () =>
              toast.error('Aufgabe konnte nicht mitgenommen werden.'),
          })
        }
        users={users ?? []}
      />
      <Separator />
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-forest-900">Aufgaben</p>
          <div className="flex flex-wrap gap-2">
            {openCount > 0 && (
              <Badge className="bg-leaf-500/15 text-leaf-500 ring-leaf-500/30">
                {openCount} offen
              </Badge>
            )}
            {doneCount > 0 && (
              <Badge className="bg-wood-600/15 text-wood-600 ring-wood-600/30">
                {doneCount} erledigt
              </Badge>
            )}
          </div>
        </div>
        {sorted.length === 0 ? (
          <p className="text-sm text-forest-700/60">Noch keine Aufgaben.</p>
        ) : (
          <ol className="space-y-3">
            {sorted.map((task) => (
              <li key={task.id}>
                <TaskCard
                  isDeleting={isDeleting}
                  isUpdating={isUpdating}
                  onDelete={() =>
                    deleteTask(task.id, {
                      onSuccess: () => toast.success('Aufgabe gelöscht.'),
                      onError: () => toast.error('Löschen fehlgeschlagen.'),
                    })
                  }
                  onUpdate={(data) =>
                    updateTask(
                      { id: task.id, data },
                      {
                        onSuccess: () => toast.success('Aufgabe aktualisiert.'),
                        onError: () => toast.error('Speichern fehlgeschlagen.'),
                      },
                    )
                  }
                  task={task}
                  users={users ?? []}
                />
              </li>
            ))}
          </ol>
        )}
      </div>

      <Separator />

      <NewTaskForm
        isPending={isCreating}
        onSubmit={(data) =>
          createTask(data, {
            onSuccess: () => toast.success('Aufgabe angelegt.'),
            onError: () => toast.error('Anlegen fehlgeschlagen.'),
          })
        }
        users={users ?? []}
      />
    </div>
  )
}

function TaskCard({
  task,
  users,
  isUpdating,
  isDeleting,
  onUpdate,
  onDelete,
}: {
  task: EventTask
  users: Array<{ id: number; first_name: string; last_name: string }>
  isUpdating: boolean
  isDeleting: boolean
  onUpdate: (data: UpdateEventTaskInput) => void
  onDelete: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isEditing) {
    return (
      <TaskForm
        initial={{
          id: task.id,
          title: task.title,
          owner_user_id: task.owner_user_id,
          owner_name: task.owner_name,
          due_date: task.due_date,
          notes: task.notes,
        }}
        isPending={isUpdating}
        onCancel={() => setIsEditing(false)}
        onSubmit={(data) => {
          onUpdate(data)
          setIsEditing(false)
        }}
        submitLabel="Speichern"
        users={users}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-[1.25rem] bg-white/75 p-4 ring-1 ring-inset ring-white/40 sm:p-5',
        task.status === 'done' && 'opacity-70',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          {task.is_carried_over && (
            <Badge className="bg-forest-900/5 text-forest-700/80 ring-forest-900/10">
              <HugeiconsIcon
                aria-hidden="true"
                className="mr-1"
                icon={ArrowRight01Icon}
                size={10}
                strokeWidth={1.6}
              />
              aus dem letzten Treffen
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            aria-label="Aufgabe bearbeiten"
            className="text-xs"
            onClick={() => setIsEditing(true)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={FileEditIcon}
              size={14}
              strokeWidth={1.6}
            />
            Bearbeiten
          </Button>
          {task.status === 'open' ? (
            <Button
              aria-label="Als erledigt markieren"
              className="text-xs"
              disabled={isUpdating}
              onClick={() => onUpdate({ status: 'done' })}
              size="sm"
              type="button"
              variant="outline"
            >
              Erledigt
            </Button>
          ) : (
            <Button
              aria-label="Wieder öffnen"
              className="text-xs"
              disabled={isUpdating}
              onClick={() => onUpdate({ status: 'open' })}
              size="sm"
              type="button"
              variant="outline"
            >
              Wieder öffnen
            </Button>
          )}
          <Button
            aria-label="Aufgabe löschen"
            className="text-xs text-beet-700 hover:bg-beet-700/10 hover:text-beet-700"
            disabled={isDeleting}
            onClick={() => setConfirmDelete(true)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={Delete02Icon}
              size={14}
              strokeWidth={1.6}
            />
            Löschen
          </Button>
        </div>
      </div>
      <p
        className={cn(
          'mt-2 text-sm text-forest-900',
          task.status === 'done' && 'line-through',
        )}
      >
        {task.title}
      </p>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs text-forest-700/80 sm:grid-cols-2">
        <div>
          <dt className="inline font-semibold text-forest-700">Wer:</dt>{' '}
          <dd className="inline">
            {task.owner_display ?? task.owner_name ?? '–'}
          </dd>
        </div>
        {task.due_date && (
          <div>
            <dt className="inline font-semibold text-forest-700">Bis:</dt>{' '}
            <dd className="inline">
              <HugeiconsIcon
                aria-hidden="true"
                className="mr-0.5 inline-block align-text-bottom"
                icon={Calendar01Icon}
                size={12}
                strokeWidth={1.6}
              />
              {formatGermanDate(task.due_date)}
            </dd>
          </div>
        )}
      </dl>
      {task.notes && (
        <p className="mt-2 whitespace-pre-line text-xs text-forest-700/70">
          {task.notes}
        </p>
      )}

      {confirmDelete && (
        <ConfirmDeleteBar
          isPending={isDeleting}
          message="Aufgabe wirklich löschen?"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            onDelete()
            setConfirmDelete(false)
          }}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: EventTask['status'] }) {
  return (
    <Badge
      className={cn(
        status === 'open'
          ? 'bg-leaf-500/15 text-leaf-500 ring-leaf-500/30'
          : 'bg-wood-600/15 text-wood-600 ring-wood-600/30',
      )}
    >
      {TASK_STATUS_LABELS[status]}
    </Badge>
  )
}

type TaskFormInitial = {
  id: number
  title: string
  owner_user_id: number | null
  owner_name: string | null
  due_date: string | null
  notes: string | null
}

type TaskFormProps = {
  initial?: TaskFormInitial
  users: Array<{ id: number; first_name: string; last_name: string }>
  isPending: boolean
  onCancel?: () => void
  onSubmit: (data: CreateEventTaskInput | UpdateEventTaskInput) => void
  submitLabel?: string
}

function TaskForm({
  initial,
  users,
  isPending,
  onCancel,
  onSubmit,
  submitLabel = 'Aufgabe anlegen',
}: TaskFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [ownerUserId, setOwnerUserId] = useState<number | ''>(
    initial?.owner_user_id ?? '',
  )
  const [ownerName, setOwnerName] = useState(initial?.owner_name ?? '')
  const [dueDate, setDueDate] = useState<Date | undefined>(
    initial?.due_date ? parseIsoDate(initial.due_date) : undefined,
  )
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const userOptions = users
    .slice()
    .sort((a, b) => a.last_name.localeCompare(b.last_name))
  const idPrefix = initial ? String(initial.id) : 'new'

  function handleSubmit() {
    if (!title.trim()) {
      toast.error('Bitte einen Titel eingeben.')
      return
    }
    const hasOwner = ownerUserId !== '' || ownerName.trim() !== ''
    if (!hasOwner) {
      toast.error('Bitte eine zuständige Person angeben.')
      return
    }
    onSubmit({
      title: title.trim(),
      owner_user_id: ownerUserId === '' ? null : ownerUserId,
      owner_name: ownerName.trim() ? ownerName.trim() : null,
      due_date: dueDate ? toIsoDate(dueDate) : null,
      notes: notes.trim() ? notes.trim() : null,
    })
  }

  return (
    <div className="rounded-[1.25rem] bg-forest-900/4 p-4 ring-1 ring-inset ring-forest-900/8 sm:p-5">
      <div className="space-y-1.5">
        <Label htmlFor={`task-title-${idPrefix}`}>Aufgabe</Label>
        <Input
          className={FIELD}
          id={`task-title-${idPrefix}`}
          maxLength={300}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={'z. B. „Werkstatt-Schlüssel bei Tom abholen.“'}
          value={title}
        />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <PersonPicker
          freeTextValue={ownerName}
          idPrefix={`task-owner-${idPrefix}`}
          label="Zuständig"
          onFreeTextChange={setOwnerName}
          onUserChange={(v) => {
            setOwnerUserId(v)
            if (v !== '') setOwnerName('')
          }}
          userValue={ownerUserId}
          users={userOptions}
        />
        <div className="space-y-1.5">
          <Label>Frist (optional)</Label>
          <DatePicker
            onChange={setDueDate}
            placeholder="Kein Datum"
            value={dueDate}
          />
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Label htmlFor={`task-notes-${idPrefix}`}>Notizen (optional)</Label>
        <textarea
          className={TEXTAREA}
          id={`task-notes-${idPrefix}`}
          maxLength={50000}
          onChange={(e) => setNotes(e.target.value)}
          value={notes}
        />
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button onClick={onCancel} size="sm" type="button" variant="outline">
            Abbrechen
          </Button>
        )}
        <Button
          className={cn(isPending && 'opacity-60')}
          disabled={isPending}
          onClick={handleSubmit}
          size="sm"
          type="button"
        >
          {isPending ? 'Wird gespeichert …' : submitLabel}
        </Button>
      </div>
    </div>
  )
}

function NewTaskForm(props: {
  users: Array<{ id: number; first_name: string; last_name: string }>
  isPending: boolean
  onSubmit: (data: CreateEventTaskInput) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  if (!isOpen) {
    return (
      <div className="flex justify-end">
        <Button
          onClick={() => setIsOpen(true)}
          size="sm"
          type="button"
          variant="outline"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={Add01Icon}
            size={14}
            strokeWidth={1.8}
          />
          Neue Aufgabe
        </Button>
      </div>
    )
  }
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-forest-900">Neue Aufgabe</p>
      <TaskForm
        {...props}
        onCancel={() => setIsOpen(false)}
        onSubmit={(data) => {
          props.onSubmit(data as CreateEventTaskInput)
          setIsOpen(false)
        }}
      />
    </div>
  )
}

function CarryOverPanel({
  candidates,
  users,
  isPending,
  onCarryOver,
}: {
  candidates: Array<{
    id: number
    event_id: number
    title: string
    owner_user_id: number | null
    owner_name: string | null
    due_date: string | null
  }>
  users: Array<{ id: number; first_name: string; last_name: string }>
  isPending: boolean
  onCarryOver: (fromTaskId: number) => void
}) {
  if (candidates.length === 0) return null
  const userById = new Map(users.map((u) => [u.id, u]))
  return (
    <section className="space-y-2 rounded-[1.25rem] bg-leaf-500/8 p-4 ring-1 ring-inset ring-leaf-500/30 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-leaf-500/20 text-leaf-500">
          <HugeiconsIcon
            aria-hidden="true"
            icon={ClipboardIcon}
            size={18}
            strokeWidth={1.6}
          />
        </span>
        <div>
          <p className="text-sm font-semibold text-forest-900">
            Aus dem letzten Treffen
          </p>
          <p className="text-xs text-forest-700/80">
            {candidates.length === 1
              ? 'Eine offene Aufgabe wartet auf eine Mitnahme.'
              : `${candidates.length} offene Aufgaben warten auf eine Mitnahme.`}
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {candidates.map((c) => {
          const owner =
            c.owner_user_id !== null ? userById.get(c.owner_user_id) : null
          const ownerLabel = owner
            ? `${owner.first_name} ${owner.last_name}`.trim()
            : c.owner_name
          return (
            <li
              className="flex flex-col gap-2 rounded-[1rem] bg-white/80 p-3 ring-1 ring-inset ring-leaf-500/30 sm:flex-row sm:items-center sm:justify-between"
              key={c.id}
            >
              <div className="flex-1 space-y-0.5">
                <p className="text-sm font-medium text-forest-900">{c.title}</p>
                <p className="text-xs text-forest-700/70">
                  {ownerLabel ? `Zuständig: ${ownerLabel}` : 'Ohne Zuständige'}
                  {c.due_date && ` · Frist ${formatGermanDate(c.due_date)}`}
                </p>
              </div>
              <Button
                aria-label={`„${c.title}" mitnehmen`}
                className="shrink-0 text-xs"
                disabled={isPending}
                onClick={() => onCarryOver(c.id)}
                size="sm"
                type="button"
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  className="mr-1"
                  icon={ArrowRight01Icon}
                  size={14}
                  strokeWidth={1.6}
                />
                Mitnehmen
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
