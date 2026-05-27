import { useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import { cn } from '~/lib/ui-utils'
import { useSubmitVotes } from '~/services/poll.service'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { Label } from '~/ui/label'
import type { Poll } from '~func/contracts/poll'

type ResponseValue = 'yes' | 'no' | 'maybe'

type Props = { poll: Poll }

const RESPONSE_OPTIONS: Array<{
  value: ResponseValue
  label: string
  classes: string
}> = [
  {
    value: 'yes',
    label: 'Ja',
    classes:
      'data-[active=true]:bg-leaf-500 data-[active=true]:text-white data-[active=true]:ring-leaf-500',
  },
  {
    value: 'no',
    label: 'Nein',
    classes:
      'data-[active=true]:bg-beet-700 data-[active=true]:text-white data-[active=true]:ring-beet-700',
  },
  {
    value: 'maybe',
    label: 'Vielleicht',
    classes:
      'data-[active=true]:bg-wood-600 data-[active=true]:text-white data-[active=true]:ring-wood-600',
  },
]

function formatDate(iso: string) {
  return dayjs(iso).tz(DEFAULT_TIMEZONE).format('dddd, D. MMMM')
}

export default function VoteForm({ poll }: Props) {
  const [voterName, setVoterName] = useState(
    () => localStorage.getItem('voter_name') ?? '',
  )
  const [responses, setResponses] = useState<Record<number, ResponseValue>>({})
  const [comments, setComments] = useState<Record<number, string>>({})

  const { mutate: submitVotes, isPending } = useSubmitVotes(String(poll.id))

  function handleNameChange(val: string) {
    setVoterName(val)
    localStorage.setItem('voter_name', val)
  }

  function toggleResponse(optionId: number, value: ResponseValue) {
    setResponses((prev) => ({
      ...prev,
      [optionId]:
        prev[optionId] === value
          ? (undefined as unknown as ResponseValue)
          : value,
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = voterName.trim()
    if (!name) {
      toast.error('Bitte gib deinen Namen ein.')
      return
    }
    const missing = poll.options.filter((opt) => !responses[opt.id])
    if (missing.length > 0) {
      toast.error('Bitte beantworte alle Terminoptionen.')
      return
    }
    submitVotes(
      {
        voter_name: name,
        responses: poll.options.map((opt) => ({
          option_id: opt.id,
          response: responses[opt.id] as ResponseValue,
          comment: comments[opt.id]?.trim() || undefined,
        })),
      },
      {
        onSuccess: () => toast.success('Deine Antworten wurden gespeichert.'),
        onError: () =>
          toast.error('Fehler beim Speichern. Bitte versuche es erneut.'),
      },
    )
  }

  return (
    <section aria-label="Abstimmungsformular" className="space-y-6">
      <h2 className="text-lg font-semibold text-forest-900 sm:text-xl">
        Deine Antwort
      </h2>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="voter-name">Dein Name</Label>
          <Input
            id="voter-name"
            maxLength={100}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="z. B. Maria"
            required
            type="text"
            value={voterName}
          />
        </div>

        <div className="space-y-4">
          {poll.options.map((opt) => (
            <div
              className="rounded-[1.25rem] bg-white/75 p-4 ring-1 ring-inset ring-white/40 backdrop-blur sm:p-5"
              key={opt.id}
            >
              <p className="mb-3 font-medium text-forest-900">
                {formatDate(opt.date)}
              </p>
              {opt.label && (
                <p className="mb-3 text-sm text-forest-700/70">{opt.label}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {RESPONSE_OPTIONS.map((r) => (
                  <button
                    className={cn(
                      'rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-forest-900/15 transition-colors',
                      'min-h-11 text-forest-700 hover:bg-forest-900/5',
                      r.classes,
                    )}
                    data-active={responses[opt.id] === r.value}
                    key={r.value}
                    onClick={() => toggleResponse(opt.id, r.value)}
                    type="button"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <Input
                  aria-label={`Kommentar zu ${formatDate(opt.date)}`}
                  className="text-sm"
                  maxLength={500}
                  onChange={(e) =>
                    setComments((prev) => ({
                      ...prev,
                      [opt.id]: e.target.value,
                    }))
                  }
                  placeholder="Kommentar (optional)"
                  type="text"
                  value={comments[opt.id] ?? ''}
                />
              </div>
            </div>
          ))}
        </div>

        <Button
          className="min-h-12 w-full sm:w-auto"
          disabled={isPending}
          type="submit"
        >
          {isPending ? 'Wird gespeichert …' : 'Antworten speichern'}
        </Button>
      </form>
    </section>
  )
}
