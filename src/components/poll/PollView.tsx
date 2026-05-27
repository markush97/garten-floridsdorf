import { useState } from 'react'
import { DEFAULT_TIMEZONE, dayjs } from '~/lib/timezone'
import { cn } from '~/lib/ui-utils'
import type { Poll, Vote } from '~func/contracts/poll'

type Props = { poll: Poll }

const RESPONSE_LABELS = {
  yes: 'Ja',
  no: 'Nein',
  maybe: 'Vielleicht',
} as const

const RESPONSE_CLASSES = {
  yes: 'bg-leaf-500/15 text-leaf-500 ring-1 ring-inset ring-leaf-500/30',
  no: 'bg-beet-700/15 text-beet-700 ring-1 ring-inset ring-beet-700/30',
  maybe: 'bg-wood-600/15 text-wood-600 ring-1 ring-inset ring-wood-600/30',
} as const

function formatDate(iso: string, time: string | null) {
  const base = dayjs(iso).tz(DEFAULT_TIMEZONE).format('ddd, D. MMM')
  return time ? `${base}, ${time} Uhr` : base
}

function VoteCell({ vote }: { vote: Vote | undefined }) {
  const [open, setOpen] = useState(false)
  if (!vote) {
    return <span className="text-xs text-forest-700/30">–</span>
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        aria-label={`${RESPONSE_LABELS[vote.response]}${vote.comment ? ' – Kommentar anzeigen' : ''}`}
        className={cn(
          'rounded-full px-2.5 py-0.5 text-xs font-semibold',
          RESPONSE_CLASSES[vote.response],
          vote.comment && 'cursor-pointer',
        )}
        onClick={() => vote.comment && setOpen((o) => !o)}
        type="button"
      >
        {RESPONSE_LABELS[vote.response]}
      </button>
      {open && vote.comment && (
        <p className="max-w-[10rem] text-center text-[0.7rem] leading-snug text-forest-700/70">
          {vote.comment}
        </p>
      )}
    </div>
  )
}

export default function PollView({ poll }: Props) {
  const voterNames = [...new Set(poll.votes.map((v) => v.voter_name))].sort()

  if (poll.options.length === 0) {
    return (
      <p className="text-sm text-forest-700/60">
        Keine Terminoptionen vorhanden.
      </p>
    )
  }

  return (
    <section aria-label="Abstimmungsübersicht" className="space-y-3">
      <h2 className="text-lg font-semibold text-forest-900 sm:text-xl">
        Bisherige Antworten
        {voterNames.length > 0 && (
          <span className="ml-2 text-sm font-normal text-forest-700/60">
            ({voterNames.length}{' '}
            {voterNames.length === 1 ? 'Person' : 'Personen'})
          </span>
        )}
      </h2>
      <div className="overflow-x-auto rounded-[1.25rem] bg-white/75 ring-1 ring-inset ring-white/40 backdrop-blur shadow-[0_8px_24px_rgba(31,61,43,0.07)]">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-forest-900/8">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-forest-700">
                Termin
              </th>
              {voterNames.length === 0 ? (
                <th className="px-4 py-3 text-left text-xs text-forest-700/50 font-normal">
                  Noch keine Antworten
                </th>
              ) : (
                voterNames.map((name) => (
                  <th
                    className="px-3 py-3 text-center text-xs font-semibold text-forest-900"
                    key={name}
                  >
                    {name}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {poll.options.map((opt) => {
              const isFinal = poll.final_option_id === opt.id
              return (
                <tr
                  className={cn(
                    'border-b border-forest-900/5 last:border-0',
                    isFinal && 'bg-leaf-500/8',
                  )}
                  key={opt.id}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isFinal && (
                        <span
                          aria-label="Gewählter Termin"
                          className="text-leaf-500"
                          role="img"
                        >
                          ✓
                        </span>
                      )}
                      <div>
                        <p
                          className={cn(
                            'font-medium',
                            isFinal && 'text-leaf-500',
                          )}
                        >
                          {formatDate(opt.date, opt.time)}
                        </p>
                        {opt.label && (
                          <p className="text-xs text-forest-700/60">
                            {opt.label}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  {voterNames.map((name) => {
                    const vote = poll.votes.find(
                      (v) => v.voter_name === name && v.option_id === opt.id,
                    )
                    return (
                      <td
                        className="px-3 py-3 text-center"
                        key={`${opt.id}-${name}`}
                      >
                        <VoteCell vote={vote} />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
