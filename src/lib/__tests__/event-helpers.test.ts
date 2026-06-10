import { describe, expect, it } from 'vitest'
import type { EventAgendaVote } from '~func/contracts/event'
import { stripHtmlTags, summarizeVote } from '../event-helpers'

function makeVote(
  partial: Partial<EventAgendaVote> & {
    vote_type: 'yn' | 'options'
    counting_mode: 'anonymous' | 'per_attendee'
  },
): EventAgendaVote {
  return {
    id: 1,
    agenda_item_id: 1,
    question: 'Frage?',
    result_note: null,
    created_at: '2026-06-10T00:00:00.000Z',
    updated_at: '2026-06-10T00:00:00.000Z',
    options: [],
    attendee_votes: [],
    ...partial,
  }
}

describe('summarizeVote', () => {
  it('sums anonymous y/n counters from the stored counts', () => {
    const vote = makeVote({
      vote_type: 'yn',
      counting_mode: 'anonymous',
      options: [
        { id: 10, vote_id: 1, label: 'Ja', count: 4, sort_order: 0 },
        { id: 11, vote_id: 1, label: 'Nein', count: 2, sort_order: 1 },
      ],
    })
    const result = summarizeVote(vote)
    expect(result.totalCount).toBe(6)
    expect(result.leadingLabel).toBe('Ja')
    expect(result.leadingCount).toBe(4)
  })

  it('returns null leader on an anonymous tie', () => {
    const vote = makeVote({
      vote_type: 'yn',
      counting_mode: 'anonymous',
      options: [
        { id: 10, vote_id: 1, label: 'Ja', count: 3, sort_order: 0 },
        { id: 11, vote_id: 1, label: 'Nein', count: 3, sort_order: 1 },
      ],
    })
    const result = summarizeVote(vote)
    expect(result.leadingLabel).toBeNull()
    expect(result.leadingCount).toBe(3)
  })

  it('counts per_attendee y/n from the join table (ignoring null responses)', () => {
    const vote = makeVote({
      vote_type: 'yn',
      counting_mode: 'per_attendee',
      options: [
        { id: 10, vote_id: 1, label: 'Ja', count: 0, sort_order: 0 },
        { id: 11, vote_id: 1, label: 'Nein', count: 0, sort_order: 1 },
      ],
    })
    const result = summarizeVote(vote, [
      { attendee_id: 1, option_id: null, response: true },
      { attendee_id: 2, option_id: null, response: true },
      { attendee_id: 3, option_id: null, response: false },
      { attendee_id: 4, option_id: null, response: null },
    ])
    expect(result.totalCount).toBe(3)
    expect(result.leadingLabel).toBe('Ja')
    expect(result.leadingCount).toBe(2)
  })

  it('counts per_attendee options from the join table', () => {
    const vote = makeVote({
      vote_type: 'options',
      counting_mode: 'per_attendee',
      options: [
        { id: 10, vote_id: 1, label: 'A', count: 0, sort_order: 0 },
        { id: 11, vote_id: 1, label: 'B', count: 0, sort_order: 1 },
        { id: 12, vote_id: 1, label: 'C', count: 0, sort_order: 2 },
      ],
    })
    const result = summarizeVote(vote, [
      { attendee_id: 1, option_id: 10, response: null },
      { attendee_id: 2, option_id: 10, response: null },
      { attendee_id: 3, option_id: 11, response: null },
    ])
    expect(result.totalCount).toBe(3)
    expect(result.leadingLabel).toBe('A')
    expect(result.leadingCount).toBe(2)
  })

  it('sorts tallies by count desc, then by sort_order', () => {
    const vote = makeVote({
      vote_type: 'options',
      counting_mode: 'anonymous',
      options: [
        { id: 11, vote_id: 1, label: 'B', count: 5, sort_order: 1 },
        { id: 10, vote_id: 1, label: 'A', count: 5, sort_order: 0 },
        { id: 12, vote_id: 1, label: 'C', count: 1, sort_order: 2 },
      ],
    })
    const result = summarizeVote(vote)
    // A and B tie at 5 — the leader is null (no clear winner).
    expect(result.leadingLabel).toBeNull()
    expect(result.leadingCount).toBe(5)
    expect(result.tallies.map((t) => t.option.label)).toEqual(['A', 'B', 'C'])
  })

  it('returns an empty result for a vote with no options and no responses', () => {
    const vote = makeVote({
      vote_type: 'yn',
      counting_mode: 'per_attendee',
      options: [],
    })
    const result = summarizeVote(vote)
    expect(result.totalCount).toBe(0)
    expect(result.leadingLabel).toBeNull()
  })
})

describe('stripHtmlTags', () => {
  it('returns an empty string for null/undefined/empty input', () => {
    expect(stripHtmlTags(null)).toBe('')
    expect(stripHtmlTags(undefined)).toBe('')
    expect(stripHtmlTags('')).toBe('')
  })

  it('strips tags and decodes the common named entities', () => {
    expect(
      stripHtmlTags('<h1>Begrüßung &amp; Co.</h1><p>Details hier.</p>'),
    ).toBe('Begrüßung & Co. Details hier.')
  })

  it('collapses whitespace from removed tags into single spaces', () => {
    expect(stripHtmlTags('<p>Ein</p><p>Absatz</p>')).toBe('Ein Absatz')
  })

  it('decodes non-breaking spaces', () => {
    expect(stripHtmlTags('<p>vorne&nbsp;hinten</p>')).toBe('vorne hinten')
  })
})
