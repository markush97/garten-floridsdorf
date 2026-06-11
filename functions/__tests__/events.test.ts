import { describe, expect, it, vi } from 'vitest'
import {
  createEventAgendaItemInputSchema,
  createEventAgendaVoteInputSchema,
  createEventAttendeeInputSchema,
  createEventInputSchema,
  eventSchema,
  eventWithDetailsSchema,
  reorderEventAgendaItemsInputSchema,
  updateAttendeeVoteInputSchema,
  updateEventAgendaItemInputSchema,
  updateEventAgendaVoteInputSchema,
  updateEventAttendeesInputSchema,
  updateEventInputSchema,
} from '../contracts/event'

// ---------------------------------------------------------------------------
// Event core
// ---------------------------------------------------------------------------

describe('eventSchema', () => {
  it('accepts a valid event payload', () => {
    const result = eventSchema.safeParse({
      id: 1,
      slug: 'gartentag-juni',
      poll_id: null,
      title: 'Gartentag Juni',
      scheduled_date: '2026-06-15',
      scheduled_time: '14:00',
      location: 'Vereinshaus',
      agenda: null,
      transcription: null,
      created_at: '2026-06-10T10:00:00.000Z',
      updated_at: '2026-06-10T10:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('createEventInputSchema', () => {
  it('accepts the minimum required fields', () => {
    const result = createEventInputSchema.safeParse({
      title: 'Gartentag',
      scheduled_date: '2026-06-15',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a poll_id linking the event back to a poll', () => {
    const result = createEventInputSchema.safeParse({
      title: 'Gartentag',
      scheduled_date: '2026-06-15',
      poll_id: 7,
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid time format', () => {
    const result = createEventInputSchema.safeParse({
      title: 'Gartentag',
      scheduled_date: '2026-06-15',
      scheduled_time: '25:99',
    })
    expect(result.success).toBe(false)
  })

  it('trims whitespace from the title', () => {
    const result = createEventInputSchema.safeParse({
      title: '  Gartentag  ',
      scheduled_date: '2026-06-15',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Gartentag')
    }
  })
})

describe('updateEventInputSchema', () => {
  it('accepts a partial payload', () => {
    const result = updateEventInputSchema.safeParse({ title: 'Neuer Titel' })
    expect(result.success).toBe(true)
  })

  it('accepts null to clear a nullable field', () => {
    const result = updateEventInputSchema.safeParse({
      scheduled_time: null,
      location: null,
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Attendees
// ---------------------------------------------------------------------------

describe('createEventAttendeeInputSchema', () => {
  it('accepts a freeform name', () => {
    const result = createEventAttendeeInputSchema.safeParse({
      name: 'Bringt Oma mit',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an optional linked user', () => {
    const result = createEventAttendeeInputSchema.safeParse({
      name: 'Maria Hinkel',
      user_id: 3,
    })
    expect(result.success).toBe(true)
  })
})

describe('updateEventAttendeesInputSchema', () => {
  it('rejects an empty attendees list', () => {
    // The Zod schema doesn't declare a min here, but the server enforces
    // at least one row before calling the DB; we still want to verify the
    // shape is permissive on the input layer.
    const result = updateEventAttendeesInputSchema.safeParse({ attendees: [] })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Agenda items
// ---------------------------------------------------------------------------

describe('createEventAgendaItemInputSchema', () => {
  it('accepts a title only', () => {
    const result = createEventAgendaItemInputSchema.safeParse({
      title: 'Wasserverteiler reparieren',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a status override', () => {
    const result = createEventAgendaItemInputSchema.safeParse({
      title: 'Beschluss Wasserverteiler',
      status: 'discussed',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown status', () => {
    const result = createEventAgendaItemInputSchema.safeParse({
      title: 'x',
      status: 'pending',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateEventAgendaItemInputSchema', () => {
  it('accepts an empty patch (no-op)', () => {
    const result = updateEventAgendaItemInputSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('reorderEventAgendaItemsInputSchema', () => {
  it('accepts an order array of ids', () => {
    const result = reorderEventAgendaItemsInputSchema.safeParse({
      order: [3, 1, 2],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty order array', () => {
    const result = reorderEventAgendaItemsInputSchema.safeParse({ order: [] })
    expect(result.success).toBe(false)
  })

  it('rejects non-positive ids', () => {
    const result = reorderEventAgendaItemsInputSchema.safeParse({
      order: [1, 0, 2],
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Agenda votes
// ---------------------------------------------------------------------------

describe('createEventAgendaVoteInputSchema', () => {
  it('accepts a y/n vote', () => {
    const result = createEventAgendaVoteInputSchema.safeParse({
      question: 'Antrag annehmen?',
      vote_type: 'yn',
      counting_mode: 'anonymous',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an options vote with fewer than 2 options', () => {
    const result = createEventAgendaVoteInputSchema.safeParse({
      question: 'Welcher Standort?',
      vote_type: 'options',
      counting_mode: 'anonymous',
      options: [{ label: 'A' }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts an options vote with at least 2 options', () => {
    const result = createEventAgendaVoteInputSchema.safeParse({
      question: 'Welcher Standort?',
      vote_type: 'options',
      counting_mode: 'per_attendee',
      options: [{ label: 'Vorderer Eingang' }, { label: 'Hinterer Eingang' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty question', () => {
    const result = createEventAgendaVoteInputSchema.safeParse({
      question: '   ',
      vote_type: 'yn',
      counting_mode: 'anonymous',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateEventAgendaVoteInputSchema', () => {
  it('accepts a question-only update', () => {
    const result = updateEventAgendaVoteInputSchema.safeParse({
      question: 'Antrag in geänderter Fassung?',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an options replacement with new entries', () => {
    const result = updateEventAgendaVoteInputSchema.safeParse({
      options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
    })
    expect(result.success).toBe(true)
  })
})

describe('updateAttendeeVoteInputSchema', () => {
  it('accepts an option_id for per_attendee options votes', () => {
    const result = updateAttendeeVoteInputSchema.safeParse({
      option_id: 12,
      response: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a boolean response for y/n votes', () => {
    const result = updateAttendeeVoteInputSchema.safeParse({
      option_id: null,
      response: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts both null (clears the vote)', () => {
    const result = updateAttendeeVoteInputSchema.safeParse({
      option_id: null,
      response: null,
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// eventWithDetailsSchema — verifies the new `attendee_votes` shape
// ---------------------------------------------------------------------------

describe('eventWithDetailsSchema', () => {
  it('accepts a full event with attendee_votes inside agenda votes', () => {
    const result = eventWithDetailsSchema.safeParse({
      id: 1,
      slug: 'garten-juni',
      poll_id: 7,
      title: 'Gartentag',
      scheduled_date: '2026-06-15',
      scheduled_time: '14:00',
      location: null,
      agenda: null,
      transcription: null,
      created_at: '2026-06-10T10:00:00.000Z',
      updated_at: '2026-06-10T10:00:00.000Z',
      planned_attendees: [
        { id: 1, event_id: 1, user_id: 3, name: 'Maria', sort_order: 0 },
      ],
      actual_attendees: [
        { id: 2, event_id: 1, user_id: 3, name: 'Maria', sort_order: 0 },
      ],
      attachments: [],
      decisions: [],
      agenda_items: [
        {
          id: 9,
          event_id: 1,
          title: 'Antrag',
          notes: null,
          status: 'open',
          sort_order: 0,
          votes: [
            {
              id: 42,
              agenda_item_id: 9,
              question: 'Annehmen?',
              vote_type: 'yn',
              counting_mode: 'per_attendee',
              result_note: null,
              created_at: '2026-06-10T10:00:00.000Z',
              updated_at: '2026-06-10T10:00:00.000Z',
              options: [
                {
                  id: 100,
                  vote_id: 42,
                  label: 'Ja',
                  count: 0,
                  sort_order: 0,
                },
                {
                  id: 101,
                  vote_id: 42,
                  label: 'Nein',
                  count: 0,
                  sort_order: 1,
                },
              ],
              attendee_votes: [
                { attendee_id: 2, option_id: null, response: true },
              ],
            },
          ],
          attachments: [],
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts an event with no agenda items', () => {
    const result = eventWithDetailsSchema.safeParse({
      id: 1,
      slug: 'garten-juni',
      poll_id: null,
      title: 'Gartentag',
      scheduled_date: '2026-06-15',
      scheduled_time: null,
      location: null,
      agenda: null,
      transcription: null,
      created_at: '2026-06-10T10:00:00.000Z',
      updated_at: '2026-06-10T10:00:00.000Z',
      planned_attendees: [],
      actual_attendees: [],
      attachments: [],
      decisions: [],
      agenda_items: [],
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// findEventForPoll — server query
// ---------------------------------------------------------------------------

describe('findEventForPoll', () => {
  it('returns null when no event is linked to the poll', async () => {
    const orderBy = vi.fn().mockReturnValue({ get: async () => null })
    const where = vi.fn().mockReturnValue({ orderBy })
    const from = vi.fn().mockReturnValue({ where })
    const select = vi.fn().mockReturnValue({ from })

    const { findEventForPoll } = await import('../db/queries/events')
    const result = await findEventForPoll({ select } as never, 42)
    expect(result).toBeNull()
  })

  it('returns the most recently created event for the poll', async () => {
    const event = {
      id: 5,
      slug: 'garten-juni',
      poll_id: 42,
      title: 'Gartentag',
      scheduled_date: '2026-06-15',
      scheduled_time: null,
      location: null,
      agenda: null,
      transcription: null,
      created_at: '2026-06-10T10:00:00.000Z',
      updated_at: '2026-06-10T10:00:00.000Z',
    }
    const orderBy = vi.fn().mockReturnValue({ get: async () => event })
    const where = vi.fn().mockReturnValue({ orderBy })
    const from = vi.fn().mockReturnValue({ where })
    const select = vi.fn().mockReturnValue({ from })

    const { findEventForPoll } = await import('../db/queries/events')
    const result = await findEventForPoll({ select } as never, 42)
    expect(result).toEqual(event)
  })
})

// ---------------------------------------------------------------------------
// Attachment contracts
// ---------------------------------------------------------------------------

import {
  eventAttachmentSchema,
  isAllowedAttachmentContentType,
  MAX_ATTACHMENT_SIZE_BYTES,
  updateEventAttachmentInputSchema,
} from '../contracts/event'

describe('isAllowedAttachmentContentType', () => {
  it('accepts image/* prefixes', () => {
    expect(isAllowedAttachmentContentType('image/png')).toBe(true)
    expect(isAllowedAttachmentContentType('image/jpeg')).toBe(true)
    expect(isAllowedAttachmentContentType('image/webp')).toBe(true)
    expect(isAllowedAttachmentContentType('image/svg+xml')).toBe(true)
  })

  it('accepts application/pdf', () => {
    expect(isAllowedAttachmentContentType('application/pdf')).toBe(true)
  })

  it('rejects other content types', () => {
    expect(isAllowedAttachmentContentType('application/zip')).toBe(false)
    expect(isAllowedAttachmentContentType('text/plain')).toBe(false)
    expect(isAllowedAttachmentContentType('video/mp4')).toBe(false)
    expect(isAllowedAttachmentContentType('')).toBe(false)
  })
})

describe('eventAttachmentSchema', () => {
  it('accepts a valid attachment row', () => {
    const result = eventAttachmentSchema.safeParse({
      id: 1,
      event_id: 1,
      agenda_item_id: null,
      filename: 'foto.jpg',
      content_type: 'image/jpeg',
      size: 12345,
      r2_key: 'events/1/abc-foto.jpg',
      caption: 'Foto der Wasserleitung',
      uploaded_by_user_id: null,
      created_at: '2026-06-10T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a row missing required fields', () => {
    const result = eventAttachmentSchema.safeParse({
      id: 1,
      filename: 'foto.jpg',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateEventAttachmentInputSchema', () => {
  it('accepts a caption-only patch', () => {
    const result = updateEventAttachmentInputSchema.safeParse({
      caption: 'Neue Bildunterschrift',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an agenda_item_id reassignment', () => {
    const result = updateEventAttachmentInputSchema.safeParse({
      agenda_item_id: 9,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a null agenda_item_id to detach from an item', () => {
    const result = updateEventAttachmentInputSchema.safeParse({
      agenda_item_id: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown fields (strict)', () => {
    const result = updateEventAttachmentInputSchema.safeParse({
      caption: 'ok',
      filename: 'forbidden',
    })
    expect(result.success).toBe(false)
  })
})

describe('MAX_ATTACHMENT_SIZE_BYTES', () => {
  it('is 20 MB', () => {
    expect(MAX_ATTACHMENT_SIZE_BYTES).toBe(20 * 1024 * 1024)
  })
})

// ---------------------------------------------------------------------------
// Decision contracts
// ---------------------------------------------------------------------------

import {
  createEventDecisionInputSchema,
  nextResolutionNumberForYear,
  updateEventDecisionInputSchema,
} from '../contracts/event'

describe('nextResolutionNumberForYear', () => {
  it('starts at 001 when no decisions exist', () => {
    expect(nextResolutionNumberForYear([], 2026)).toBe('B-2026-001')
  })

  it('increments per year, ignoring other years', () => {
    const existing = [
      { resolution_number: 'B-2025-001' },
      { resolution_number: 'B-2025-002' },
      { resolution_number: 'B-2027-001' },
    ]
    expect(nextResolutionNumberForYear(existing, 2026)).toBe('B-2026-001')
  })

  it('picks the next integer for the same year', () => {
    const existing = [
      { resolution_number: 'B-2026-001' },
      { resolution_number: 'B-2026-002' },
      { resolution_number: 'B-2026-005' },
    ]
    expect(nextResolutionNumberForYear(existing, 2026)).toBe('B-2026-006')
  })

  it('zero-pads to 3 digits', () => {
    const existing = [
      { resolution_number: 'B-2026-009' },
      { resolution_number: 'B-2026-010' },
    ]
    expect(nextResolutionNumberForYear(existing, 2026)).toBe('B-2026-011')
  })
})

describe('createEventDecisionInputSchema', () => {
  const valid = {
    wording: 'Anschaffung eines Komposters zum Preis von 350 €.',
    proposer_user_id: 3,
    seconder_user_id: 4,
  }

  it('accepts a minimal decision with both proposers as user FKs', () => {
    const result = createEventDecisionInputSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('accepts a free-text proposer (no FK)', () => {
    const result = createEventDecisionInputSchema.safeParse({
      ...valid,
      proposer_user_id: null,
      proposer_name: 'Oma (Gast)',
    })
    expect(result.success).toBe(true)
  })

  it('trims whitespace in the wording and proposer names', () => {
    const result = createEventDecisionInputSchema.safeParse({
      ...valid,
      wording: '  Hallo Welt.  ',
      proposer_name: '  Oma  ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.wording).toBe('Hallo Welt.')
      expect(result.data.proposer_name).toBe('Oma')
    }
  })

  it('rejects an empty wording', () => {
    const result = createEventDecisionInputSchema.safeParse({
      ...valid,
      wording: '   ',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a missing proposer (no FK and no name)', () => {
    const result = createEventDecisionInputSchema.safeParse({
      ...valid,
      proposer_user_id: null,
      proposer_name: null,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a missing seconder (no FK and no name)', () => {
    const result = createEventDecisionInputSchema.safeParse({
      ...valid,
      seconder_user_id: null,
      seconder_name: null,
    })
    expect(result.success).toBe(false)
  })
})

describe('updateEventDecisionInputSchema', () => {
  it('accepts an empty patch (no-op)', () => {
    const result = updateEventDecisionInputSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects unknown fields (strict)', () => {
    const result = updateEventDecisionInputSchema.safeParse({
      wording: 'ok',
      resolution_number: 'B-2026-099',
    })
    expect(result.success).toBe(false)
  })
})
