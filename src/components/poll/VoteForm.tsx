import { AddCircleIcon, PencilIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import { cn } from '~/lib/ui-utils'
import { useSubmitVotes } from '~/services/poll.service'
import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { Label } from '~/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/ui/tooltip'
import type { Poll } from '~func/contracts/poll'

type ResponseValue = 'yes' | 'no' | 'maybe'

type SavedVote = {
  voter_name: string
  responses: Record<number, ResponseValue>
  comments: Record<number, string>
}

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

function formatDate(iso: string, time: string | null) {
  const base = dayjs(iso).tz(DEFAULT_TIMEZONE).format('dddd, D. MMMM')
  return time ? `${base}, ${time} Uhr` : base
}

function loadSavedVote(slug: string): SavedVote | null {
  try {
    const raw = localStorage.getItem(`poll_vote_${slug}`)
    return raw ? (JSON.parse(raw) as SavedVote) : null
  } catch {
    return null
  }
}

export default function VoteForm({ poll }: Props) {
  const [voterName, setVoterName] = useState(
    () =>
      loadSavedVote(poll.slug)?.voter_name ??
      localStorage.getItem('voter_name') ??
      '',
  )
  const [responses, setResponses] = useState<Record<number, ResponseValue>>(
    () =>
      (loadSavedVote(poll.slug)?.responses ?? {}) as Record<
        number,
        ResponseValue
      >,
  )
  const [comments, setComments] = useState<Record<number, string>>(
    () => loadSavedVote(poll.slug)?.comments ?? {},
  )
  const [isNameLocked, setIsNameLocked] = useState(() =>
    Boolean(loadSavedVote(poll.slug)?.voter_name),
  )
  const [hasVotedBefore, setHasVotedBefore] = useState(() =>
    Boolean(loadSavedVote(poll.slug)?.voter_name),
  )

  const { mutate: submitVotes, isPending } = useSubmitVotes(poll.slug)

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

  function handleAddVoter() {
    setVoterName('')
    setResponses({})
    setComments({})
    setIsNameLocked(false)
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
        onSuccess: () => {
          const saveData: SavedVote = { voter_name: name, responses, comments }
          localStorage.setItem(
            `poll_vote_${poll.slug}`,
            JSON.stringify(saveData),
          )
          localStorage.setItem('voter_name', name)
          setIsNameLocked(true)
          setHasVotedBefore(true)
          toast.success('Deine Antworten wurden gespeichert.')
        },
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
          <div className="flex items-center gap-2">
            <Input
              className={cn(isNameLocked && 'cursor-default bg-forest-900/5')}
              id="voter-name"
              maxLength={100}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="z. B. Maria"
              readOnly={isNameLocked}
              required
              type="text"
              value={voterName}
            />
            {isNameLocked && (
              <button
                aria-label="Namen bearbeiten"
                className="shrink-0 rounded-lg p-1.5 text-forest-700/60 transition-colors hover:bg-forest-900/8 hover:text-forest-900"
                onClick={() => setIsNameLocked(false)}
                type="button"
              >
                <HugeiconsIcon icon={PencilIcon} size={16} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {poll.options.map((opt) => (
            <div
              className="rounded-[1.25rem] bg-white/75 p-4 ring-1 ring-inset ring-white/40 backdrop-blur sm:p-5"
              key={opt.id}
            >
              <p className="mb-3 font-medium text-forest-900">
                {formatDate(opt.date, opt.time)}
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
                  aria-label={`Kommentar zu ${formatDate(opt.date, opt.time)}`}
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            className="min-h-12 w-full sm:w-auto"
            disabled={isPending}
            type="submit"
          >
            {isPending ? 'Wird gespeichert …' : 'Antworten speichern'}
          </Button>

          {hasVotedBefore && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Für eine weitere Person abstimmen"
                  className="min-h-12 w-full sm:w-auto"
                  onClick={handleAddVoter}
                  type="button"
                  variant="outline"
                >
                  <HugeiconsIcon
                    icon={AddCircleIcon}
                    size={20}
                    strokeWidth={1.5}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Für eine weitere Person abstimmen
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </form>
    </section>
  )
}
