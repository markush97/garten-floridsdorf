import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  CancelSquareIcon,
  Delete02Icon,
  FileEditIcon,
  Note01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { AGENDA_STATUS_LABELS } from '~/lib/event-helpers'
import { cn } from '~/lib/ui-utils'
import {
  useAddAgendaItem,
  useAddAgendaVote,
  useDeleteAgendaItem,
  useReorderAgendaItems,
  useUpdateAgendaItem,
} from '~/services/event.service'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { Label } from '~/ui/label'
import type {
  AgendaCountingMode,
  AgendaStatus,
  AgendaVoteType,
  CreateEventAgendaItemInput,
  CreateEventAgendaVoteInput,
  EventWithDetails,
} from '~func/contracts/event'
import AgendaVoteCard from './AgendaVoteCard'

const FIELD =
  'w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-2.5 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

const TEXTAREA =
  'min-h-20 w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-3 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

const STATUSES: readonly AgendaStatus[] = ['open', 'discussed', 'skipped']

type Props = { event: EventWithDetails }

export default function AgendaPanel({ event }: Props) {
  const { mutate: addItem } = useAddAgendaItem(event.slug)
  const { mutate: updateItem } = useUpdateAgendaItem(event.slug)
  const { mutate: deleteItem } = useDeleteAgendaItem(event.slug)
  const { mutate: reorderItems } = useReorderAgendaItems(event.slug)
  const { mutate: addVote } = useAddAgendaVote(event.slug)

  const [newTitle, setNewTitle] = useState('')
  const [newNotes, setNewNotes] = useState('')

  function handleAddItem() {
    if (!newTitle.trim()) {
      toast.error('Bitte einen Titel eingeben.')
      return
    }
    const payload: CreateEventAgendaItemInput = {
      title: newTitle.trim(),
      notes: newNotes.trim() || undefined,
    }
    addItem(payload, {
      onSuccess: () => {
        toast.success('Agendapunkt hinzugefügt.')
        setNewTitle('')
        setNewNotes('')
      },
      onError: () => toast.error('Hinzufügen fehlgeschlagen.'),
    })
  }

  function moveItem(idx: number, direction: -1 | 1) {
    const order = [...event.agenda_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => i.id)
    const target = idx + direction
    if (target < 0 || target >= order.length) return
    const tmp = order[idx]
    if (tmp === undefined || order[target] === undefined) return
    order[idx] = order[target] as number
    order[target] = tmp
    reorderItems(order, {
      onError: () =>
        toast.error('Reihenfolge konnte nicht gespeichert werden.'),
    })
  }

  const sortedItems = [...event.agenda_items].sort(
    (a, b) => a.sort_order - b.sort_order,
  )

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm font-semibold text-forest-900">Tagesordnung</p>
        {sortedItems.length === 0 ? (
          <p className="text-sm text-forest-700/60">Noch keine Agendapunkte.</p>
        ) : (
          <ol className="space-y-3">
            {sortedItems.map((item, idx) => (
              <li key={item.id}>
                <AgendaItemCard
                  attendees={event.actual_attendees}
                  eventSlug={event.slug}
                  index={idx}
                  isFirst={idx === 0}
                  isLast={idx === sortedItems.length - 1}
                  item={item}
                  onAddVote={(payload) =>
                    addVote(
                      { agendaItemId: item.id, data: payload },
                      {
                        onSuccess: () => toast.success('Abstimmung angelegt.'),
                        onError: () =>
                          toast.error(
                            'Abstimmung konnte nicht angelegt werden.',
                          ),
                      },
                    )
                  }
                  onDelete={() =>
                    deleteItem(item.id, {
                      onSuccess: () => toast.success('Agendapunkt gelöscht.'),
                      onError: () => toast.error('Löschen fehlgeschlagen.'),
                    })
                  }
                  onMoveDown={() => moveItem(idx, 1)}
                  onMoveUp={() => moveItem(idx, -1)}
                  onUpdate={(patch) =>
                    updateItem(
                      { id: item.id, data: patch },
                      {
                        onError: () => toast.error('Speichern fehlgeschlagen.'),
                      },
                    )
                  }
                />
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="space-y-2 rounded-[1rem] bg-forest-900/4 p-3 ring-1 ring-inset ring-forest-900/8">
        <p className="text-sm font-semibold text-forest-900">
          Neuen Agendapunkt anlegen
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="new-agenda-title">Titel</Label>
          <Input
            className={FIELD}
            id="new-agenda-title"
            maxLength={200}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="z. B. Wasserverteiler reparieren"
            value={newTitle}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-agenda-notes">Notizen (optional)</Label>
          <textarea
            className={TEXTAREA}
            id="new-agenda-notes"
            maxLength={50000}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Hintergrundinfos, Beschlüsse, Links …"
            value={newNotes}
          />
        </div>
        <div className="flex justify-end">
          <Button
            className="text-sm"
            onClick={handleAddItem}
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
            Agendapunkt anlegen
          </Button>
        </div>
      </div>
    </div>
  )
}

type ItemProps = {
  eventSlug: string
  item: EventWithDetails['agenda_items'][number]
  index: number
  isFirst: boolean
  isLast: boolean
  attendees: EventWithDetails['actual_attendees']
  onUpdate: (patch: {
    title?: string
    notes?: string | null
    status?: AgendaStatus
  }) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onAddVote: (payload: CreateEventAgendaVoteInput) => void
}

function AgendaItemCard({
  eventSlug,
  item,
  index,
  isFirst,
  isLast,
  attendees,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddVote,
}: ItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(item.title)
  const [notesDraft, setNotesDraft] = useState(item.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleSaveEdits() {
    if (!titleDraft.trim()) {
      toast.error('Bitte einen Titel eingeben.')
      return
    }
    onUpdate({
      title: titleDraft.trim(),
      notes: notesDraft.trim() ? notesDraft.trim() : null,
    })
    setIsEditing(false)
  }

  return (
    <div className="rounded-[1.25rem] bg-white/75 p-4 ring-1 ring-inset ring-white/40 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-1 items-start gap-3">
          <div className="flex flex-col items-center gap-0.5">
            <Button
              aria-label="Agendapunkt nach oben verschieben"
              className="h-7 w-7 text-forest-700"
              disabled={isFirst}
              onClick={onMoveUp}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <HugeiconsIcon
                aria-hidden="true"
                icon={ArrowUp01Icon}
                size={14}
                strokeWidth={1.6}
              />
            </Button>
            <span className="text-xs font-semibold text-forest-700/70">
              {index + 1}
            </span>
            <Button
              aria-label="Agendapunkt nach unten verschieben"
              className="h-7 w-7 text-forest-700"
              disabled={isLast}
              onClick={onMoveDown}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <HugeiconsIcon
                aria-hidden="true"
                icon={ArrowDown01Icon}
                size={14}
                strokeWidth={1.6}
              />
            </Button>
          </div>
          <div className="flex-1 space-y-1">
            {isEditing ? (
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`agenda-title-${item.id}`}>Titel</Label>
                  <Input
                    className={FIELD}
                    id={`agenda-title-${item.id}`}
                    maxLength={200}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    value={titleDraft}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`agenda-notes-${item.id}`}>
                    Notizen (optional)
                  </Label>
                  <textarea
                    className={TEXTAREA}
                    id={`agenda-notes-${item.id}`}
                    maxLength={50000}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    value={notesDraft}
                  />
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-forest-900">
                  {item.title}
                </p>
                {item.notes && (
                  <p className="text-sm whitespace-pre-line text-forest-700/80">
                    {item.notes}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPicker
            onChange={(status) => onUpdate({ status })}
            status={item.status}
          />
          <Button
            aria-label="Agendapunkt bearbeiten"
            className="text-xs"
            onClick={() => {
              setIsEditing((v) => !v)
              setTitleDraft(item.title)
              setNotesDraft(item.notes ?? '')
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={FileEditIcon}
              size={14}
              strokeWidth={1.6}
            />
            {isEditing ? 'Abbrechen' : 'Bearbeiten'}
          </Button>
          {isEditing && (
            <Button
              className="text-xs"
              onClick={handleSaveEdits}
              size="sm"
              type="button"
            >
              Speichern
            </Button>
          )}
          <Button
            aria-label="Agendapunkt löschen"
            className="text-xs text-beet-700 hover:bg-beet-700/10 hover:text-beet-700"
            onClick={() => setConfirmDelete(true)}
            size="sm"
            type="button"
            variant="outline"
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

      <div className="mt-4 space-y-3">
        {item.votes.length === 0 ? (
          <p className="text-sm text-forest-700/60">Noch keine Abstimmungen.</p>
        ) : (
          item.votes.map((vote) => (
            <AgendaVoteCard
              attendees={attendees}
              eventSlug={eventSlug}
              key={vote.id}
              vote={vote}
            />
          ))
        )}
        <NewVoteForm onSubmit={(payload) => onAddVote(payload)} />
      </div>

      {confirmDelete && (
        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-beet-700/10 p-3 ring-1 ring-inset ring-beet-700/30"
          role="alertdialog"
        >
          <p className="text-sm text-beet-700">
            Agendapunkt wirklich löschen? Alle Abstimmungen und Stimmen
            verschwinden mit.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => setConfirmDelete(false)}
              size="sm"
              type="button"
              variant="outline"
            >
              Abbrechen
            </Button>
            <Button
              className="bg-beet-700 text-white hover:bg-beet-700/90"
              onClick={onDelete}
              size="sm"
              type="button"
            >
              Endgültig löschen
            </Button>
          </div>
        </div>
      )}

      {item.notes && !isEditing && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-forest-700/60">
          <HugeiconsIcon
            aria-hidden="true"
            icon={Note01Icon}
            size={12}
            strokeWidth={1.6}
          />
          Notizen vorhanden
        </p>
      )}
    </div>
  )
}

function StatusPicker({
  status,
  onChange,
}: {
  status: AgendaStatus
  onChange: (status: AgendaStatus) => void
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-forest-900/5 p-0.5">
      {STATUSES.map((s) => {
        const active = s === status
        return (
          <button
            aria-pressed={active}
            className={cn(
              'inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition',
              active
                ? 'bg-forest-900 text-cream-50 shadow-sm'
                : 'text-forest-700/70 hover:text-forest-900',
            )}
            key={s}
            onClick={() => onChange(s)}
            type="button"
          >
            {AGENDA_STATUS_LABELS[s]}
          </button>
        )
      })}
    </div>
  )
}

type NewVoteProps = {
  onSubmit: (payload: CreateEventAgendaVoteInput) => void
}

function NewVoteForm({ onSubmit }: NewVoteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [voteType, setVoteType] = useState<AgendaVoteType>('yn')
  const [countingMode, setCountingMode] =
    useState<AgendaCountingMode>('anonymous')
  // Each local option carries a stable uid so we can use it as a React
  // key without resorting to the array index (Biome enforces that).
  const uidCounter = useRef(0)
  const [optionLabels, setOptionLabels] = useState<
    Array<{ uid: number; label: string }>
  >(() => {
    uidCounter.current = 2
    return [
      { uid: 1, label: '' },
      { uid: 2, label: '' },
    ]
  })

  function reset() {
    setQuestion('')
    setVoteType('yn')
    setCountingMode('anonymous')
    uidCounter.current = 2
    setOptionLabels([
      { uid: 1, label: '' },
      { uid: 2, label: '' },
    ])
  }

  function handleSubmit() {
    if (!question.trim()) {
      toast.error('Bitte eine Frage eingeben.')
      return
    }
    if (voteType === 'options') {
      const cleaned = optionLabels
        .map((l) => l.label.trim())
        .filter((l) => l.length > 0)
      if (cleaned.length < 2) {
        toast.error('Mindestens 2 Optionen erforderlich.')
        return
      }
      onSubmit({
        question: question.trim(),
        vote_type: 'options',
        counting_mode: countingMode,
        options: cleaned.map((label) => ({ label })),
      })
    } else {
      onSubmit({
        question: question.trim(),
        vote_type: 'yn',
        counting_mode: countingMode,
      })
    }
    reset()
    setIsOpen(false)
  }

  if (!isOpen) {
    return (
      <Button
        className="text-xs"
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
        Abstimmung hinzufügen
      </Button>
    )
  }

  return (
    <div className="space-y-3 rounded-[1rem] bg-forest-900/4 p-3 ring-1 ring-inset ring-forest-900/8">
      <div className="space-y-1.5">
        <Label htmlFor="new-vote-question">Frage</Label>
        <Input
          className={FIELD}
          id="new-vote-question"
          maxLength={300}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="z. B. Soll der Wasserverteiler ersetzt werden?"
          value={question}
        />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-vote-type">Abstimmungsart</Label>
          <select
            className="h-11 w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 text-base text-forest-900 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none"
            id="new-vote-type"
            onChange={(e) => setVoteType(e.target.value as AgendaVoteType)}
            value={voteType}
          >
            <option value="yn">Ja / Nein</option>
            <option value="options">Optionsabstimmung</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-vote-mode">Zählung</Label>
          <select
            className="h-11 w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 text-base text-forest-900 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none"
            id="new-vote-mode"
            onChange={(e) =>
              setCountingMode(e.target.value as AgendaCountingMode)
            }
            value={countingMode}
          >
            <option value="anonymous">Anonym (Zähler pro Option)</option>
            <option value="per_attendee">Pro anwesender Person</option>
          </select>
        </div>
      </div>
      {voteType === 'options' && (
        <div className="space-y-2">
          <Label>Optionen</Label>
          {optionLabels.map((opt, idx) => (
            <div className="flex items-center gap-2" key={opt.uid}>
              <Input
                className={FIELD}
                maxLength={200}
                onChange={(e) =>
                  setOptionLabels((prev) =>
                    prev.map((l, i) =>
                      i === idx ? { ...l, label: e.target.value } : l,
                    ),
                  )
                }
                placeholder={`Option ${idx + 1}`}
                value={opt.label}
              />
              {optionLabels.length > 2 && (
                <Button
                  aria-label={`Option ${idx + 1} entfernen`}
                  className="text-beet-700 hover:bg-beet-700/10 hover:text-beet-700"
                  onClick={() =>
                    setOptionLabels((prev) => prev.filter((_, i) => i !== idx))
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <HugeiconsIcon
                    aria-hidden="true"
                    icon={CancelSquareIcon}
                    size={14}
                    strokeWidth={1.6}
                  />
                </Button>
              )}
            </div>
          ))}
          {optionLabels.length < 20 && (
            <Button
              className="text-xs"
              onClick={() => {
                uidCounter.current += 1
                const uid = uidCounter.current
                setOptionLabels((prev) => [...prev, { uid, label: '' }])
              }}
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
              Weitere Option
            </Button>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button
          onClick={() => {
            reset()
            setIsOpen(false)
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          Abbrechen
        </Button>
        <Button onClick={handleSubmit} size="sm" type="button">
          Abstimmung anlegen
        </Button>
      </div>
    </div>
  )
}
