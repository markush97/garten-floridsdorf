import { Delete02Icon, PlusSignIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { IsoDateField } from '~/components/admin/form-ui'
import { formatEuro, parseEuroToCents } from '~/lib/money'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import { useCreateTask, useUpdateTask } from '~/services/task.service'
import { Button } from '~/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/ui/dialog'
import { Input } from '~/ui/input'
import { Label } from '~/ui/label'
import {
  type CreateTaskInput,
  TASK_INTERVAL_UNIT_LABELS,
  TASK_INTERVAL_UNITS,
  TASK_STATE_LABELS,
  TASK_STATES,
  type Task,
  type TaskIntervalUnit,
  type TaskMember,
  type TaskState,
} from '~func/contracts/task'
import { FIELD, SELECT, TEXTAREA } from './task-ui'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: TaskMember[]
  editing: Task | null
}

function today(): string {
  return dayjs().tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD')
}

type SubtaskDraft = { title: string; description: string }

export default function TaskFormDialog({
  open,
  onOpenChange,
  members,
  editing,
}: Props) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {/* Remount on target change so the form resets cleanly. */}
        <TaskForm
          editing={editing}
          key={editing?.id ?? 'new'}
          members={members}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function TaskForm({
  editing,
  members,
  onDone,
}: {
  editing: Task | null
  members: TaskMember[]
  onDone: () => void
}) {
  const { mutateAsync: createTask, isPending: isCreating } = useCreateTask()
  const { mutateAsync: updateTask, isPending: isUpdating } = useUpdateTask()

  const [title, setTitle] = useState(editing?.title ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [state, setState] = useState<TaskState>(editing?.state ?? 'idee')
  const [assignee, setAssignee] = useState<string>(
    editing?.assignee_user_id != null ? String(editing.assignee_user_id) : '',
  )
  const [price, setPrice] = useState(
    editing?.price_estimate_cents != null
      ? (editing.price_estimate_cents / 100).toFixed(2).replace('.', ',')
      : '',
  )
  const [dueDate, setDueDate] = useState(editing?.due_date ?? '')

  // Recurrence + initial checklist only apply when creating.
  const [recurring, setRecurring] = useState(false)
  const [intervalCount, setIntervalCount] = useState('1')
  const [intervalUnit, setIntervalUnit] = useState<TaskIntervalUnit>('week')
  const [startDate, setStartDate] = useState(today())
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([])

  const isPending = isCreating || isUpdating

  function addSubtaskRow() {
    setSubtasks((prev) => [...prev, { title: '', description: '' }])
  }
  function updateSubtaskRow(i: number, patch: Partial<SubtaskDraft>) {
    setSubtasks((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    )
  }
  function removeSubtaskRow(i: number) {
    setSubtasks((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Bitte einen Titel eingeben.')
      return
    }
    let priceCents: number | null = null
    if (price.trim()) {
      priceCents = parseEuroToCents(price)
      if (priceCents === null) {
        toast.error('Bitte einen gültigen Betrag angeben.')
        return
      }
    }
    const intervalCountNum = Number(intervalCount)
    if (
      recurring &&
      (!Number.isInteger(intervalCountNum) || intervalCountNum < 1)
    ) {
      toast.error('Bitte ein gültiges Intervall angeben.')
      return
    }

    try {
      if (editing) {
        await updateTask({
          id: editing.id,
          data: {
            title: title.trim(),
            description: description.trim() || null,
            state,
            price_estimate_cents: priceCents,
            due_date: dueDate || null,
            assignee_user_id: assignee ? Number(assignee) : null,
          },
        })
        toast.success('Aufgabe aktualisiert.')
      } else {
        const payload: CreateTaskInput = {
          title: title.trim(),
          description: description.trim() || null,
          state,
          price_estimate_cents: priceCents,
          due_date: recurring ? null : dueDate || null,
          assignee_user_id: assignee ? Number(assignee) : null,
          subtasks: subtasks
            .filter((s) => s.title.trim())
            .map((s) => ({
              title: s.title.trim(),
              description: s.description.trim() || null,
            })),
          recurrence: recurring
            ? {
                interval_count: intervalCountNum,
                interval_unit: intervalUnit,
                start_date: startDate,
              }
            : null,
        }
        await createTask(payload)
        toast.success(recurring ? 'Serie angelegt.' : 'Aufgabe angelegt.')
      }
      onDone()
    } catch {
      toast.error('Speichern fehlgeschlagen.')
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>
          {editing ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
        </DialogTitle>
        <DialogDescription>
          Titel, Beschreibung, Zuständigkeit und Status. Optional mit
          Kostenschätzung, Fälligkeit und Teilaufgaben.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="task-title">Titel</Label>
        <Input
          className={FIELD}
          id="task-title"
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="z. B. Gemeinschaftsbeet gießen"
          required
          value={title}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="task-desc">Beschreibung</Label>
        <textarea
          className={TEXTAREA}
          id="task-desc"
          maxLength={5000}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Details, Kontext, Hinweise …"
          value={description}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="task-state">Status</Label>
          <select
            className={SELECT}
            id="task-state"
            onChange={(e) => setState(e.target.value as TaskState)}
            value={state}
          >
            {TASK_STATES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="task-assignee">Zuständig</Label>
          <select
            className={SELECT}
            id="task-assignee"
            onChange={(e) => setAssignee(e.target.value)}
            value={assignee}
          >
            <option value="">Niemand</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="task-price">Kostenschätzung (€, optional)</Label>
          <Input
            className={FIELD}
            id="task-price"
            inputMode="decimal"
            onChange={(e) => setPrice(e.target.value)}
            placeholder="z. B. 120,00"
            value={price}
          />
        </div>
        {!recurring && (
          <div className="space-y-1.5">
            <Label>Fällig am (optional)</Label>
            <IsoDateField
              onChange={setDueDate}
              placeholder="Kein Datum"
              value={dueDate}
            />
          </div>
        )}
      </div>

      {!editing && (
        <>
          <div className="rounded-2xl border border-forest-900/12 bg-white/60 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-forest-900">
              <input
                checked={recurring}
                className="size-4 accent-forest-700"
                onChange={(e) => setRecurring(e.target.checked)}
                type="checkbox"
              />
              Wiederkehrend
            </label>
            {recurring && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="task-interval-count">Alle</Label>
                  <Input
                    className={FIELD}
                    id="task-interval-count"
                    inputMode="numeric"
                    min={1}
                    onChange={(e) => setIntervalCount(e.target.value)}
                    type="number"
                    value={intervalCount}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="task-interval-unit">Einheit</Label>
                  <select
                    className={SELECT}
                    id="task-interval-unit"
                    onChange={(e) =>
                      setIntervalUnit(e.target.value as TaskIntervalUnit)
                    }
                    value={intervalUnit}
                  >
                    {TASK_INTERVAL_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {TASK_INTERVAL_UNIT_LABELS[u]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Erste Fälligkeit</Label>
                  <IsoDateField
                    onChange={setStartDate}
                    required
                    value={startDate}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Teilaufgaben (Checkliste)</Label>
              <Button
                onClick={addSubtaskRow}
                size="sm"
                type="button"
                variant="outline"
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={PlusSignIcon}
                  size={14}
                  strokeWidth={1.6}
                />
                Hinzufügen
              </Button>
            </div>
            {subtasks.map((s, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: draft rows have no stable id
              <div className="flex gap-2" key={i}>
                <Input
                  className={FIELD}
                  maxLength={200}
                  onChange={(e) =>
                    updateSubtaskRow(i, { title: e.target.value })
                  }
                  placeholder="Teilaufgabe"
                  value={s.title}
                />
                <Button
                  aria-label="Teilaufgabe entfernen"
                  onClick={() => removeSubtaskRow(i)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <HugeiconsIcon
                    aria-hidden="true"
                    icon={Delete02Icon}
                    size={16}
                    strokeWidth={1.6}
                  />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      {price.trim() && parseEuroToCents(price) !== null && (
        <p className="text-xs text-forest-700/60">
          Geschätzte Kosten: {formatEuro(parseEuroToCents(price) as number)}
        </p>
      )}

      <DialogFooter>
        <Button
          disabled={isPending}
          onClick={onDone}
          type="button"
          variant="outline"
        >
          Abbrechen
        </Button>
        <Button disabled={isPending} type="submit">
          {isPending ? 'Wird gespeichert …' : editing ? 'Speichern' : 'Anlegen'}
        </Button>
      </DialogFooter>
    </form>
  )
}
