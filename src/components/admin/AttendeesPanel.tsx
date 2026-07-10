import { Add01Icon, CancelSquareIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '~/lib/ui-utils'
import {
  useAddActualAttendee,
  useAddPlannedAttendee,
  useRemoveActualAttendee,
  useRemovePlannedAttendee,
  useReplacePlannedAttendees,
} from '~/services/event.service'
import { useAdminUsers } from '~/services/user.service'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { Label } from '~/ui/label'
import { Separator } from '~/ui/separator'
import type {
  EventAttendee,
  EventWithDetails,
  UpdateEventAttendeesInput,
} from '~func/contracts/event'
import { FIELD, SelectField } from './form-ui'

type PickerUser = { id: number; first_name: string; last_name: string }

/** "Vorname Nachname" for prefilling the name field on user pick. */
function fullName(user: PickerUser): string {
  return `${user.first_name} ${user.last_name}`.trim()
}

/**
 * Identity key for matching a planned attendee to an actual-attendee
 * row: the linked user id when there is one, otherwise the name.
 * The two lists aren't FK-linked, so this is the only way to tell
 * "is this planned person marked present?".
 */
function attendeeKey(a: { user_id: number | null; name: string }): string {
  return a.user_id !== null
    ? `u:${a.user_id}`
    : `n:${a.name.trim().toLowerCase()}`
}

type Draft = { name: string; user_id: number | null }

type Props = { event: EventWithDetails }

export default function AttendeesPanel({ event }: Props) {
  const { data: users } = useAdminUsers()
  const { mutate: addPlanned } = useAddPlannedAttendee(event.slug)
  const { mutate: removePlanned } = useRemovePlannedAttendee(event.slug)
  const { mutate: replacePlanned, isPending: isSavingPlanned } =
    useReplacePlannedAttendees(event.slug)

  return (
    <div className="space-y-5">
      <Section
        addLabel="Geplanten Teilnehmer hinzufügen"
        attendees={event.planned_attendees}
        isSaving={isSavingPlanned}
        nameId="planned-attendee-name"
        onAdd={(draft) =>
          addPlanned(
            { name: draft.name, user_id: draft.user_id ?? undefined },
            {
              onError: () => toast.error('Hinzufügen fehlgeschlagen.'),
            },
          )
        }
        onSave={(attendees) =>
          replacePlanned(
            { attendees },
            {
              onSuccess: () =>
                toast.success('Geplante Teilnehmer gespeichert.'),
              onError: () => toast.error('Speichern fehlgeschlagen.'),
            },
          )
        }
        onRemove={(id) =>
          removePlanned(id, {
            onError: () => toast.error('Entfernen fehlgeschlagen.'),
          })
        }
        selectId="planned-attendee-user"
        title="Geplante Teilnehmer"
        users={users ?? []}
      />
      <Separator />
      <AttendanceChecklist event={event} />
    </div>
  )
}

/**
 * "Wer war tatsächlich da?" — a checklist derived from the planned
 * attendees above. Checking a name adds it to the actual-attendee
 * list; there is deliberately no way to check in someone who wasn't
 * planned (use the planned list above for that first).
 */
function AttendanceChecklist({ event }: { event: EventWithDetails }) {
  const { mutate: addActual } = useAddActualAttendee(event.slug)
  const { mutate: removeActual, isPending: isRemovingExtra } =
    useRemoveActualAttendee(event.slug)

  // The checkbox's checked state is derived from server data, but that
  // only updates once the mutation's query invalidation refetches —
  // without this, a controlled checkbox with no synchronous state
  // update visibly reverts for a moment after every click. Each
  // pending toggle overrides the derived value until its request
  // settles (success clears it because the derived value has caught
  // up by then; error clears it so the box snaps back to the truth).
  const [pending, setPending] = useState<Record<number, boolean>>({})

  const actualByKey = new Map(
    event.actual_attendees.map((a) => [attendeeKey(a), a]),
  )
  const plannedKeys = new Set(event.planned_attendees.map(attendeeKey))
  // Actual attendees that don't match anyone on the planned list —
  // e.g. from before this event had a plan, or a plus-one. Kept
  // visible (with a remove action) so old data isn't silently hidden.
  const extras = event.actual_attendees.filter(
    (a) => !plannedKeys.has(attendeeKey(a)),
  )

  function clearPending(id: number) {
    setPending((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function handleToggle(planned: EventAttendee, checked: boolean) {
    setPending((prev) => ({ ...prev, [planned.id]: checked }))
    if (checked) {
      addActual(
        { name: planned.name, user_id: planned.user_id ?? undefined },
        {
          onSuccess: () => clearPending(planned.id),
          onError: () => {
            toast.error('Speichern fehlgeschlagen.')
            clearPending(planned.id)
          },
        },
      )
    } else {
      const match = actualByKey.get(attendeeKey(planned))
      if (!match) {
        clearPending(planned.id)
        return
      }
      removeActual(match.id, {
        onSuccess: () => clearPending(planned.id),
        onError: () => {
          toast.error('Speichern fehlgeschlagen.')
          clearPending(planned.id)
        },
      })
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-forest-900">Anwesende</p>
        <p className="text-xs text-forest-700/60">
          Häkchen setzen, wer tatsächlich da war — die Auswahl kommt aus den
          geplanten Teilnehmern oben.
        </p>
      </div>
      {event.planned_attendees.length === 0 ? (
        <p className="text-sm text-forest-700/60">
          Noch keine geplanten Teilnehmer — trag sie oben ein, dann kannst du
          hier abhaken, wer da war.
        </p>
      ) : (
        <ul className="space-y-2">
          {event.planned_attendees.map((planned) => {
            const isPresent =
              planned.id in pending
                ? (pending[planned.id] as boolean)
                : actualByKey.has(attendeeKey(planned))
            const inputId = `present-${planned.id}`
            return (
              <li
                className="flex items-center gap-3 rounded-[1rem] bg-white/60 p-3 ring-1 ring-inset ring-forest-900/8"
                key={planned.id}
              >
                <input
                  checked={isPresent}
                  className="h-5 w-5 rounded-md border-forest-900/25 accent-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30"
                  disabled={planned.id in pending}
                  id={inputId}
                  onChange={(e) => handleToggle(planned, e.target.checked)}
                  type="checkbox"
                />
                <label className="text-sm text-forest-900" htmlFor={inputId}>
                  {planned.name}
                </label>
              </li>
            )
          })}
        </ul>
      )}

      {extras.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-forest-700/60">
            Zusätzlich anwesend (nicht geplant)
          </p>
          <ul className="space-y-2">
            {extras.map((a) => (
              <li
                className="flex items-center justify-between gap-3 rounded-[1rem] bg-white/60 p-3 ring-1 ring-inset ring-forest-900/8"
                key={a.id}
              >
                <span className="text-sm text-forest-900">{a.name}</span>
                <Button
                  aria-label={`${a.name} entfernen`}
                  className="text-beet-700 hover:bg-beet-700/10 hover:text-beet-700"
                  disabled={isRemovingExtra}
                  onClick={() =>
                    removeActual(a.id, {
                      onError: () => toast.error('Entfernen fehlgeschlagen.'),
                    })
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
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

type SectionProps = {
  title: string
  attendees: EventAttendee[]
  users: Array<{ id: number; first_name: string; last_name: string }>
  onAdd: (draft: Draft) => void
  onRemove: (id: number) => void
  onSave: (attendees: UpdateEventAttendeesInput['attendees']) => void
  isSaving: boolean
  addLabel: string
  nameId: string
  selectId: string
}

function Section({
  title,
  attendees,
  users,
  onAdd,
  onRemove,
  onSave,
  isSaving,
  addLabel,
  nameId,
  selectId,
}: SectionProps) {
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    attendees.map((a) => ({ name: a.name, user_id: a.user_id })),
  )
  const [newName, setNewName] = useState('')
  const [newUserId, setNewUserId] = useState<number | ''>('')

  // Keep local drafts in sync when the server changes the list (someone
  // added/removed an attendee elsewhere). We sync on length + identity
  // so an inline edit isn't clobbered by a stale refetch.
  if (attendees.length !== drafts.length) {
    setDrafts(attendees.map((a) => ({ name: a.name, user_id: a.user_id })))
  }

  const userOptions = users
    .slice()
    .sort((a, b) => a.last_name.localeCompare(b.last_name))

  function handleAdd() {
    if (!newName.trim()) {
      toast.error('Bitte einen Namen eingeben.')
      return
    }
    onAdd({
      name: newName.trim(),
      user_id: newUserId === '' ? null : newUserId,
    })
    setNewName('')
    setNewUserId('')
  }

  function handleSaveAll() {
    const cleaned = drafts
      .map((d) => ({ name: d.name.trim(), user_id: d.user_id }))
      .filter((d) => d.name.length > 0)
    if (cleaned.length === 0) {
      toast.error('Mindestens ein Name erforderlich.')
      return
    }
    onSave(cleaned)
  }

  function updateDraft(idx: number, patch: Partial<Draft>) {
    setDrafts((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)),
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-forest-900">{title}</p>
      {drafts.length === 0 ? (
        <p className="text-sm text-forest-700/60">Noch keine Einträge.</p>
      ) : (
        <ul className="space-y-2">
          {drafts.map((draft, idx) => {
            // The draft list mirrors `attendees` 1:1, so the underlying
            // attendee id is the stable key — falling back to a synthetic
            // marker for optimistic new rows that haven't been sent yet.
            const stableKey =
              attendees[idx]?.id !== undefined
                ? `${title}-${attendees[idx]?.id ?? 'unknown'}`
                : `${title}-new-${idx}`
            return (
              <li
                className="grid grid-cols-1 gap-2 rounded-[1rem] bg-white/60 p-3 ring-1 ring-inset ring-forest-900/8 sm:grid-cols-[1fr_220px_auto] sm:items-center"
                key={stableKey}
              >
                <Input
                  aria-label={`Name ${idx + 1}`}
                  className={FIELD}
                  maxLength={200}
                  onChange={(e) => updateDraft(idx, { name: e.target.value })}
                  placeholder="Name"
                  value={draft.name}
                />
                <SelectField
                  aria-label={`Verknüpfter Benutzer ${idx + 1}`}
                  onChange={(e) => {
                    const userId =
                      e.target.value === '' ? null : Number(e.target.value)
                    const patch: Partial<Draft> = { user_id: userId }
                    if (userId !== null && draft.name.trim().length === 0) {
                      const picked = userOptions.find((u) => u.id === userId)
                      if (picked) patch.name = fullName(picked)
                    }
                    updateDraft(idx, patch)
                  }}
                  value={draft.user_id ?? ''}
                >
                  <option value="">— kein Benutzer —</option>
                  {userOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name}
                    </option>
                  ))}
                </SelectField>
                <Button
                  aria-label={`${draft.name || 'Eintrag'} entfernen`}
                  className="text-beet-700 hover:bg-beet-700/10 hover:text-beet-700"
                  onClick={() => {
                    if (attendees[idx]) {
                      onRemove(attendees[idx].id)
                    } else {
                      setDrafts((prev) => prev.filter((_, i) => i !== idx))
                    }
                  }}
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
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2 rounded-[1rem] bg-forest-900/4 p-3 ring-1 ring-inset ring-forest-900/8">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor={nameId}>Neuer Name</Label>
          <Input
            className={FIELD}
            id={nameId}
            maxLength={200}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="z. B. Maria Hinkel"
            value={newName}
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor={selectId}>Verknüpfter Benutzer (optional)</Label>
          <SelectField
            id={selectId}
            onChange={(e) => {
              const userId = e.target.value === '' ? '' : Number(e.target.value)
              setNewUserId(userId)
              if (userId !== '' && newName.trim().length === 0) {
                const picked = userOptions.find((u) => u.id === userId)
                if (picked) setNewName(fullName(picked))
              }
            }}
            value={newUserId}
          >
            <option value="">— kein Benutzer —</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.first_name} {u.last_name}
              </option>
            ))}
          </SelectField>
        </div>
        <Button
          className="self-end"
          onClick={handleAdd}
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
          {addLabel}
        </Button>
      </div>
      <div className="flex justify-end">
        <Button
          className={cn(isSaving && 'opacity-60')}
          disabled={isSaving}
          onClick={handleSaveAll}
          size="sm"
          type="button"
        >
          {isSaving ? 'Wird gespeichert …' : 'Alle speichern'}
        </Button>
      </div>
    </div>
  )
}
