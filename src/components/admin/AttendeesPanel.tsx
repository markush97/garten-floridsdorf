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
  useReplaceActualAttendees,
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

const FIELD =
  'w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 py-2.5 text-base text-forest-900 placeholder:text-forest-700/45 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

const SELECT =
  'h-11 w-full rounded-2xl border border-forest-900/12 bg-white/80 px-4 text-base text-forest-900 focus-visible:border-forest-700 focus-visible:ring-2 focus-visible:ring-forest-700/30 focus-visible:outline-none'

type Draft = { name: string; user_id: number | null }

type Props = { event: EventWithDetails }

export default function AttendeesPanel({ event }: Props) {
  const { data: users } = useAdminUsers()
  const { mutate: addPlanned } = useAddPlannedAttendee(event.slug)
  const { mutate: addActual } = useAddActualAttendee(event.slug)
  const { mutate: removePlanned } = useRemovePlannedAttendee(event.slug)
  const { mutate: removeActual } = useRemoveActualAttendee(event.slug)
  const { mutate: replacePlanned, isPending: isSavingPlanned } =
    useReplacePlannedAttendees(event.slug)
  const { mutate: replaceActual, isPending: isSavingActual } =
    useReplaceActualAttendees(event.slug)

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
      <Section
        addLabel="Anwesenden Teilnehmer hinzufügen"
        attendees={event.actual_attendees}
        isSaving={isSavingActual}
        nameId="actual-attendee-name"
        onAdd={(draft) =>
          addActual(
            { name: draft.name, user_id: draft.user_id ?? undefined },
            {
              onError: () => toast.error('Hinzufügen fehlgeschlagen.'),
            },
          )
        }
        onSave={(attendees) =>
          replaceActual(
            { attendees },
            {
              onSuccess: () => toast.success('Anwesenheit gespeichert.'),
              onError: () => toast.error('Speichern fehlgeschlagen.'),
            },
          )
        }
        onRemove={(id) =>
          removeActual(id, {
            onError: () => toast.error('Entfernen fehlgeschlagen.'),
          })
        }
        selectId="actual-attendee-user"
        title="Anwesende"
        users={users ?? []}
      />
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
                <select
                  aria-label={`Verknüpfter Benutzer ${idx + 1}`}
                  className={SELECT}
                  onChange={(e) =>
                    updateDraft(idx, {
                      user_id:
                        e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  value={draft.user_id ?? ''}
                >
                  <option value="">— kein Benutzer —</option>
                  {userOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name}
                    </option>
                  ))}
                </select>
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
          <select
            className={SELECT}
            id={selectId}
            onChange={(e) =>
              setNewUserId(e.target.value === '' ? '' : Number(e.target.value))
            }
            value={newUserId}
          >
            <option value="">— kein Benutzer —</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.first_name} {u.last_name}
              </option>
            ))}
          </select>
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
