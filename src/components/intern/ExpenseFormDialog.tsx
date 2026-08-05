import { Delete02Icon, ImageAdd02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { IsoDateField } from '~/components/admin/form-ui'
import { mergeReceiptFiles, ReceiptMergeError } from '~/lib/merge-receipts'
import { formatEuro, parseEuroToCents } from '~/lib/money'
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
  // Cost bearers for the "selected" settlement. Members whose account was
  // deleted have no id left, so they drop out of an edited selection.
  const [debtorIds, setDebtorIds] = useState<number[]>(
    () =>
      editing?.debtors
        .map((d) => d.user_id)
        .filter((id): id is number => id !== null) ?? [],
  )
  // Several files get merged into one PDF on submit (see mergeReceiptFiles).
  const [files, setFiles] = useState<File[]>([])
  const [isMerging, setIsMerging] = useState(false)

  const isPending = isCreating || isUpdating || isUploading || isMerging

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
    if (settlement === 'selected' && debtorIds.length === 0) {
      toast.error(
        'Bitte mindestens ein Mitglied auswählen, das die Kosten trägt.',
      )
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
      debtor_user_ids: settlement === 'selected' ? debtorIds : [],
    }

    // Merge before saving so a failed merge doesn't leave a bill behind.
    let receipt: File | null = null
    if (files.length > 0) {
      setIsMerging(true)
      try {
        receipt = await mergeReceiptFiles(files, expenseDate)
      } catch (err) {
        toast.error(
          err instanceof ReceiptMergeError
            ? err.message
            : 'Belege konnten nicht zusammengefügt werden.',
        )
        return
      } finally {
        setIsMerging(false)
      }
    }

    try {
      const saved = editing
        ? await updateExpense({ id: editing.id, data: payload })
        : await createExpense(payload)
      if (receipt) {
        await uploadReceipt({ id: saved.id, file: receipt })
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
          <Label>Datum</Label>
          <IsoDateField
            onChange={setExpenseDate}
            required
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
          Mitglieder (inkl. bezahlender Person). „Auf ausgewählte Mitglieder“
          teilt sie nur unter den gewählten Personen auf — sie zahlen ihren
          Anteil an die Person zurück, die ausgelegt hat.
        </p>
      </div>

      {settlement === 'selected' && (
        <DebtorPicker
          amountCents={parseEuroToCents(amount)}
          members={members}
          onChange={setDebtorIds}
          selected={debtorIds}
        />
      )}

      <div className="space-y-1.5">
        <Label htmlFor="exp-receipt">
          Beleg {editing?.has_receipt ? '(ersetzen, optional)' : '(optional)'}
        </Label>
        {/* The list below is the source of truth, so the input is cleared
            after every pick — that also keeps re-picking the same file
            firing `change`, and hides the browser's English file text. */}
        <input
          accept="image/*,application/pdf"
          className="sr-only"
          id="exp-receipt"
          multiple
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? [])
            if (picked.length > 0) setFiles((prev) => [...prev, ...picked])
            e.target.value = ''
          }}
          type="file"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => document.getElementById('exp-receipt')?.click()}
            size="sm"
            type="button"
            variant="outline"
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={ImageAdd02Icon}
              size={14}
              strokeWidth={1.6}
            />
            {files.length > 0 ? 'Weitere hinzufügen' : 'Fotos oder PDFs wählen'}
          </Button>
          <span className="text-xs text-forest-700/60">
            {files.length === 0
              ? 'Nichts ausgewählt'
              : files.length === 1
                ? '1 Datei'
                : `${files.length} Dateien → 1 PDF`}
          </span>
        </div>
        <p className="text-xs text-forest-700/60">
          Passt eine Rechnung nicht auf ein Foto: mehrere Fotos auswählen, sie
          werden in dieser Reihenfolge zu einem PDF zusammengefügt.
        </p>
        {files.length > 0 && (
          <ol className="space-y-1">
            {files.map((f, i) => (
              <li
                className="flex items-center gap-2 text-sm text-forest-900"
                key={`${f.name}-${f.size}-${f.lastModified}`}
              >
                <span className="text-forest-700/60">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <Button
                  aria-label={`${f.name} entfernen`}
                  onClick={() =>
                    setFiles((prev) => prev.filter((_, idx) => idx !== i))
                  }
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
              </li>
            ))}
          </ol>
        )}
        {editing?.has_receipt && (
          <p className="text-xs text-forest-700/60">
            Aktueller Beleg: {editing.receipt_filename}
          </p>
        )}
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
          {isMerging
            ? 'Belege werden zusammengefügt …'
            : isPending
              ? 'Wird gespeichert …'
              : editing
                ? 'Speichern'
                : 'Hochladen'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Picks the members that carry the cost of a bill. The per-head preview
 * uses the amount typed so far, so the split is visible before saving.
 */
function DebtorPicker({
  amountCents,
  members,
  onChange,
  selected,
}: {
  amountCents: number | null
  members: KassaMember[]
  onChange: (ids: number[]) => void
  selected: number[]
}) {
  const perHead =
    amountCents !== null && selected.length > 0
      ? Math.floor(amountCents / selected.length)
      : null

  function toggle(userId: number, checked: boolean) {
    onChange(
      checked ? [...selected, userId] : selected.filter((id) => id !== userId),
    )
  }

  return (
    <fieldset className="space-y-2 rounded-2xl border border-forest-900/12 bg-white/60 p-3">
      <legend className="px-1 text-sm font-medium text-forest-900">
        Wer zahlt zurück?
      </legend>
      {members.length === 0 ? (
        <p className="text-sm text-forest-700/60">Keine Mitglieder gefunden.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => onChange(members.map((m) => m.user_id))}
              size="sm"
              type="button"
              variant="outline"
            >
              Alle
            </Button>
            <Button
              onClick={() => onChange([])}
              size="sm"
              type="button"
              variant="ghost"
            >
              Keine
            </Button>
            <span className="text-xs text-forest-700/60">
              {selected.length === 0
                ? 'Niemand ausgewählt'
                : perHead !== null
                  ? `${selected.length} ausgewählt · je ${formatEuro(perHead)}`
                  : `${selected.length} ausgewählt`}
            </span>
          </div>
          <ul className="space-y-1">
            {members.map((m) => {
              const inputId = `exp-debtor-${m.user_id}`
              return (
                <li className="flex items-center gap-2" key={m.user_id}>
                  <input
                    checked={selected.includes(m.user_id)}
                    className="size-4 accent-forest-700"
                    id={inputId}
                    onChange={(e) => toggle(m.user_id, e.target.checked)}
                    type="checkbox"
                  />
                  <label className="text-sm text-forest-900" htmlFor={inputId}>
                    {m.name}
                  </label>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </fieldset>
  )
}
