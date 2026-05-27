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

const STICKY_COL = 'sticky left-0 z-[1] bg-white px-4'

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
        <p className="max-w-40 text-center text-[0.7rem] leading-snug text-forest-700/70">
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
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-forest-900/8">
              {/* sticky name column header */}
              <th
                className={cn(
                  STICKY_COL,
                  'py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-forest-700',
                )}
              >
                Name
              </th>
              {/* one column per date option */}
              {poll.options.map((opt) => {
                const isFinal = poll.final_option_id === opt.id
                const d = dayjs(opt.date).tz(DEFAULT_TIMEZONE)
                return (
                  <th
                    className={cn(
                      'min-w-22 px-3 py-3 text-center text-xs font-semibold',
                      isFinal
                        ? 'bg-leaf-500/8 text-leaf-500'
                        : 'text-forest-900',
                    )}
                    key={opt.id}
                  >
                    {isFinal && (
                      <>
                        <span aria-hidden="true" className="mr-0.5">
                          ✓
                        </span>
                        <span className="sr-only">Gewählter Termin</span>{' '}
                      </>
                    )}
                    {d.format('dd, D. MMM')}
                    {opt.time && (
                      <p className="font-normal text-forest-700/70">
                        {opt.time} Uhr
                      </p>
                    )}
                    {opt.label && (
                      <p className="text-[0.65rem] font-normal text-forest-700/50">
                        {opt.label}
                      </p>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {voterNames.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-6 text-center text-forest-700/50"
                  colSpan={poll.options.length + 1}
                >
                  Noch keine Antworten
                </td>
              </tr>
            ) : (
              voterNames.map((name) => (
                <tr
                  className="border-b border-forest-900/5 last:border-0"
                  key={name}
                >
                  <td
                    className={cn(
                      STICKY_COL,
                      'py-2.5 font-medium text-forest-900',
                    )}
                  >
                    {name}
                  </td>
                  {poll.options.map((opt) => {
                    const vote = poll.votes.find(
                      (v) => v.voter_name === name && v.option_id === opt.id,
                    )
                    return (
                      <td
                        className={cn(
                          'px-3 py-2.5 text-center',
                          poll.final_option_id === opt.id && 'bg-leaf-500/8',
                        )}
                        key={`${name}-${opt.id}`}
                      >
                        <VoteCell vote={vote} />
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
          {/* totals footer */}
          {voterNames.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-forest-900/10 bg-forest-900/3">
                <td
                  className={cn(
                    STICKY_COL,
                    'bg-cream-50 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-forest-700',
                  )}
                >
                  Verfügbar
                </td>
                {poll.options.map((opt) => {
                  const optVotes = poll.votes.filter(
                    (v) => v.option_id === opt.id,
                  )
                  const yesCount = optVotes.filter(
                    (v) => v.response === 'yes',
                  ).length
                  const maybeCount = optVotes.filter(
                    (v) => v.response === 'maybe',
                  ).length
                  const total = yesCount + maybeCount
                  return (
                    <td
                      className={cn(
                        'px-3 py-2.5 text-center',
                        poll.final_option_id === opt.id && 'bg-leaf-500/8',
                      )}
                      key={opt.id}
                    >
                      {total === 0 ? (
                        <span className="text-xs text-forest-700/30">–</span>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-sm font-bold text-leaf-500">
                            {total}
                          </span>
                          {maybeCount > 0 && (
                            <span className="text-[0.65rem] text-forest-700/50">
                              {yesCount} sicher
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  )
}
