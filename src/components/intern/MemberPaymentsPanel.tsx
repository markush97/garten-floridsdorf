import { useState } from 'react'
import { toast } from 'sonner'
import { IsoDateField } from '~/components/admin/form-ui'
import { formatEuro, parseEuroToCents } from '~/lib/money'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import {
  useCreateMemberPayment,
  useDeleteMemberPayment,
  useKassaMembers,
  useMemberPayments,
  useUpdateMemberPayment,
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
import type { SessionUser } from '~func/contracts/auth'
import type {
  KassaMember,
  MemberPaymentSummary,
} from '~func/contracts/bookkeeping'
import { FIELD, SELECT } from './kassa-ui'

/** Prefilled parties and amount when a payback is started from a debt row. */
export type MemberPaymentPrefill = {
  from_user_id: number
  to_user_id: number
  amount_cents: number
}

/** Only the recorder (or a Kassier) may change a payback afterwards. */
function canManage(me: SessionUser, payment: MemberPaymentSummary): boolean {
  if (me.is_kassier) return true
  return (
    payment.recorded_by_user_id !== null &&
    payment.recorded_by_user_id === me.user_id
  )
}

export default function MemberPaymentsPanel({ me }: { me: SessionUser }) {
  const { data: payments, isPending, isError } = useMemberPayments()
  const { data: members = [] } = useKassaMembers()
  const { mutate: remove, isPending: isDeleting } = useDeleteMemberPayment()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MemberPaymentSummary | null>(null)

  function handleDelete(id: number) {
    if (!window.confirm('Diese Rückzahlung wirklich löschen?')) return
    remove(id, {
      onSuccess: () => toast.success('Rückzahlung gelöscht.'),
      onError: () => toast.error('Löschen fehlgeschlagen.'),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-forest-700/70">
          Zahlungen zwischen Mitgliedern: wer hat wem einen Anteil an einer
          ausgelegten Rechnung zurückgezahlt? Das Vereinskonto bleibt davon
          unberührt.
        </p>
        <Button
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          Rückzahlung erfassen
        </Button>
      </div>

      {isPending ? (
        <p className="py-8 text-center text-sm text-forest-700/60">
          Wird geladen …
        </p>
      ) : isError || !payments ? (
        <p className="py-8 text-center text-sm text-beet-700">
          Rückzahlungen konnten nicht geladen werden.
        </p>
      ) : payments.length === 0 ? (
        <p className="py-8 text-center text-sm text-forest-700/60">
          Noch keine Rückzahlungen erfasst.
        </p>
      ) : (
        <ul className="space-y-2">
          {payments.map((payment) => (
            <li
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-white/70 p-3 ring-1 ring-inset ring-white/40 sm:p-4"
              key={payment.id}
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-forest-900">
                  {payment.from_name} <span aria-hidden="true">→</span>{' '}
                  {payment.to_name}
                </p>
                <p className="text-xs text-forest-700/60">
                  {dayjs(payment.payment_date)
                    .tz(DEFAULT_TIMEZONE)
                    .format('DD.MM.YYYY')}
                  {payment.description && ` · ${payment.description}`}
                  {` · erfasst von ${payment.recorded_by_name}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium tabular-nums text-forest-900">
                  {formatEuro(payment.amount_cents)}
                </span>
                {canManage(me, payment) && (
                  <>
                    <Button
                      onClick={() => {
                        setEditing(payment)
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
                      onClick={() => handleDelete(payment.id)}
                      size="sm"
                      variant="ghost"
                    >
                      Löschen
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <MemberPaymentDialog
        editing={editing}
        members={members}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />
    </div>
  )
}

export function MemberPaymentDialog({
  open,
  onOpenChange,
  members,
  editing,
  prefill,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: KassaMember[]
  editing: MemberPaymentSummary | null
  prefill?: MemberPaymentPrefill | null
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        {/* Remount on target change so the form resets cleanly. */}
        <MemberPaymentForm
          editing={editing}
          key={
            editing
              ? `edit-${editing.id}`
              : prefill
                ? `new-${prefill.from_user_id}-${prefill.to_user_id}-${prefill.amount_cents}`
                : 'new'
          }
          members={members}
          onDone={() => onOpenChange(false)}
          prefill={prefill ?? null}
        />
      </DialogContent>
    </Dialog>
  )
}

function euroInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function MemberPaymentForm({
  editing,
  members,
  onDone,
  prefill,
}: {
  editing: MemberPaymentSummary | null
  members: KassaMember[]
  onDone: () => void
  prefill: MemberPaymentPrefill | null
}) {
  const { mutateAsync: create, isPending: isCreating } =
    useCreateMemberPayment()
  const { mutateAsync: update, isPending: isUpdating } =
    useUpdateMemberPayment()

  const initial = editing
    ? {
        from: editing.from_user_id,
        to: editing.to_user_id,
        amount: euroInput(editing.amount_cents),
      }
    : {
        from: prefill?.from_user_id ?? null,
        to: prefill?.to_user_id ?? null,
        amount: prefill ? euroInput(prefill.amount_cents) : '',
      }

  const [fromUserId, setFromUserId] = useState(
    initial.from != null ? String(initial.from) : '',
  )
  const [toUserId, setToUserId] = useState(
    initial.to != null ? String(initial.to) : '',
  )
  const [amount, setAmount] = useState(initial.amount)
  const [paymentDate, setPaymentDate] = useState(
    editing?.payment_date ?? dayjs().tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD'),
  )
  const [description, setDescription] = useState(editing?.description ?? '')
  const isPending = isCreating || isUpdating

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountCents = parseEuroToCents(amount)
    if (!fromUserId || !toUserId) {
      toast.error('Bitte angeben, wer an wen zurückgezahlt hat.')
      return
    }
    if (fromUserId === toUserId) {
      toast.error('Ein Mitglied kann nicht an sich selbst zurückzahlen.')
      return
    }
    if (amountCents === null || amountCents < 1) {
      toast.error('Bitte einen gültigen Betrag angeben.')
      return
    }
    const payload = {
      from_user_id: Number(fromUserId),
      to_user_id: Number(toUserId),
      amount_cents: amountCents,
      payment_date: paymentDate,
      description: description.trim() || null,
    }
    try {
      if (editing) {
        await update({ id: editing.id, data: payload })
      } else {
        await create(payload)
      }
      toast.success(
        editing ? 'Rückzahlung aktualisiert.' : 'Rückzahlung erfasst.',
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
          {editing ? 'Rückzahlung bearbeiten' : 'Rückzahlung erfassen'}
        </DialogTitle>
        <DialogDescription>
          Trag ein, wer wem wie viel zurückgezahlt hat. Die offenen Beträge in
          der Übersicht werden damit verrechnet.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="mp-from">Wer hat gezahlt?</Label>
          <select
            className={SELECT}
            id="mp-from"
            onChange={(e) => setFromUserId(e.target.value)}
            value={fromUserId}
          >
            <option value="">Bitte wählen …</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mp-to">An wen?</Label>
          <select
            className={SELECT}
            id="mp-to"
            onChange={(e) => setToUserId(e.target.value)}
            value={toUserId}
          >
            <option value="">Bitte wählen …</option>
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
          <Label htmlFor="mp-amount">Betrag (€)</Label>
          <Input
            className={FIELD}
            id="mp-amount"
            inputMode="decimal"
            onChange={(e) => setAmount(e.target.value)}
            placeholder="z. B. 25,00"
            required
            value={amount}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Datum</Label>
          <IsoDateField
            onChange={setPaymentDate}
            required
            value={paymentDate}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mp-desc">Notiz (optional)</Label>
        <Input
          className={FIELD}
          id="mp-desc"
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="z. B. Anteil Zaunprojekt"
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
