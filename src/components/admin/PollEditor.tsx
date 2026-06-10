import {
  CalendarCheckIn01Icon,
  CheckmarkCircle01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import { cn } from '~/lib/ui-utils'
import {
  useAddPollOptions,
  useAdminPolls,
  useCreatePoll,
  useFinalizePoll,
} from '~/services/admin.service'
import { usePoll } from '~/services/poll.service'
import { Badge } from '~/ui/badge'
import { Button } from '~/ui/button'
import { DatePicker } from '~/ui/date-picker'
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
import { RichTextEditor } from '~/ui/rich-text-editor'
import { Separator } from '~/ui/separator'

type OptionDraft = {
  uid: number
  label: string
  date: Date | undefined
  time: string
}

type Props = { pollId: string }

export default function PollEditor({ pollId }: Props) {
  const isNew = pollId === 'new'
  const navigate = useNavigate()

  // Create-poll form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const uidCounter = useRef(2)
  const [options, setOptions] = useState<OptionDraft[]>([
    { uid: 1, label: '', date: undefined, time: '' },
    { uid: 2, label: '', date: undefined, time: '' },
  ])

  const { mutate: createPoll, isPending: isCreating } = useCreatePoll()

  function addOption() {
    uidCounter.current += 1
    const uid = uidCounter.current
    setOptions((prev) => [
      ...prev,
      { uid, label: '', date: undefined, time: '' },
    ])
  }

  function removeOption(idx: number) {
    setOptions((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleTimeInput(idx: number, raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 4)
    const formatted =
      digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
    updateOption(idx, { time: formatted })
  }

  function updateOption(idx: number, patch: Partial<OptionDraft>) {
    setOptions((prev) =>
      prev.map((opt, i) => (i === idx ? { ...opt, ...patch } : opt)),
    )
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Bitte einen Titel eingeben.')
      return
    }
    const validOptions = options.filter((o) => o.date)
    if (validOptions.length < 1) {
      toast.error('Mindestens eine Terminoption mit Datum benötigt.')
      return
    }
    createPoll(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        options: validOptions.map((o) => ({
          label:
            o.label.trim() || dayjs(o.date).tz(DEFAULT_TIMEZONE).format('dddd'),
          date: dayjs(o.date).format('YYYY-MM-DD'),
          time: /^([01]\d|2[0-3]):[0-5]\d$/.test(o.time.trim())
            ? o.time.trim()
            : undefined,
        })),
      },
      {
        onSuccess: (poll) => {
          toast.success('Umfrage erstellt und aktiviert.')
          void navigate({
            to: '/abstimmung/$slug',
            params: { slug: poll.slug },
          })
        },
        onError: () => toast.error('Fehler beim Erstellen der Umfrage.'),
      },
    )
  }

  if (isNew) {
    return (
      <EditorShell title="Neue Umfrage erstellen">
        <form className="space-y-6" onSubmit={handleCreate}>
          <div className="space-y-1.5">
            <Label htmlFor="poll-title">Titel</Label>
            <Input
              id="poll-title"
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Gartenarbeitstag Juni"
              required
              value={title}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Beschreibung (optional)</Label>
            <RichTextEditor
              onChange={setDescription}
              placeholder="Kurze Beschreibung …"
              value={description}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-semibold text-forest-900">
              Terminoptionen
            </p>
            {options.map((opt, idx) => (
              <div
                className="flex flex-col gap-2 rounded-[1rem] bg-white/60 p-4 ring-1 ring-inset ring-forest-900/8 sm:flex-row sm:items-end"
                key={opt.uid}
              >
                <div className="flex-1 space-y-1.5">
                  <Label>Datum</Label>
                  <DatePicker
                    onChange={(date) => updateOption(idx, { date })}
                    value={opt.date}
                  />
                </div>
                <div className="space-y-1.5 sm:w-32">
                  <Label htmlFor={`opt-time-${idx}`}>Uhrzeit (optional)</Label>
                  <Input
                    id={`opt-time-${idx}`}
                    inputMode="numeric"
                    maxLength={5}
                    onChange={(e) => handleTimeInput(idx, e.target.value)}
                    placeholder="HH:mm"
                    value={opt.time}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor={`opt-label-${idx}`}>
                    Bezeichnung (optional)
                  </Label>
                  <Input
                    id={`opt-label-${idx}`}
                    maxLength={200}
                    onChange={(e) =>
                      updateOption(idx, { label: e.target.value })
                    }
                    placeholder="z. B. Vormittag"
                    value={opt.label}
                  />
                </div>
                {options.length > 1 && (
                  <Button
                    aria-label={`Option ${idx + 1} entfernen`}
                    className="shrink-0 self-end text-beet-700 hover:bg-beet-700/10 hover:text-beet-700"
                    onClick={() => removeOption(idx)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Entfernen
                  </Button>
                )}
              </div>
            ))}
            {options.length < 20 && (
              <Button
                onClick={addOption}
                size="sm"
                type="button"
                variant="outline"
              >
                + Option hinzufügen
              </Button>
            )}
          </div>

          <Separator />

          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link to="/admin/polls">Abbrechen</Link>
            </Button>
            <Button disabled={isCreating} type="submit">
              {isCreating
                ? 'Wird erstellt …'
                : 'Umfrage erstellen & aktivieren'}
            </Button>
          </div>
        </form>
      </EditorShell>
    )
  }

  return <PollDetailEditor pollId={Number(pollId)} />
}

function PollDetailEditor({ pollId }: { pollId: number }) {
  const { data: polls } = useAdminPolls()
  const pollSummary = polls?.find((p) => p.id === pollId)
  const { data: poll } = usePoll(pollSummary?.slug ?? '')
  const { mutate: finalizePoll, isPending: isFinalizing } = useFinalizePoll()
  const { mutate: addOptions, isPending: isAdding } = useAddPollOptions()

  const newUidRef = useRef(0)
  const [newOptions, setNewOptions] = useState<OptionDraft[]>([])
  const [lockConfirmId, setLockConfirmId] = useState<number | null>(null)

  function addNewOptionRow() {
    newUidRef.current += 1
    setNewOptions((prev) => [
      ...prev,
      { uid: newUidRef.current, label: '', date: undefined, time: '' },
    ])
  }

  function updateNewOption(idx: number, patch: Partial<OptionDraft>) {
    setNewOptions((prev) =>
      prev.map((opt, i) => (i === idx ? { ...opt, ...patch } : opt)),
    )
  }

  function removeNewOption(idx: number) {
    setNewOptions((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleNewOptionTime(idx: number, raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 4)
    const formatted =
      digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
    updateNewOption(idx, { time: formatted })
  }

  function handleAddOptions() {
    const valid = newOptions.filter((o) => o.date)
    if (valid.length === 0) {
      toast.error('Mindestens eine Terminoption mit Datum benötigt.')
      return
    }
    addOptions(
      {
        id: pollId,
        data: {
          options: valid.map((o) => ({
            label:
              o.label.trim() ||
              dayjs(o.date).tz(DEFAULT_TIMEZONE).format('dddd'),
            date: dayjs(o.date).format('YYYY-MM-DD'),
            time: /^([01]\d|2[0-3]):[0-5]\d$/.test(o.time.trim())
              ? o.time.trim()
              : undefined,
          })),
        },
      },
      {
        onSuccess: () => {
          toast.success('Neue Terminoptionen hinzugefügt.')
          setNewOptions([])
        },
        onError: () => toast.error('Fehler beim Hinzufügen der Optionen.'),
      },
    )
  }

  function handleLockOption(optionId: number) {
    finalizePoll(
      { id: pollId, data: { final_option_id: optionId } },
      {
        onSuccess: () => {
          setLockConfirmId(null)
          toast.success('Termin festgelegt – erscheint auf der Startseite.')
        },
        onError: () => toast.error('Fehler beim Festlegen des Termins.'),
      },
    )
  }

  function handleUnlockOption() {
    finalizePoll(
      { id: pollId, data: { final_option_id: null } },
      {
        onSuccess: () => toast.success('Termin aufgehoben.'),
        onError: () => toast.error('Fehler beim Aufheben des Termins.'),
      },
    )
  }

  if (!pollSummary) {
    return (
      <EditorShell title="Umfrage">
        <p className="text-forest-700/60">Umfrage nicht gefunden.</p>
        <Link className="mt-4 inline-block text-sm underline" to="/admin/polls">
          Zurück zur Übersicht
        </Link>
      </EditorShell>
    )
  }

  const sortedOptions = poll
    ? [...poll.options].sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date)
        if (dateCmp !== 0) return dateCmp
        return (a.time ?? '').localeCompare(b.time ?? '')
      })
    : []

  const lockedOption = pollSummary?.final_option_id
    ? (poll?.options.find((o) => o.id === pollSummary.final_option_id) ?? null)
    : null

  return (
    <EditorShell title={pollSummary.title}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-[1.25rem] bg-white/75 p-5 ring-1 ring-inset ring-white/40">
          <div className="flex items-center justify-between">
            <span className="text-sm text-forest-700/70">Status</span>
            <span className="text-sm font-medium">
              {pollSummary.final_option_id
                ? 'Termin festgelegt'
                : pollSummary.is_active
                  ? 'Aktiv'
                  : 'Archiv'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-forest-700/70">Abstimmungslink</span>
            <a
              className="text-sm text-forest-700 underline"
              href={`/abstimmung/${pollSummary.slug}`}
              rel="noreferrer"
              target="_blank"
            >
              /poll/{pollSummary.slug}
            </a>
          </div>
        </div>

        {pollSummary.final_option_id && lockedOption && (
          <div
            className="flex flex-col gap-3 rounded-[1.25rem] bg-leaf-500/10 p-5 ring-1 ring-inset ring-leaf-500/30 sm:flex-row sm:items-center sm:justify-between"
            data-testid="locked-event-banner"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-leaf-500/20 text-leaf-500">
                <HugeiconsIcon
                  icon={CalendarCheckIn01Icon}
                  size={22}
                  strokeWidth={1.8}
                />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-leaf-500">
                  Festgelegter Termin
                </p>
                <p className="mt-1 font-display text-lg text-forest-900 sm:text-xl">
                  {dayjs(lockedOption.date)
                    .tz(DEFAULT_TIMEZONE)
                    .format('dddd, D. MMMM YYYY')}
                  {lockedOption.time && (
                    <span className="ml-2 text-base font-normal text-forest-700/80">
                      {lockedOption.time} Uhr
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-forest-700/80">
                  Erscheint auf der Startseite als „Nächster Termin“.
                </p>
              </div>
            </div>
            <Button
              aria-label="Festgelegten Termin aufheben"
              className="text-beet-700 hover:bg-beet-700/10 hover:text-beet-700"
              disabled={isFinalizing}
              onClick={handleUnlockOption}
              size="sm"
              variant="outline"
            >
              Termin aufheben
            </Button>
          </div>
        )}

        <Separator />

        <div className="space-y-3">
          <p className="text-sm font-semibold text-forest-900">
            Vorhandene Terminoptionen
          </p>
          {sortedOptions.length === 0 ? (
            <p className="text-sm text-forest-700/60">
              Noch keine Terminoptionen.
            </p>
          ) : (
            <ul className="space-y-2">
              {sortedOptions.map((opt) => {
                const label = dayjs(opt.date)
                  .tz(DEFAULT_TIMEZONE)
                  .format('dddd, D. MMMM YYYY')
                const isLocked = pollSummary.final_option_id === opt.id
                return (
                  <li
                    className={cn(
                      'flex flex-col gap-2 rounded-[1rem] px-4 py-3 ring-1 ring-inset sm:flex-row sm:items-center sm:justify-between',
                      isLocked
                        ? 'bg-leaf-500/10 ring-leaf-500/30'
                        : 'bg-white/60 ring-forest-900/8',
                    )}
                    key={opt.id}
                  >
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                      <span className="font-medium text-forest-900">
                        {label}
                        {opt.time && (
                          <span className="ml-2 text-sm font-normal text-forest-700/70">
                            {opt.time} Uhr
                          </span>
                        )}
                      </span>
                      {opt.label && (
                        <span className="text-sm text-forest-700/70">
                          {opt.label}
                        </span>
                      )}
                      {isLocked && (
                        <Badge className="w-fit bg-leaf-500/20 text-leaf-500 ring-leaf-500/40">
                          <HugeiconsIcon
                            aria-hidden="true"
                            icon={CheckmarkCircle01Icon}
                            size={12}
                            strokeWidth={2}
                          />
                          Festgelegt
                        </Badge>
                      )}
                    </div>
                    {!isLocked && (
                      <Button
                        aria-label={`Termin auf ${label} festlegen`}
                        className="shrink-0 self-start text-xs sm:self-auto"
                        disabled={isFinalizing}
                        onClick={() => setLockConfirmId(opt.id)}
                        size="sm"
                        variant="outline"
                      >
                        <HugeiconsIcon
                          aria-hidden="true"
                          icon={CheckmarkCircle01Icon}
                          size={14}
                          strokeWidth={1.8}
                        />
                        Termin festlegen
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <Dialog
          onOpenChange={(open) => !open && setLockConfirmId(null)}
          open={lockConfirmId !== null}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Termin festlegen?</DialogTitle>
              <DialogDescription>
                {(() => {
                  const opt = poll?.options.find((o) => o.id === lockConfirmId)
                  if (!opt) return null
                  const label = dayjs(opt.date)
                    .tz(DEFAULT_TIMEZONE)
                    .format('dddd, D. MMMM YYYY')
                  return (
                    <span className="block pt-1">
                      <span className="font-semibold text-forest-900">
                        {label}
                        {opt.time && ` · ${opt.time} Uhr`}
                      </span>{' '}
                      wird als „Nächster Termin“ auf der Startseite angezeigt.
                      Du kannst die Auswahl jederzeit wieder aufheben.
                    </span>
                  )
                })()}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setLockConfirmId(null)} variant="outline">
                Abbrechen
              </Button>
              <Button
                disabled={isFinalizing || lockConfirmId === null}
                onClick={() =>
                  lockConfirmId !== null && handleLockOption(lockConfirmId)
                }
              >
                {isFinalizing ? 'Wird gespeichert …' : 'Termin festlegen'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Separator />

        <div className="space-y-3">
          <p className="text-sm font-semibold text-forest-900">
            Neue Terminoptionen hinzufügen
          </p>
          {newOptions.map((opt, idx) => (
            <div
              className="flex flex-col gap-2 rounded-[1rem] bg-white/60 p-4 ring-1 ring-inset ring-forest-900/8 sm:flex-row sm:items-end"
              key={opt.uid}
            >
              <div className="flex-1 space-y-1.5">
                <Label>Datum</Label>
                <DatePicker
                  onChange={(date) => updateNewOption(idx, { date })}
                  value={opt.date}
                />
              </div>
              <div className="space-y-1.5 sm:w-32">
                <Label htmlFor={`new-opt-time-${idx}`}>
                  Uhrzeit (optional)
                </Label>
                <Input
                  id={`new-opt-time-${idx}`}
                  inputMode="numeric"
                  maxLength={5}
                  onChange={(e) => handleNewOptionTime(idx, e.target.value)}
                  placeholder="HH:mm"
                  value={opt.time}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor={`new-opt-label-${idx}`}>
                  Bezeichnung (optional)
                </Label>
                <Input
                  id={`new-opt-label-${idx}`}
                  maxLength={200}
                  onChange={(e) =>
                    updateNewOption(idx, { label: e.target.value })
                  }
                  placeholder="z. B. Vormittag"
                  value={opt.label}
                />
              </div>
              <Button
                aria-label={`Neue Option ${idx + 1} entfernen`}
                className="shrink-0 self-end text-beet-700 hover:bg-beet-700/10 hover:text-beet-700"
                onClick={() => removeNewOption(idx)}
                size="sm"
                type="button"
                variant="outline"
              >
                Entfernen
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={addNewOptionRow}
              size="sm"
              type="button"
              variant="outline"
            >
              + Option hinzufügen
            </Button>
            {newOptions.length > 0 && (
              <Button
                disabled={isAdding}
                onClick={handleAddOptions}
                size="sm"
                type="button"
              >
                {isAdding ? 'Wird gespeichert …' : 'Optionen speichern'}
              </Button>
            )}
          </div>
        </div>

        {pollSummary.is_active && !pollSummary.final_option_id && (
          <>
            <Separator />
            <Button
              className="w-full sm:w-auto"
              disabled={isFinalizing}
              onClick={() =>
                finalizePoll(
                  { id: pollSummary.id, data: { closed: true } },
                  {
                    onSuccess: () => toast.success('Umfrage geschlossen.'),
                    onError: () => toast.error('Fehler.'),
                  },
                )
              }
              variant="outline"
            >
              {isFinalizing ? 'Wird geschlossen …' : 'Umfrage schließen'}
            </Button>
          </>
        )}

        <Link
          className="block text-sm underline text-forest-700/70"
          to="/admin/polls"
        >
          ← Zurück zur Übersicht
        </Link>
      </div>
    </EditorShell>
  )
}

function EditorShell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8f3e7_0%,#f2ecdc_100%)] text-forest-900">
      <header className="mx-auto flex w-full max-w-[1180px] items-center gap-3 px-3 py-4 sm:px-6 lg:px-8">
        <Link to="/">
          <img
            alt="SV Beet & Bewegung"
            className="h-9 w-9 mix-blend-multiply"
            src="/brand/icon.png"
          />
        </Link>
        <span className="text-sm font-medium text-forest-700">Admin</span>
      </header>
      <main className="mx-auto w-full max-w-[1180px] px-3 pb-20 pt-2 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-6 rounded-[1.5rem] bg-white/75 p-5 shadow-[0_8px_24px_rgba(31,61,43,0.07)] ring-1 ring-inset ring-white/40 backdrop-blur sm:p-8">
          <h1 className="text-2xl text-forest-900">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  )
}
