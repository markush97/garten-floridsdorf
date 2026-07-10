import {
  Add01Icon,
  CancelSquareIcon,
  Delete02Icon,
  FileEditIcon,
  ListViewIcon,
  Note01Icon,
  UserSquareIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { type AttendeeVoteRow, summarizeVote } from '~/lib/event-helpers'
import { cn } from '~/lib/ui-utils'
import {
  useDeleteAgendaVote,
  useSetAttendeeVote,
  useUpdateAgendaVote,
} from '~/services/event.service'
import { Badge } from '~/ui/badge'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { Label } from '~/ui/label'
import { Separator } from '~/ui/separator'
import type {
  EventAgendaVote,
  EventAgendaVoteOption,
  EventAttendee,
  UpdateAttendeeVoteInput,
  UpdateEventAgendaVoteInput,
} from '~func/contracts/event'

const FIELD =
  'w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-2.5 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

const COUNT_FIELD =
  'w-20 rounded-xl border border-forest-900/12 bg-white/80 px-3 py-1.5 text-center text-base text-forest-900 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

type Props = {
  eventSlug: string
  vote: EventAgendaVote
  attendees: EventAttendee[]
}

export default function AgendaVoteCard({ eventSlug, vote, attendees }: Props) {
  const { mutate: updateVote, isPending: isUpdating } =
    useUpdateAgendaVote(eventSlug)
  const { mutate: deleteVote, isPending: isDeleting } =
    useDeleteAgendaVote(eventSlug)
  const { mutate: setAttendeeVote, isPending: isSettingAttendee } =
    useSetAttendeeVote(eventSlug)

  const [isEditing, setIsEditing] = useState(false)
  const [questionDraft, setQuestionDraft] = useState(vote.question)
  const [resultDraft, setResultDraft] = useState(vote.result_note ?? '')
  // Local drafts mirror the server options. `id` is `null` for newly
  // added (unsaved) options — `localId` is a stable counter so we can
  // use it as a React key without falling back to the array index.
  const localIdCounter = useRef(0)
  const [optionDrafts, setOptionDrafts] = useState<
    Array<{
      id: number | null
      localId: number
      label: string
      count: number
    }>
  >(() =>
    vote.options.map((o, i) => ({
      id: o.id,
      localId: i,
      label: o.label,
      count: o.count,
    })),
  )
  const [confirmDelete, setConfirmDelete] = useState(false)

  const summary = summarizeVote(vote, vote.attendee_votes as AttendeeVoteRow[])

  function handleSaveEdits() {
    if (!questionDraft.trim()) {
      toast.error('Bitte eine Frage eingeben.')
      return
    }
    const payload: UpdateEventAgendaVoteInput = {
      question: questionDraft.trim(),
      result_note: resultDraft.trim() ? resultDraft.trim() : null,
    }
    if (vote.vote_type === 'options') {
      // The contract accepts either a label-only row (new option) or a
      // full row with id/label/count (existing option). Sending only
      // what's relevant keeps the server logic simple.
      payload.options = optionDrafts
        .filter((o) => o.label.trim().length > 0)
        .map((o) => {
          if (o.id === null) {
            return { label: o.label.trim() }
          }
          return { id: o.id, label: o.label.trim(), count: o.count }
        })
    }
    updateVote(
      { voteId: vote.id, data: payload },
      {
        onSuccess: () => {
          toast.success('Abstimmung gespeichert.')
          setIsEditing(false)
        },
        onError: () => toast.error('Speichern fehlgeschlagen.'),
      },
    )
  }

  function handleDelete() {
    deleteVote(vote.id, {
      onSuccess: () => {
        toast.success('Abstimmung gelöscht.')
        setConfirmDelete(false)
      },
      onError: () => toast.error('Löschen fehlgeschlagen.'),
    })
  }

  function setAttendeeResponse(
    attendeeId: number,
    patch: UpdateAttendeeVoteInput,
  ) {
    setAttendeeVote(
      { voteId: vote.id, attendeeId, data: patch },
      {
        onError: () => toast.error('Stimme konnte nicht gespeichert werden.'),
      },
    )
  }

  const isYn = vote.vote_type === 'yn'
  const isAnonymous = vote.counting_mode === 'anonymous'

  return (
    <div
      className="rounded-[1rem] bg-white/60 p-4 ring-1 ring-inset ring-forest-900/8"
      data-testid={`vote-${vote.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-forest-900/8 text-forest-700 ring-forest-900/15">
              {isYn ? 'Ja / Nein' : 'Optionsabstimmung'}
            </Badge>
            <Badge
              className={cn(
                isAnonymous
                  ? 'bg-wood-600/15 text-wood-600 ring-wood-600/30'
                  : 'bg-leaf-500/15 text-leaf-500 ring-leaf-500/30',
              )}
            >
              <HugeiconsIcon
                aria-hidden="true"
                icon={isAnonymous ? ListViewIcon : UserSquareIcon}
                size={12}
                strokeWidth={1.6}
              />
              {isAnonymous ? 'Anonym (Zähler)' : 'Pro Teilnehmer:in'}
            </Badge>
          </div>
          <p className="text-sm font-medium text-forest-900">{vote.question}</p>
        </div>
        <div className="flex gap-2">
          <Button
            aria-label="Abstimmung bearbeiten"
            className="text-xs"
            onClick={() => {
              setIsEditing((v) => !v)
              setQuestionDraft(vote.question)
              setResultDraft(vote.result_note ?? '')
              setOptionDrafts(
                vote.options.map((o, i) => ({
                  id: o.id,
                  localId: i,
                  label: o.label,
                  count: o.count,
                })),
              )
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
          <Button
            aria-label="Abstimmung löschen"
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

      {isEditing ? (
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`vote-q-${vote.id}`}>Frage</Label>
            <Input
              className={FIELD}
              id={`vote-q-${vote.id}`}
              maxLength={300}
              onChange={(e) => setQuestionDraft(e.target.value)}
              value={questionDraft}
            />
          </div>
          {isYn ? (
            <p className="text-xs text-forest-700/60">
              Ja / Nein hat feste Optionen — die Stimmen werden unten gezählt.
            </p>
          ) : (
            <div className="space-y-2">
              <Label>Optionen</Label>
              {optionDrafts.map((opt, idx) => (
                <div
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_auto] sm:items-center"
                  key={opt.id ?? `new-${opt.localId}`}
                >
                  <Input
                    className={FIELD}
                    maxLength={200}
                    onChange={(e) =>
                      setOptionDrafts((prev) =>
                        prev.map((o, i) =>
                          i === idx ? { ...o, label: e.target.value } : o,
                        ),
                      )
                    }
                    placeholder={`Option ${idx + 1}`}
                    value={opt.label}
                  />
                  {isAnonymous && opt.id !== null ? (
                    <Input
                      aria-label={`Zähler ${opt.label}`}
                      className={COUNT_FIELD}
                      min={0}
                      onChange={(e) =>
                        setOptionDrafts((prev) =>
                          prev.map((o, i) =>
                            i === idx
                              ? {
                                  ...o,
                                  count: Math.max(
                                    0,
                                    Number(e.target.value) || 0,
                                  ),
                                }
                              : o,
                          ),
                        )
                      }
                      type="number"
                      value={opt.count}
                    />
                  ) : (
                    <span className="text-xs text-forest-700/50">
                      Zähler wird durch Stimmen gesetzt
                    </span>
                  )}
                  <Button
                    aria-label={`Option ${idx + 1} entfernen`}
                    className="text-beet-700 hover:bg-beet-700/10 hover:text-beet-700"
                    onClick={() =>
                      setOptionDrafts((prev) =>
                        prev.filter((_, i) => i !== idx),
                      )
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
                    Entfernen
                  </Button>
                </div>
              ))}
              {optionDrafts.length < 20 && (
                <Button
                  className="text-xs"
                  onClick={() => {
                    localIdCounter.current += 1
                    const localId = localIdCounter.current
                    setOptionDrafts((prev) => [
                      ...prev,
                      { id: null, localId, label: '', count: 0 },
                    ])
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
                  Option hinzufügen
                </Button>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`vote-result-${vote.id}`}>
              Ergebnisnotiz (optional)
            </Label>
            <textarea
              className="min-h-20 w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-3 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none"
              id={`vote-result-${vote.id}`}
              maxLength={50000}
              onChange={(e) => setResultDraft(e.target.value)}
              placeholder="z. B. „Mehrheitlich angenommen, 3 Enthaltungen.“"
              value={resultDraft}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setIsEditing(false)}
              size="sm"
              type="button"
              variant="outline"
            >
              Abbrechen
            </Button>
            <Button
              className={cn(isUpdating && 'opacity-60')}
              disabled={isUpdating}
              onClick={handleSaveEdits}
              size="sm"
              type="button"
            >
              {isUpdating ? 'Wird gespeichert …' : 'Speichern'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {isAnonymous ? (
            <AnonymousCounters
              isUpdating={isUpdating}
              options={vote.options}
              updateVote={updateVote}
              voteId={vote.id}
            />
          ) : isYn ? (
            <PerAttendeeYn
              attendees={attendees}
              isPending={isSettingAttendee}
              onChange={setAttendeeResponse}
              vote={vote}
            />
          ) : (
            <PerAttendeeOptions
              attendees={attendees}
              isPending={isSettingAttendee}
              onChange={setAttendeeResponse}
              vote={vote}
            />
          )}

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-forest-700/70">
            <span>
              {summary.totalCount === 0
                ? 'Noch keine Stimmen'
                : `${summary.totalCount} ${summary.totalCount === 1 ? 'Stimme' : 'Stimmen'}`}
              {summary.leadingLabel && (
                <>
                  {' · '}
                  <span className="font-medium text-forest-900">
                    Führung: {summary.leadingLabel} ({summary.leadingCount})
                  </span>
                </>
              )}
            </span>
            {vote.result_note && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-900/5 px-2 py-1 text-forest-700/80">
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={Note01Icon}
                  size={12}
                  strokeWidth={1.6}
                />
                {vote.result_note}
              </span>
            )}
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-beet-700/10 p-3 ring-1 ring-inset ring-beet-700/30"
          role="alertdialog"
        >
          <p className="text-sm text-beet-700">
            Abstimmung wirklich löschen? Alle Stimmen gehen verloren.
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
              disabled={isDeleting}
              onClick={handleDelete}
              size="sm"
              type="button"
            >
              {isDeleting ? 'Wird gelöscht …' : 'Endgültig löschen'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function AnonymousCounters({
  voteId,
  options,
  isUpdating,
  updateVote,
}: {
  voteId: number
  options: EventAgendaVoteOption[]
  isUpdating: boolean
  updateVote: (
    args: { voteId: number; data: UpdateEventAgendaVoteInput },
    callbacks: {
      onSuccess?: () => void
      onError?: () => void
    },
  ) => void
}) {
  const [drafts, setDrafts] = useState<Record<number, number>>(() =>
    Object.fromEntries(options.map((o) => [o.id, o.count])),
  )
  // Options the user has locally edited since the last save — these
  // are kept as-is when the server sends new counts (e.g. another
  // admin tab), everything else resyncs to the server value.
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev }
      for (const opt of options) {
        if (!dirtyIds.has(opt.id)) {
          next[opt.id] = opt.count
        }
      }
      return next
    })
  }, [options, dirtyIds])

  function updateDraft(optionId: number, value: number) {
    setDrafts((prev) => ({ ...prev, [optionId]: value }))
    setDirtyIds((prev) => new Set(prev).add(optionId))
  }

  function save() {
    updateVote(
      {
        voteId,
        data: {
          options: options.map((o) => ({
            id: o.id,
            label: o.label,
            count: Math.max(0, drafts[o.id] ?? 0),
          })),
        },
      },
      {
        onSuccess: () => {
          toast.success('Zähler aktualisiert.')
          setDirtyIds(new Set())
        },
        onError: () => toast.error('Speichern fehlgeschlagen.'),
      },
    )
  }

  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <div
          className="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-inset ring-forest-900/8"
          key={opt.id}
        >
          <span className="flex-1 text-sm text-forest-900">{opt.label}</span>
          <Input
            aria-label={`Zähler ${opt.label}`}
            className={COUNT_FIELD}
            min={0}
            onChange={(e) =>
              updateDraft(opt.id, Math.max(0, Number(e.target.value) || 0))
            }
            type="number"
            value={drafts[opt.id] ?? 0}
          />
        </div>
      ))}
      <div className="flex justify-end">
        <Button
          className={cn(isUpdating && 'opacity-60')}
          disabled={isUpdating}
          onClick={save}
          size="sm"
          type="button"
        >
          {isUpdating ? 'Wird gespeichert …' : 'Zähler speichern'}
        </Button>
      </div>
    </div>
  )
}

function PerAttendeeYn({
  vote,
  attendees,
  onChange,
  isPending,
}: {
  vote: EventAgendaVote
  attendees: EventAttendee[]
  onChange: (attendeeId: number, patch: UpdateAttendeeVoteInput) => void
  isPending: boolean
}) {
  return (
    <div
      className={cn('space-y-2', isPending && 'pointer-events-none opacity-70')}
    >
      {attendees.length === 0 ? (
        <p className="text-sm text-forest-700/60">
          Noch keine Anwesenden erfasst — lege oben Teilnehmer:innen an.
        </p>
      ) : (
        attendees.map((a) => {
          const row = vote.attendee_votes.find((v) => v.attendee_id === a.id)
          return (
            <div
              className="flex flex-wrap items-center gap-2 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-inset ring-forest-900/8"
              key={a.id}
            >
              <span className="flex-1 text-sm text-forest-900">{a.name}</span>
              <YnButton
                active={row?.response === true}
                label="Ja"
                onClick={() =>
                  onChange(a.id, {
                    option_id: null,
                    response: row?.response === true ? null : true,
                  })
                }
              />
              <YnButton
                active={row?.response === false}
                label="Nein"
                onClick={() =>
                  onChange(a.id, {
                    option_id: null,
                    response: row?.response === false ? null : false,
                  })
                }
              />
            </div>
          )
        })
      )}
    </div>
  )
}

function PerAttendeeOptions({
  vote,
  attendees,
  onChange,
  isPending,
}: {
  vote: EventAgendaVote
  attendees: EventAttendee[]
  onChange: (attendeeId: number, patch: UpdateAttendeeVoteInput) => void
  isPending: boolean
}) {
  return (
    <div
      className={cn('space-y-2', isPending && 'pointer-events-none opacity-70')}
    >
      {attendees.length === 0 ? (
        <p className="text-sm text-forest-700/60">
          Noch keine Anwesenden erfasst — lege oben Teilnehmer:innen an.
        </p>
      ) : (
        attendees.map((a) => {
          const row = vote.attendee_votes.find((v) => v.attendee_id === a.id)
          return (
            <div
              className="flex flex-col gap-2 rounded-xl bg-white/70 p-3 ring-1 ring-inset ring-forest-900/8"
              key={a.id}
            >
              <span className="text-sm font-medium text-forest-900">
                {a.name}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {vote.options.map((opt) => {
                  const active = row?.option_id === opt.id
                  return (
                    <button
                      aria-label={`${a.name} stimmt für ${opt.label}`}
                      aria-pressed={active}
                      className={cn(
                        'inline-flex h-9 items-center rounded-full border px-3 text-sm transition',
                        active
                          ? 'border-forest-700 bg-forest-700 text-cream-50'
                          : 'border-forest-900/15 bg-white text-forest-700 hover:border-forest-700/40 hover:bg-forest-700/5',
                      )}
                      key={opt.id}
                      onClick={() =>
                        onChange(a.id, {
                          option_id: active ? null : opt.id,
                          response: null,
                        })
                      }
                      type="button"
                    >
                      {opt.label}
                    </button>
                  )
                })}
                {row && row.option_id !== null && (
                  <Button
                    className="h-9 text-xs"
                    onClick={() =>
                      onChange(a.id, { option_id: null, response: null })
                    }
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Zurücksetzen
                  </Button>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function YnButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 min-w-12 items-center justify-center rounded-full border px-4 text-sm font-medium transition',
        active
          ? label === 'Ja'
            ? 'border-leaf-500 bg-leaf-500 text-white'
            : 'border-beet-700 bg-beet-700 text-white'
          : 'border-forest-900/15 bg-white text-forest-700 hover:border-forest-700/40 hover:bg-forest-700/5',
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}
