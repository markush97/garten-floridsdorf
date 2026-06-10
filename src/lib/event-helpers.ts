import type {
  EventAgendaItem,
  EventAgendaVote,
  EventAgendaVoteOption,
} from '~func/contracts/event'

/**
 * One row of the `event_attendee_votes` join table as it travels inside
 * the `EventWithDetails` payload. Keeping a typed alias here keeps the
 * helper signatures honest without leaking the Zod type into every
 * call site.
 */
export type AttendeeVoteRow = {
  attendee_id: number
  option_id: number | null
  response: boolean | null
}

export type OptionTally = {
  option: EventAgendaVoteOption
  count: number
}

export type VoteSummary = {
  /** Tallies per option, sorted by count desc, then by original sort_order. */
  tallies: OptionTally[]
  /** Total tally: for `anonymous` this sums the stored counts; for
   *  `per_attendee` it counts the number of attendees that have voted. */
  totalCount: number
  /** Label of the leading option iff one option has strictly more votes
   *  than every other; null on ties. */
  leadingLabel: string | null
  leadingCount: number
}

/**
 * Computes the result of a vote. For `per_attendee` votes the attendee
 * count wins (the stored `count` column stays at zero — the join table
 * is the source of truth). For `anonymous` votes the stored `count` is
 * the answer.
 */
export function summarizeVote(
  vote: EventAgendaVote,
  attendeeVotes: readonly AttendeeVoteRow[] = [],
): VoteSummary {
  const options = [...vote.options].sort((a, b) => {
    const c = a.sort_order - b.sort_order
    return c !== 0 ? c : a.id - b.id
  })

  if (vote.counting_mode === 'anonymous') {
    return buildAnonymousSummary(options)
  }

  // per_attendee: count responses by option (or by y/n bool).
  const counts = new Map<number, number>()
  for (const opt of options) counts.set(opt.id, 0)
  let yesCount = 0
  let noCount = 0
  let total = 0
  for (const av of attendeeVotes) {
    if (vote.vote_type === 'yn') {
      if (av.response === true) yesCount += 1
      else if (av.response === false) noCount += 1
      else continue
      total += 1
    } else {
      if (av.option_id === null) continue
      counts.set(av.option_id, (counts.get(av.option_id) ?? 0) + 1)
      total += 1
    }
  }

  if (vote.vote_type === 'yn') {
    // For y/n, the two "options" rows (Ja/Nein) are still part of the
    // vote so we surface them with the computed counts.
    const enriched: OptionTally[] = options.map((opt) => {
      if (opt.label === 'Ja') {
        return { option: { ...opt, count: yesCount }, count: yesCount }
      }
      if (opt.label === 'Nein') {
        return { option: { ...opt, count: noCount }, count: noCount }
      }
      return { option: opt, count: 0 }
    })
    const lead = pickLeader(enriched)
    return { ...lead, totalCount: total }
  }

  const enriched: OptionTally[] = options.map((opt) => {
    const count = counts.get(opt.id) ?? 0
    return { option: { ...opt, count }, count }
  })
  const lead = pickLeader(enriched)
  return { ...lead, totalCount: total }
}

function buildAnonymousSummary(options: EventAgendaVoteOption[]): VoteSummary {
  const enriched: OptionTally[] = options.map((opt) => ({
    option: opt,
    count: opt.count,
  }))
  const lead = pickLeader(enriched)
  const total = enriched.reduce((acc, t) => acc + t.count, 0)
  return { ...lead, totalCount: total }
}

function pickLeader(tallies: OptionTally[]): {
  tallies: OptionTally[]
  leadingLabel: string | null
  leadingCount: number
} {
  const sorted = [...tallies].sort((a, b) => {
    const c = b.count - a.count
    return c !== 0 ? c : a.option.sort_order - b.option.sort_order
  })
  const top = sorted[0]
  const second = sorted[1]
  // Tie: no clear leader.
  const leadingLabel =
    top && (!second || top.count > second.count) ? top.option.label : null
  const leadingCount = top?.count ?? 0
  return { tallies: sorted, leadingLabel, leadingCount }
}

export const AGENDA_STATUS_LABELS: Record<EventAgendaItem['status'], string> = {
  open: 'Offen',
  discussed: 'Besprochen',
  skipped: 'Übersprungen',
}
/**
 * Strips HTML tags and decodes the common named entities. We use this
 * to render a plain-text preview of a transcription (which is now
 * stored as Tiptap HTML) in list views where we don't want raw markup.
 */
export function stripHtmlTags(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
