import {
  Add01Icon,
  Delete02Icon,
  FileEditIcon,
  StarIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '~/lib/ui-utils'
import {
  useCreateDecision,
  useDeleteDecision,
  useUpdateDecision,
} from '~/services/event.service'
import { useAdminUsers } from '~/services/user.service'
import { Badge } from '~/ui/badge'
import { Button } from '~/ui/button'
import { Label } from '~/ui/label'
import { Separator } from '~/ui/separator'
import type {
  CreateEventDecisionInput,
  EventAgendaVote,
  EventDecision,
  EventWithDetails,
  UpdateEventDecisionInput,
} from '~func/contracts/event'
import { ConfirmDeleteBar, PersonPicker, SELECT, TEXTAREA } from './form-ui'

type Props = { event: EventWithDetails }

export default function DecisionsPanel({ event }: Props) {
  const { data: users } = useAdminUsers()
  const { mutate: createDecision, isPending: isCreating } = useCreateDecision(
    event.slug,
  )
  const { mutate: updateDecision, isPending: isUpdating } = useUpdateDecision(
    event.slug,
  )
  const { mutate: deleteDecision, isPending: isDeleting } = useDeleteDecision(
    event.slug,
  )

  const sorted = useMemo(
    () =>
      [...event.decisions].sort(
        (a, b) => a.sort_order - b.sort_order || a.id - b.id,
      ),
    [event.decisions],
  )

  // Flatten every vote across every agenda item so the picker shows them
  // all in one dropdown. We label each with the parent agenda item so
  // the admin knows what they're linking.
  const allVotes = useMemo(() => {
    const out: EventAgendaVote[] = []
    for (const item of event.agenda_items) {
      for (const vote of item.votes) {
        out.push(vote)
      }
    }
    return out
  }, [event.agenda_items])

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-forest-900">Beschlüsse</p>
          <Badge className="bg-forest-900/8 text-forest-700 ring-forest-900/15">
            {sorted.length === 0
              ? 'Noch keine'
              : `${sorted.length} ${sorted.length === 1 ? 'Beschluss' : 'Beschlüsse'}`}
          </Badge>
        </div>
        {sorted.length === 0 ? (
          <p className="text-sm text-forest-700/60">
            Noch keine Beschlüsse erfasst.
          </p>
        ) : (
          <ol className="space-y-3">
            {sorted.map((decision) => (
              <li key={decision.id}>
                <DecisionCard
                  agendaItems={event.agenda_items}
                  allVotes={allVotes}
                  decision={decision}
                  isDeleting={isDeleting}
                  isUpdating={isUpdating}
                  onDelete={() =>
                    deleteDecision(decision.id, {
                      onSuccess: () => toast.success('Beschluss gelöscht.'),
                      onError: () => toast.error('Löschen fehlgeschlagen.'),
                    })
                  }
                  onUpdate={(data) =>
                    updateDecision(
                      { id: decision.id, data },
                      {
                        onSuccess: () =>
                          toast.success('Beschluss aktualisiert.'),
                        onError: () => toast.error('Speichern fehlgeschlagen.'),
                      },
                    )
                  }
                  users={users ?? []}
                />
              </li>
            ))}
          </ol>
        )}
      </div>

      <Separator />

      <NewDecisionForm
        agendaItems={event.agenda_items}
        allVotes={allVotes}
        isPending={isCreating}
        onSubmit={(data) =>
          createDecision(data, {
            onSuccess: () => {
              toast.success('Beschluss angelegt.')
            },
            onError: () => toast.error('Anlegen fehlgeschlagen.'),
          })
        }
        users={users ?? []}
      />
    </div>
  )
}

function DecisionCard({
  decision,
  users,
  agendaItems,
  allVotes,
  isUpdating,
  isDeleting,
  onUpdate,
  onDelete,
}: {
  decision: EventDecision
  users: Array<{ id: number; first_name: string; last_name: string }>
  agendaItems: EventWithDetails['agenda_items']
  allVotes: EventAgendaVote[]
  isUpdating: boolean
  isDeleting: boolean
  onUpdate: (data: UpdateEventDecisionInput) => void
  onDelete: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isEditing) {
    return (
      <DecisionForm
        agendaItems={agendaItems}
        allVotes={allVotes}
        initial={{
          id: decision.id,
          wording: decision.wording,
          proposer_user_id: decision.proposer_user_id,
          proposer_name: decision.proposer_name,
          seconder_user_id: decision.seconder_user_id,
          seconder_name: decision.seconder_name,
          agenda_item_id: decision.agenda_item_id,
          vote_id: decision.vote_id,
          result_note: decision.result_note,
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

  const linkedVote = decision.vote_snapshot
  const linkedAgendaTitle = decision.agenda_item_id
    ? agendaItems.find((a) => a.id === decision.agenda_item_id)?.title
    : null

  return (
    <div className="rounded-[1.25rem] bg-white/75 p-4 ring-1 ring-inset ring-white/40 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-900/8 px-2.5 py-1 text-xs font-semibold text-forest-700 ring-1 ring-forest-900/15">
            <HugeiconsIcon
              aria-hidden="true"
              icon={StarIcon}
              size={12}
              strokeWidth={2}
            />
            {decision.resolution_number}
          </span>
          {linkedAgendaTitle && (
            <Badge className="bg-forest-900/5 text-forest-700/80 ring-forest-900/10">
              {linkedAgendaTitle}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            aria-label="Beschluss bearbeiten"
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
          <Button
            aria-label="Beschluss löschen"
            className="text-xs text-beet-700 hover:bg-beet-700/10 hover:text-beet-700"
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
      <p className="mt-3 whitespace-pre-line text-sm text-forest-900">
        {decision.wording}
      </p>
      <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs text-forest-700/80 sm:grid-cols-2">
        <PersonRow
          label="Antragsteller:in"
          name={decision.proposer_display ?? decision.proposer_name}
        />
        <PersonRow
          label="Zweite Person"
          name={decision.seconder_display ?? decision.seconder_name}
        />
      </dl>
      {linkedVote && (
        <p className="mt-3 rounded-xl bg-leaf-500/10 p-2.5 text-xs text-forest-700/80 ring-1 ring-inset ring-leaf-500/30">
          <span className="font-semibold">Verknüpfte Abstimmung: </span>
          {linkedVote.question}
        </p>
      )}
      {decision.result_note && (
        <p className="mt-2 text-xs whitespace-pre-line text-forest-700/70">
          {decision.result_note}
        </p>
      )}

      {confirmDelete && (
        <ConfirmDeleteBar
          isPending={isDeleting}
          message="Beschluss wirklich löschen? Die Nummer wird nicht wiederverwendet."
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

function PersonRow({
  label,
  name,
}: {
  label: string
  name: string | null | undefined
}) {
  return (
    <div>
      <dt className="inline font-semibold text-forest-700">{label}:</dt>{' '}
      <dd className="inline">{name ?? '–'}</dd>
    </div>
  )
}

type FormInitial = {
  id: number
  wording: string
  proposer_user_id: number | null
  proposer_name: string | null
  seconder_user_id: number | null
  seconder_name: string | null
  agenda_item_id: number | null
  vote_id: number | null
  result_note: string | null
}

type DecisionFormProps = {
  initial?: FormInitial
  users: Array<{ id: number; first_name: string; last_name: string }>
  agendaItems: EventWithDetails['agenda_items']
  allVotes: EventAgendaVote[]
  isPending: boolean
  onCancel?: () => void
  onSubmit: (data: CreateEventDecisionInput | UpdateEventDecisionInput) => void
  submitLabel?: string
}

function DecisionForm({
  initial,
  users,
  agendaItems,
  allVotes,
  isPending,
  onCancel,
  onSubmit,
  submitLabel = 'Beschluss anlegen',
}: DecisionFormProps) {
  const [wording, setWording] = useState(initial?.wording ?? '')
  const [proposerUserId, setProposerUserId] = useState<number | ''>(
    initial?.proposer_user_id ?? '',
  )
  const [proposerName, setProposerName] = useState(initial?.proposer_name ?? '')
  const [seconderUserId, setSeconderUserId] = useState<number | ''>(
    initial?.seconder_user_id ?? '',
  )
  const [seconderName, setSeconderName] = useState(initial?.seconder_name ?? '')
  const [agendaItemId, setAgendaItemId] = useState<number | ''>(
    initial?.agenda_item_id ?? '',
  )
  const [voteId, setVoteId] = useState<number | ''>(initial?.vote_id ?? '')
  const [resultNote, setResultNote] = useState(initial?.result_note ?? '')

  const userOptions = users
    .slice()
    .sort((a, b) => a.last_name.localeCompare(b.last_name))
  const idPrefix = initial ? String(initial.id) : 'new'

  // When the user picks a known user, clear the free-text fallback to
  // avoid a confusing two-name display. When they clear the FK, we
  // keep the text so they can switch modes without losing input.
  function handleProposerUserChange(value: number | '') {
    setProposerUserId(value)
    if (value !== '') setProposerName('')
  }

  function handleSeconderUserChange(value: number | '') {
    setSeconderUserId(value)
    if (value !== '') setSeconderName('')
  }

  function handleSubmit() {
    if (!wording.trim()) {
      toast.error('Bitte einen Beschlusstext eingeben.')
      return
    }
    const hasProposer = proposerUserId !== '' || proposerName.trim() !== ''
    const hasSeconder = seconderUserId !== '' || seconderName.trim() !== ''
    if (!hasProposer) {
      toast.error('Bitte Antragsteller:in angeben.')
      return
    }
    if (!hasSeconder) {
      toast.error('Bitte zweite Person angeben.')
      return
    }
    onSubmit({
      wording: wording.trim(),
      proposer_user_id: proposerUserId === '' ? null : proposerUserId,
      proposer_name: proposerName.trim() ? proposerName.trim() : null,
      seconder_user_id: seconderUserId === '' ? null : seconderUserId,
      seconder_name: seconderName.trim() ? seconderName.trim() : null,
      agenda_item_id: agendaItemId === '' ? null : agendaItemId,
      vote_id: voteId === '' ? null : voteId,
      result_note: resultNote.trim() ? resultNote.trim() : null,
    })
  }

  return (
    <div className="rounded-[1.25rem] bg-forest-900/4 p-4 ring-1 ring-inset ring-forest-900/8 sm:p-5">
      <div className="space-y-1.5">
        <Label htmlFor={`wording-${idPrefix}`}>Beschlusstext</Label>
        <textarea
          className={TEXTAREA}
          id={`wording-${idPrefix}`}
          maxLength={2000}
          onChange={(e) => setWording(e.target.value)}
          placeholder={
            'z. B. „Die Generalversammlung beschließt die Anschaffung eines neuen Komposters zum Preis von maximal 350 €.“'
          }
          value={wording}
        />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <PersonPicker
          freeTextValue={proposerName}
          idPrefix={`proposer-${idPrefix}`}
          label="Antragsteller:in"
          onFreeTextChange={setProposerName}
          onUserChange={handleProposerUserChange}
          userValue={proposerUserId}
          users={userOptions}
        />
        <PersonPicker
          freeTextValue={seconderName}
          idPrefix={`seconder-${idPrefix}`}
          label="Zweite Person"
          onFreeTextChange={setSeconderName}
          onUserChange={handleSeconderUserChange}
          userValue={seconderUserId}
          users={userOptions}
        />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`agenda-item-${idPrefix}`}>
            Agendapunkt (optional)
          </Label>
          <select
            className={SELECT}
            id={`agenda-item-${idPrefix}`}
            onChange={(e) =>
              setAgendaItemId(
                e.target.value === '' ? '' : Number(e.target.value),
              )
            }
            value={agendaItemId}
          >
            <option value="">— keiner —</option>
            {agendaItems.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`vote-${idPrefix}`}>
            Verknüpfte Abstimmung (optional)
          </Label>
          <select
            className={SELECT}
            id={`vote-${idPrefix}`}
            onChange={(e) =>
              setVoteId(e.target.value === '' ? '' : Number(e.target.value))
            }
            value={voteId}
          >
            <option value="">— keine —</option>
            {allVotes.map((v) => {
              const parentTitle = agendaItems.find(
                (a) => a.id === v.agenda_item_id,
              )?.title
              return (
                <option key={v.id} value={v.id}>
                  {parentTitle ? `${parentTitle} · ` : ''}
                  {v.question}
                </option>
              )
            })}
          </select>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Label htmlFor={`result-note-${idPrefix}`}>
          Ergebnisnotiz (optional)
        </Label>
        <textarea
          className={cn(TEXTAREA, 'min-h-20')}
          id={`result-note-${idPrefix}`}
          maxLength={50000}
          onChange={(e) => setResultNote(e.target.value)}
          placeholder={'z. B. „einstimmig angenommen, 1 Enthaltung.“'}
          value={resultNote}
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

function NewDecisionForm(props: {
  users: Array<{ id: number; first_name: string; last_name: string }>
  agendaItems: EventWithDetails['agenda_items']
  allVotes: EventAgendaVote[]
  isPending: boolean
  onSubmit: (data: CreateEventDecisionInput) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  if (!isOpen) {
    return (
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-forest-700/70">
          Die Beschlussnummer wird automatisch vergeben (B-Jahr-NNN, z. B.
          B-2026-001).
        </p>
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
          Neuer Beschluss
        </Button>
      </div>
    )
  }
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-forest-900">
        Neuen Beschluss anlegen
      </p>
      <DecisionForm
        {...props}
        onCancel={() => setIsOpen(false)}
        onSubmit={(data) => {
          props.onSubmit(data as CreateEventDecisionInput)
          setIsOpen(false)
        }}
      />
    </div>
  )
}
