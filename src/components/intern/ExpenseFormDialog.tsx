import { useState } from 'react'
import { toast } from 'sonner'
import { parseEuroToCents } from '~/lib/money'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import {
  useCreateExpense,
  useUpdateExpense,
  useUploadReceipt,
} from '~/services/bookkeeping.service'
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
  EXPENSE_CADENCE_LABELS,
  EXPENSE_CADENCES,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_TYPE_LABELS,
  EXPENSE_TYPES,
  type ExpenseCadence,
  type ExpenseCategory,
  type ExpenseSummary,
  type ExpenseType,
  type KassaMember,
  PAID_FROM,
  PAID_FROM_LABELS,
  type PaidFrom,
  SETTLEMENT,
  SETTLEMENT_LABELS,
  type Settlement,
} from '~func/contracts/bookkeeping'
import { FIELD, SELECT } from './kassa-ui'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: KassaMember[]
  editing: ExpenseSummary | null
}

function today(): string {
  return dayjs().tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD')
}

export default function ExpenseFormDialog({
  open,
  onOpenChange,
  members,
  editing,
}: Props) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {/* Remount on target change so the form resets cleanly. */}
        <ExpenseForm
          editing={editing}
          key={editing?.id ?? 'new'}
          members={members}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function ExpenseForm({
  editing,
  members,
  onDone,
}: {
  editing: ExpenseSummary | null
  members: KassaMember[]
  onDone: () => void
}) {
  const { mutateAsync: createExpense, isPending: isCreating } =
    useCreateExpense()
  const { mutateAsync: updateExpense, isPending: isUpdating } =
    useUpdateExpense()
  const { mutateAsync: uploadReceipt, isPending: isUploading } =
    useUploadReceipt()

  const [description, setDescription] = useState(editing?.description ?? '')
  const [amount, setAmount] = useState(
    editing ? (editing.amount_cents / 100).toFixed(2).replace('.', ',') : '',
  )
  const [expenseDate, setExpenseDate] = useState(
    editing?.expense_date ?? today(),
  )
  const [type, setType] = useState<ExpenseType>(editing?.type ?? 'expected')
  const [category, setCategory] = useState<ExpenseCategory>(
    editing?.category ?? 'sonstiges',
  )
  const [cadence, setCadence] = useState<ExpenseCadence>(
    editing?.cadence ?? 'one_time',
  )
  const [projectName, setProjectName] = useState(editing?.project_name ?? '')
  const [paidFrom, setPaidFrom] = useState<PaidFrom>(
    editing?.paid_from ?? 'verein',
  )
  const [paidByUserId, setPaidByUserId] = useState<string>(
    editing?.paid_by_user_id != null ? String(editing.paid_by_user_id) : '',
  )
  const [settlement, setSettlement] = useState<Settlement>(
    editing?.settlement ?? 'verein',
  )
  const [file, setFile] = useState<File | null>(null)

  const isPending = isCreating || isUpdating || isUploading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountCents = parseEuroToCents(amount)
    if (!description.trim()) {
      toast.error('Bitte angeben, was gekauft wurde.')
      return
    }
    if (amountCents === null || amountCents < 1) {
      toast.error('Bitte einen gültigen Betrag angeben.')
      return
    }
    if (type === 'project' && !projectName.trim()) {
      toast.error('Bitte das Projekt benennen.')
      return
    }
    if (paidFrom === 'member' && !paidByUserId) {
      toast.error('Bitte angeben, welches Mitglied bezahlt hat.')
      return
    }

    const payload = {
      description: description.trim(),
      amount_cents: amountCents,
      expense_date: expenseDate,
      type,
      category,
      cadence,
      project_name: type === 'project' ? projectName.trim() : null,
      paid_from: paidFrom,
      paid_by_user_id: paidFrom === 'member' ? Number(paidByUserId) : null,
      settlement,
    }

    try {
      const saved = editing
        ? await updateExpense({ id: editing.id, data: payload })
        : await createExpense(payload)
      if (file) {
        await uploadReceipt({ id: saved.id, file })
      }
      toast.success(
        editing ? 'Rechnung aktualisiert.' : 'Rechnung hochgeladen.',
      )
      onDone()
    } catch {
      toast.error('Speichern fehlgeschlagen.')
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>
          {editing ? 'Rechnung bearbeiten' : 'Rechnung hochladen'}
        </DialogTitle>
        <DialogDescription>
          Trag ein, was gekauft wurde, wer bezahlt hat und wer die Kosten tragen
          soll. Ein Kassier gibt die Rechnung anschließend frei.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="exp-desc">Was wurde gekauft?</Label>
        <Input
          className={FIELD}
          id="exp-desc"
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="z. B. Rasenmäher-Reparatur"
          required
          value={description}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="exp-amount">Betrag (€)</Label>
          <Input
            className={FIELD}
            id="exp-amount"
            inputMode="decimal"
            onChange={(e) => setAmount(e.target.value)}
            placeholder="z. B. 49,90"
            required
            value={amount}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp-date">Datum</Label>
          <Input
            className={FIELD}
            id="exp-date"
            onChange={(e) => setExpenseDate(e.target.value)}
            required
            type="date"
            value={expenseDate}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="exp-type">Art</Label>
          <select
            className={SELECT}
            id="exp-type"
            onChange={(e) => setType(e.target.value as ExpenseType)}
            value={type}
          >
            {EXPENSE_TYPES.map((t) => (
              <option key={t} value={t}>
                {EXPENSE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp-category">Kategorie</Label>
          <select
            className={SELECT}
            id="exp-category"
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            value={category}
          >
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {EXPENSE_CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {type === 'project' && (
        <div className="space-y-1.5">
          <Label htmlFor="exp-project">Projekt</Label>
          <Input
            className={FIELD}
            id="exp-project"
            maxLength={500}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="z. B. Neuer Zaun"
            value={projectName}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="exp-cadence">Häufigkeit</Label>
        <select
          className={SELECT}
          id="exp-cadence"
          onChange={(e) => setCadence(e.target.value as ExpenseCadence)}
          value={cadence}
        >
          {EXPENSE_CADENCES.map((c) => (
            <option key={c} value={c}>
              {EXPENSE_CADENCE_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="exp-paidfrom">Bezahlt von</Label>
          <select
            className={SELECT}
            id="exp-paidfrom"
            onChange={(e) => setPaidFrom(e.target.value as PaidFrom)}
            value={paidFrom}
          >
            {PAID_FROM.map((p) => (
              <option key={p} value={p}>
                {PAID_FROM_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        {paidFrom === 'member' && (
          <div className="space-y-1.5">
            <Label htmlFor="exp-payer">Wer hat ausgelegt?</Label>
            <select
              className={SELECT}
              id="exp-payer"
              onChange={(e) => setPaidByUserId(e.target.value)}
              value={paidByUserId}
            >
              <option value="">Bitte wählen …</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="exp-settlement">Wer trägt die Kosten?</Label>
        <select
          className={SELECT}
          id="exp-settlement"
          onChange={(e) => setSettlement(e.target.value as Settlement)}
          value={settlement}
        >
          {SETTLEMENT.map((s) => (
            <option key={s} value={s}>
              {SETTLEMENT_LABELS[s]}
            </option>
          ))}
        </select>
        <p className="text-xs text-forest-700/60">
          „Auf alle aufgeteilt“ verteilt die Kosten zu gleichen Teilen auf alle
          Mitglieder (inkl. bezahlender Person).
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="exp-receipt">
          Beleg {editing?.has_receipt ? '(ersetzen, optional)' : '(optional)'}
        </Label>
        <input
          accept="image/*,application/pdf"
          className="block w-full text-sm text-forest-700 file:mr-3 file:rounded-full file:border-0 file:bg-forest-900/8 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-forest-900"
          id="exp-receipt"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          type="file"
        />
        {editing?.has_receipt && (
          <p className="text-xs text-forest-700/60">
            Aktueller Beleg: {editing.receipt_filename}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button
          onClick={onDone}
          type="button"
          variant="outline"
          disabled={isPending}
        >
          Abbrechen
        </Button>
        <Button disabled={isPending} type="submit">
          {isPending
            ? 'Wird gespeichert …'
            : editing
              ? 'Speichern'
              : 'Hochladen'}
        </Button>
      </DialogFooter>
    </form>
  )
}
