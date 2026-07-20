import { useState } from 'react'
import { toast } from 'sonner'
import { formatEuro } from '~/lib/money'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import {
  useApproveExpense,
  useDeleteExpense,
  useExpenses,
  useKassaMembers,
  useRejectExpense,
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
import { Label } from '~/ui/label'
import type { SessionUser } from '~func/contracts/auth'
import {
  EXPENSE_CADENCE_LABELS,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_TYPE_LABELS,
  type ExpenseSummary,
  PAID_FROM_LABELS,
  SETTLEMENT_LABELS,
} from '~func/contracts/bookkeeping'
import ExpenseFormDialog from './ExpenseFormDialog'
import { StatusBadge, TEXTAREA } from './kassa-ui'

export default function ExpenseSection({ me }: { me: SessionUser }) {
  const { data: expenses, isPending, isError } = useExpenses()
  const { data: members = [] } = useKassaMembers()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ExpenseSummary | null>(null)
  const [rejecting, setRejecting] = useState<ExpenseSummary | null>(null)

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openEdit(expense: ExpenseSummary) {
    setEditing(expense)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-forest-700/70">
          Alle hochgeladenen Rechnungen. Jede:r kann Rechnungen hochladen; ein
          Kassier gibt sie frei.
        </p>
        <Button onClick={openCreate}>Rechnung hochladen</Button>
      </div>

      {isPending ? (
        <p className="py-8 text-center text-sm text-forest-700/60">
          Wird geladen …
        </p>
      ) : isError || !expenses ? (
        <p className="py-8 text-center text-sm text-beet-700">
          Rechnungen konnten nicht geladen werden.
        </p>
      ) : expenses.length === 0 ? (
        <p className="py-8 text-center text-sm text-forest-700/60">
          Noch keine Rechnungen. Lade die erste hoch.
        </p>
      ) : (
        <ul className="space-y-3">
          {expenses.map((expense) => (
            <ExpenseCard
              expense={expense}
              key={expense.id}
              me={me}
              onEdit={() => openEdit(expense)}
              onReject={() => setRejecting(expense)}
            />
          ))}
        </ul>
      )}

      <ExpenseFormDialog
        editing={editing}
        members={members}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />
      <RejectDialog expense={rejecting} onClose={() => setRejecting(null)} />
    </div>
  )
}

function canManage(me: SessionUser, expense: ExpenseSummary): boolean {
  if (me.is_kassier) return true
  return (
    expense.status === 'pending' &&
    expense.submitted_by_user_id !== null &&
    expense.submitted_by_user_id === me.user_id
  )
}

function ExpenseCard({
  expense,
  me,
  onEdit,
  onReject,
}: {
  expense: ExpenseSummary
  me: SessionUser
  onEdit: () => void
  onReject: () => void
}) {
  const { mutate: approve, isPending: isApproving } = useApproveExpense()
  const { mutate: remove, isPending: isDeleting } = useDeleteExpense()

  const canReview = me.is_kassier && expense.status === 'pending'
  const manageable = canManage(me, expense)

  const meta = [
    dayjs(expense.expense_date).tz(DEFAULT_TIMEZONE).format('DD.MM.YYYY'),
    EXPENSE_CATEGORY_LABELS[expense.category],
    EXPENSE_TYPE_LABELS[expense.type],
    EXPENSE_CADENCE_LABELS[expense.cadence],
  ]

  function handleDelete() {
    if (!window.confirm('Diese Rechnung wirklich löschen?')) return
    remove(expense.id, {
      onSuccess: () => toast.success('Rechnung gelöscht.'),
      onError: () => toast.error('Löschen fehlgeschlagen.'),
    })
  }

  function handleApprove() {
    approve(expense.id, {
      onSuccess: () => toast.success('Rechnung freigegeben.'),
      onError: () => toast.error('Freigabe fehlgeschlagen.'),
    })
  }

  return (
    <li className="rounded-[1.25rem] bg-white/75 p-4 shadow-[0_4px_16px_rgba(31,61,43,0.06)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-forest-900">{expense.description}</p>
            <StatusBadge status={expense.status} />
          </div>
          <p className="text-xs text-forest-700/60">{meta.join(' · ')}</p>
          {expense.type === 'project' && expense.project_name && (
            <p className="text-xs text-forest-700/60">
              Projekt: {expense.project_name}
            </p>
          )}
          <p className="text-xs text-forest-700/70">
            {PAID_FROM_LABELS[expense.paid_from]}
            {expense.paid_by_name && ` (${expense.paid_by_name})`} ·{' '}
            {SETTLEMENT_LABELS[expense.settlement]}
          </p>
          <p className="text-xs text-forest-700/50">
            Eingereicht von {expense.submitted_by_name}
            {expense.status === 'rejected' &&
              expense.review_note &&
              ` · Abgelehnt: ${expense.review_note}`}
          </p>
        </div>
        <p className="font-heading text-lg tabular-nums text-forest-900">
          {formatEuro(expense.amount_cents)}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {expense.has_receipt && (
          <Button asChild size="sm" variant="outline">
            <a
              href={`/api/kassa/expenses/${expense.id}/receipt`}
              rel="noreferrer"
              target="_blank"
            >
              Beleg
            </a>
          </Button>
        )}
        {canReview && (
          <>
            <Button disabled={isApproving} onClick={handleApprove} size="sm">
              Freigeben
            </Button>
            <Button onClick={onReject} size="sm" variant="outline">
              Ablehnen
            </Button>
          </>
        )}
        {manageable && (
          <>
            <Button onClick={onEdit} size="sm" variant="outline">
              Bearbeiten
            </Button>
            <Button
              className="text-beet-700"
              disabled={isDeleting}
              onClick={handleDelete}
              size="sm"
              variant="ghost"
            >
              Löschen
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

function RejectDialog({
  expense,
  onClose,
}: {
  expense: ExpenseSummary | null
  onClose: () => void
}) {
  const { mutate: reject, isPending } = useRejectExpense()
  const [note, setNote] = useState('')

  function handleReject() {
    if (!expense) return
    reject(
      { id: expense.id, note: note.trim() || null },
      {
        onSuccess: () => {
          toast.success('Rechnung abgelehnt.')
          setNote('')
          onClose()
        },
        onError: () => toast.error('Ablehnen fehlgeschlagen.'),
      },
    )
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={expense !== null}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rechnung ablehnen</DialogTitle>
          <DialogDescription>
            {expense?.description} · Optional ein Grund für die Ablehnung.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reject-note">Grund (optional)</Label>
          <textarea
            className={TEXTAREA}
            id="reject-note"
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="z. B. Beleg fehlt"
            value={note}
          />
        </div>
        <DialogFooter>
          <Button disabled={isPending} onClick={onClose} variant="outline">
            Abbrechen
          </Button>
          <Button
            className="bg-beet-700 hover:bg-beet-700/90"
            disabled={isPending}
            onClick={handleReject}
          >
            Ablehnen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
