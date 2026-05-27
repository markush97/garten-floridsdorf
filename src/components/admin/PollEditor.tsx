import { Link, useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import {
  useAdminPolls,
  useCreatePoll,
  useFinalizePoll,
} from '~/services/admin.service'
import { Button } from '~/ui/button'
import { DatePicker } from '~/ui/date-picker'
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
          time: o.time.trim() || undefined,
        })),
      },
      {
        onSuccess: (poll) => {
          toast.success('Umfrage erstellt und aktiviert.')
          void navigate({ to: '/poll/$slug', params: { slug: poll.slug } })
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
  const poll = polls?.find((p) => p.id === pollId)
  const { mutate: finalizePoll, isPending: isFinalizing } = useFinalizePoll()

  if (!poll) {
    return (
      <EditorShell title="Umfrage">
        <p className="text-forest-700/60">Umfrage nicht gefunden.</p>
        <Link className="mt-4 inline-block text-sm underline" to="/admin/polls">
          Zurück zur Übersicht
        </Link>
      </EditorShell>
    )
  }

  return (
    <EditorShell title={poll.title}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-[1.25rem] bg-white/75 p-5 ring-1 ring-inset ring-white/40">
          <div className="flex items-center justify-between">
            <span className="text-sm text-forest-700/70">Status</span>
            <span className="text-sm font-medium">
              {poll.final_option_id
                ? 'Termin festgelegt'
                : poll.is_active
                  ? 'Aktiv'
                  : 'Archiv'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-forest-700/70">Abstimmungslink</span>
            <a
              className="text-sm text-forest-700 underline"
              href={`/poll/${poll.slug}`}
              rel="noreferrer"
              target="_blank"
            >
              /poll/{poll.slug}
            </a>
          </div>
        </div>

        {poll.is_active && !poll.final_option_id && (
          <Button
            className="w-full sm:w-auto"
            disabled={isFinalizing}
            onClick={() =>
              finalizePoll(
                { id: poll.id, data: { closed: true } },
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
            className="h-9 w-9"
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
