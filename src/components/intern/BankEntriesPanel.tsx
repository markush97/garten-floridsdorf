import { useState } from 'react'
import { toast } from 'sonner'
import { IsoDateField } from '~/components/admin/form-ui'
import { formatEuro, parseEuroToCents } from '~/lib/money'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import { cn } from '~/lib/ui-utils'
import {
  useBankEntries,
  useCreateBankEntry,
  useDeleteBankEntry,
  useKassaMembers,
  useUpdateBankEntry,
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
  BANK_ENTRY_KIND_LABELS,
  BANK_ENTRY_KINDS,
  type BankEntryKind,
  type BankEntrySummary,
  type KassaMember,
} from '~func/contracts/bookkeeping'
import { FIELD, SELECT } from './kassa-ui'

export default function BankEntriesPanel() {
  const { data: entries, isPending, isError } = useBankEntries(true)
  const { data: members = [] } = useKassaMembers()
  const { mutate: remove, isPending: isDeleting } = useDeleteBankEntry()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BankEntrySummary | null>(null)

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }
  function handleDelete(id: number) {
    if (!window.confirm('Diese Buchung wirklich löschen?')) return
    remove(id, {
      onSuccess: () => toast.success('Buchung gelöscht.'),
      onError: () => toast.error('Löschen fehlgeschlagen.'),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-forest-700/70">
          Anfangsbestand, Einnahmen (z. B. Mitgliedsbeiträge) und Rückzahlungen
          an Mitglieder. Wirkt sich direkt auf den Kontostand aus.
        </p>
        <Button onClick={openCreate}>Buchung erfassen</Button>
      </div>

      {isPending ? (
        <p className="py-8 text-center text-sm text-forest-700/60">
          Wird geladen …
        </p>
      ) : isError || !entries ? (
        <p className="py-8 text-center text-sm text-beet-700">
          Buchungen konnten nicht geladen werden.
        </p>
      ) : entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-forest-700/60">
          Noch keine Buchungen. Erfasse zuerst den Anfangsbestand.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-white/70 p-3 ring-1 ring-inset ring-white/40 sm:p-4"
              key={entry.id}
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-forest-900">
                  {BANK_ENTRY_KIND_LABELS[entry.kind]}
                  {entry.member_name && ` · ${entry.member_name}`}
                </p>
                <p className="text-xs text-forest-700/60">
                  {dayjs(entry.entry_date)
                    .tz(DEFAULT_TIMEZONE)
                    .format('DD.MM.YYYY')}
                  {entry.description && ` · ${entry.description}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'font-medium tabular-nums',
                    entry.kind === 'reimbursement'
                      ? 'text-beet-700'
                      : 'text-forest-900',
                  )}
                >
                  {entry.kind === 'reimbursement' ? '−' : '+'}
                  {formatEuro(entry.amount_cents)}
                </span>
                <Button
                  onClick={() => {
                    setEditing(entry)
                    setDialogOpen(true)
                  }}
                  size="sm"
                  variant="outline"
                >
                  Bearbeiten
                </Button>
                <Button
                  className="text-beet-700"
                  disabled={isDeleting}
                  onClick={() => handleDelete(entry.id)}
                  size="sm"
                  variant="ghost"
                >
                  Löschen
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <BankEntryDialog
        editing={editing}
        members={members}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />
    </div>
  )
}

function BankEntryDialog({
  open,
  onOpenChange,
  members,
  editing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: KassaMember[]
  editing: BankEntrySummary | null
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <BankEntryForm
          editing={editing}
          key={editing?.id ?? 'new'}
          members={members}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function BankEntryForm({
  editing,
  members,
  onDone,
}: {
  editing: BankEntrySummary | null
  members: KassaMember[]
  onDone: () => void
}) {
  const { mutateAsync: create, isPending: isCreating } = useCreateBankEntry()
  const { mutateAsync: update, isPending: isUpdating } = useUpdateBankEntry()

  const [kind, setKind] = useState<BankEntryKind>(editing?.kind ?? 'income')
  const [amount, setAmount] = useState(
    editing ? (editing.amount_cents / 100).toFixed(2).replace('.', ',') : '',
  )
  const [entryDate, setEntryDate] = useState(
    editing?.entry_date ?? dayjs().tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD'),
  )
  const [description, setDescription] = useState(editing?.description ?? '')
  const [memberUserId, setMemberUserId] = useState(
    editing?.member_user_id != null ? String(editing.member_user_id) : '',
  )
  const isPending = isCreating || isUpdating
  const showMember = kind !== 'opening'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountCents = parseEuroToCents(amount)
    if (amountCents === null || amountCents < 1) {
      toast.error('Bitte einen gültigen Betrag angeben.')
      return
    }
    if (kind === 'reimbursement' && !memberUserId) {
      toast.error('Bitte das Mitglied angeben, an das ausgezahlt wurde.')
      return
    }
    const payload = {
      kind,
      amount_cents: amountCents,
      entry_date: entryDate,
      description: description.trim() || null,
      member_user_id: showMember && memberUserId ? Number(memberUserId) : null,
    }
    try {
      if (editing) {
        await update({ id: editing.id, data: payload })
      } else {
        await create(payload)
      }
      toast.success(editing ? 'Buchung aktualisiert.' : 'Buchung erfasst.')
      onDone()
    } catch {
      toast.error('Speichern fehlgeschlagen.')
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>
          {editing ? 'Buchung bearbeiten' : 'Buchung erfassen'}
        </DialogTitle>
        <DialogDescription>
          Anfangsbestand und Einnahmen erhöhen den Kontostand, Rückzahlungen
          verringern ihn.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="be-kind">Art</Label>
        <select
          className={SELECT}
          id="be-kind"
          onChange={(e) => setKind(e.target.value as BankEntryKind)}
          value={kind}
        >
          {BANK_ENTRY_KINDS.map((k) => (
            <option key={k} value={k}>
              {BANK_ENTRY_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="be-amount">Betrag (€)</Label>
          <Input
            className={FIELD}
            id="be-amount"
            inputMode="decimal"
            onChange={(e) => setAmount(e.target.value)}
            placeholder="z. B. 120,00"
            required
            value={amount}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Datum</Label>
          <IsoDateField onChange={setEntryDate} required value={entryDate} />
        </div>
      </div>

      {showMember && (
        <div className="space-y-1.5">
          <Label htmlFor="be-member">
            Mitglied {kind === 'reimbursement' ? '(Empfänger)' : '(optional)'}
          </Label>
          <select
            className={SELECT}
            id="be-member"
            onChange={(e) => setMemberUserId(e.target.value)}
            value={memberUserId}
          >
            <option value="">
              {kind === 'reimbursement' ? 'Bitte wählen …' : 'Kein Mitglied'}
            </option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </select>
          {kind === 'income' && (
            <p className="text-xs text-forest-700/60">
              Nur wählen, wenn ein Mitglied seinen Kostenanteil einzahlt.
            </p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="be-desc">Notiz (optional)</Label>
        <Input
          className={FIELD}
          id="be-desc"
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="z. B. Mitgliedsbeiträge Q2"
          value={description}
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
