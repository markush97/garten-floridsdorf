import { useState } from 'react'
import { toast } from 'sonner'
import { parseEuroToCents } from '~/lib/money'
import { useUpdateTaskSeries } from '~/services/task.service'
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
  TASK_INTERVAL_UNIT_LABELS,
  TASK_INTERVAL_UNITS,
  TASK_STATE_LABELS,
  TASK_STATES,
  type TaskIntervalUnit,
  type TaskMember,
  type TaskSeries,
  type TaskState,
} from '~func/contracts/task'
import { FIELD, SELECT, TEXTAREA } from './task-ui'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: TaskMember[]
  editing: TaskSeries | null
}

export default function TaskSeriesDialog({
  open,
  onOpenChange,
  members,
  editing,
}: Props) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {editing && (
          <SeriesForm
            editing={editing}
            key={editing.id}
            members={members}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function SeriesForm({
  editing,
  members,
  onDone,
}: {
  editing: TaskSeries
  members: TaskMember[]
  onDone: () => void
}) {
  const { mutateAsync: updateSeries, isPending } = useUpdateTaskSeries()

  const [title, setTitle] = useState(editing.title)
  const [description, setDescription] = useState(editing.description ?? '')
  const [state, setState] = useState<TaskState>(editing.state)
  const [assignee, setAssignee] = useState<string>(
    editing.assignee_user_id != null ? String(editing.assignee_user_id) : '',
  )
  const [price, setPrice] = useState(
    editing.price_estimate_cents != null
      ? (editing.price_estimate_cents / 100).toFixed(2).replace('.', ',')
      : '',
  )
  const [intervalCount, setIntervalCount] = useState(
    String(editing.interval_count),
  )
  const [intervalUnit, setIntervalUnit] = useState<TaskIntervalUnit>(
    editing.interval_unit,
  )
  const [nextDate, setNextDate] = useState(editing.next_occurrence_date)

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
    if (!Number.isInteger(intervalCountNum) || intervalCountNum < 1) {
      toast.error('Bitte ein gültiges Intervall angeben.')
      return
    }
    try {
      await updateSeries({
        id: editing.id,
        data: {
          title: title.trim(),
          description: description.trim() || null,
          state,
          price_estimate_cents: priceCents,
          assignee_user_id: assignee ? Number(assignee) : null,
          interval_count: intervalCountNum,
          interval_unit: intervalUnit,
          next_occurrence_date: nextDate,
        },
      })
      toast.success('Serie aktualisiert.')
      onDone()
    } catch {
      toast.error('Speichern fehlgeschlagen.')
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Serie bearbeiten</DialogTitle>
        <DialogDescription>
          Vorlage und Rhythmus. Änderungen wirken auf künftige Wiederholungen;
          bereits erstellte Aufgaben bleiben unverändert.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="series-title">Titel</Label>
        <Input
          className={FIELD}
          id="series-title"
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          required
          value={title}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="series-desc">Beschreibung</Label>
        <textarea
          className={TEXTAREA}
          id="series-desc"
          maxLength={5000}
          onChange={(e) => setDescription(e.target.value)}
          value={description}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="series-state">Start-Status</Label>
          <select
            className={SELECT}
            id="series-state"
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
          <Label htmlFor="series-assignee">Zuständig</Label>
          <select
            className={SELECT}
            id="series-assignee"
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

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="series-price">Kosten (€)</Label>
          <Input
            className={FIELD}
            id="series-price"
            inputMode="decimal"
            onChange={(e) => setPrice(e.target.value)}
            placeholder="optional"
            value={price}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="series-interval-count">Alle</Label>
          <Input
            className={FIELD}
            id="series-interval-count"
            inputMode="numeric"
            min={1}
            onChange={(e) => setIntervalCount(e.target.value)}
            type="number"
            value={intervalCount}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="series-interval-unit">Einheit</Label>
          <select
            className={SELECT}
            id="series-interval-unit"
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
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="series-next">Nächste Fälligkeit</Label>
        <Input
          className={FIELD}
          id="series-next"
          onChange={(e) => setNextDate(e.target.value)}
          type="date"
          value={nextDate}
        />
      </div>

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
          {isPending ? 'Wird gespeichert …' : 'Speichern'}
        </Button>
      </DialogFooter>
    </form>
  )
}
