import { describe, expect, it } from 'vitest'
import type { EventWithDetails } from '~func/contracts/event'
import {
  buildPdfSections,
  buildPrintDocument,
  extractToc,
  injectHeadingIds,
} from '../event-pdf'

function makeEvent(partial: Partial<EventWithDetails> = {}): EventWithDetails {
  return {
    id: 1,
    slug: 'garten-juni',
    poll_id: null,
    title: 'Gartentreffen Juni',
    scheduled_date: '2026-06-15',
    scheduled_time: '15:00',
    location: 'Vereinshaus',
    agenda: null,
    transcription: '',
    created_at: '2026-06-10T00:00:00.000Z',
    updated_at: '2026-06-10T00:00:00.000Z',
    planned_attendees: [],
    actual_attendees: [],
    attachments: [],
    decisions: [],
    tasks: [],
    agenda_items: [],
    ...partial,
  }
}

function makeAgendaItem(
  partial: Partial<EventWithDetails['agenda_items'][number]> = {},
): EventWithDetails['agenda_items'][number] {
  return {
    id: 9,
    event_id: 1,
    title: 'Wasserverteiler',
    notes: null,
    status: 'open',
    sort_order: 0,
    votes: [],
    attachments: [],
    ...partial,
  }
}

function makeAttachment(
  partial: Partial<EventWithDetails['attachments'][number]> = {},
): EventWithDetails['attachments'][number] {
  return {
    id: 11,
    event_id: 1,
    agenda_item_id: null,
    filename: 'foto.jpg',
    content_type: 'image/jpeg',
    size: 1024 * 50,
    r2_key: 'events/1/foto.jpg',
    caption: 'Foto der Wasserleitung',
    uploaded_by_user_id: null,
    created_at: '2026-06-10T00:00:00.000Z',
    ...partial,
  }
}

function makeDecision(
  partial: Partial<EventWithDetails['decisions'][number]> = {},
): EventWithDetails['decisions'][number] {
  return {
    id: 1,
    event_id: 1,
    agenda_item_id: null,
    resolution_number: 'B-2026-001',
    wording: 'Anschaffung eines Komposters zum Preis von 350 €.',
    proposer_user_id: null,
    proposer_name: null,
    seconder_user_id: null,
    seconder_name: null,
    vote_id: null,
    result_note: null,
    sort_order: 0,
    created_at: '2026-06-10T00:00:00.000Z',
    updated_at: '2026-06-10T00:00:00.000Z',
    proposer_display: null,
    seconder_display: null,
    vote_snapshot: null,
    ...partial,
  }
}

function makeTask(
  partial: Partial<EventWithDetails['tasks'][number]> = {},
): EventWithDetails['tasks'][number] {
  return {
    id: 1,
    event_id: 1,
    agenda_item_id: null,
    title: 'Schlüssel bei Tom abholen',
    owner_user_id: null,
    owner_name: null,
    due_date: null,
    status: 'open',
    carried_from_event_id: null,
    carried_from_task_id: null,
    notes: null,
    sort_order: 0,
    completed_at: null,
    created_at: '2026-06-10T00:00:00.000Z',
    updated_at: '2026-06-10T00:00:00.000Z',
    owner_display: null,
    is_carried_over: false,
    ...partial,
  }
}

describe('extractToc', () => {
  it('returns an empty array for an empty string', () => {
    expect(extractToc('')).toEqual([])
  })

  it('returns an empty array when there are no headings', () => {
    expect(extractToc('<p>Nur Fließtext.</p><p>Mehr Fließtext.</p>')).toEqual(
      [],
    )
  })

  it('extracts a single h1', () => {
    const entries = extractToc('<h1>Wasserleitung</h1>')
    expect(entries).toEqual([
      { level: 1, text: 'Wasserleitung', slug: 'wasserleitung' },
    ])
  })

  it('extracts mixed levels in source order', () => {
    const html =
      '<h1>Begrüßung</h1><p>Text</p><h2>Anträge</h2><h3>Antrag 1</h3><h2>Sonstiges</h2>'
    const entries = extractToc(html)
    expect(entries).toEqual([
      { level: 1, text: 'Begrüßung', slug: 'begruessung' },
      { level: 2, text: 'Anträge', slug: 'antraege' },
      { level: 3, text: 'Antrag 1', slug: 'antrag-1' },
      { level: 2, text: 'Sonstiges', slug: 'sonstiges' },
    ])
  })

  it('strips nested tags and whitespace from the displayed text', () => {
    const html = '<h2>  <strong>Wichtiger</strong> Punkt  </h2>'
    const entries = extractToc(html)
    expect(entries[0]?.text).toBe('Wichtiger Punkt')
  })

  it('skips empty headings', () => {
    const html = '<h1>   </h1><h2>Echter Titel</h2>'
    const entries = extractToc(html)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.text).toBe('Echter Titel')
  })

  it('disambiguates duplicate heading slugs', () => {
    const html = '<h2>Beschluss</h2><h2>Beschluss</h2><h2>Beschluss</h2>'
    const entries = extractToc(html)
    expect(entries.map((e) => e.slug)).toEqual([
      'beschluss',
      'beschluss-2',
      'beschluss-3',
    ])
  })

  it('transliterates German umlauts to ASCII slugs', () => {
    const html = '<h1>Über die Hürde</h1><h2>Größere Pläne</h2>'
    const entries = extractToc(html)
    expect(entries.map((e) => e.slug)).toEqual([
      'ueber-die-huerde',
      'groessere-plaene',
    ])
  })
})

describe('injectHeadingIds', () => {
  it('adds matching ids to every heading', () => {
    const html = '<h1>Begrüßung</h1><h2>Anträge</h2><h2>Anträge</h2>'
    const out = injectHeadingIds(html)
    expect(out).toBe(
      '<h1 id="begruessung">Begrüßung</h1><h2 id="antraege">Anträge</h2><h2 id="antraege-2">Anträge</h2>',
    )
  })

  it('preserves the inner HTML of the heading', () => {
    const html = '<h2>Ein <strong>fett</strong> gedruckter Punkt</h2>'
    const out = injectHeadingIds(html)
    expect(out).toBe(
      '<h2 id="ein-fett-gedruckter-punkt">Ein <strong>fett</strong> gedruckter Punkt</h2>',
    )
  })

  it('passes through non-heading content unchanged', () => {
    const html = '<p>Kein Heading.</p><h1>Titel</h1>'
    const out = injectHeadingIds(html)
    expect(out).toBe('<p>Kein Heading.</p><h1 id="titel">Titel</h1>')
  })

  it('skips empty headings without shifting later ids', () => {
    // Regression: `extractToc` skips empty headings, so consuming a TOC
    // entry for them here used to assign every later id one heading
    // too early.
    const html = '<h1>Titel</h1><h2> </h2><h3><em></em></h3><h2>Zweiter</h2>'
    const out = injectHeadingIds(html)
    expect(out).toBe(
      '<h1 id="titel">Titel</h1><h2> </h2><h3><em></em></h3><h2 id="zweiter">Zweiter</h2>',
    )
  })
})

describe('buildPdfSections', () => {
  it('produces cover, TOC, agenda, and transcription sections', () => {
    const event = makeEvent({
      location: 'Vereinshaus',
      actual_attendees: [
        {
          id: 1,
          event_id: 1,
          user_id: null,
          name: 'Maria',
          sort_order: 0,
        },
      ],
      agenda_items: [
        makeAgendaItem({
          notes: 'Reparatur beauftragt',
          status: 'discussed',
        }),
      ],
    })
    const sections = buildPdfSections({
      event,
      transcriptionHtml: '<h1>Begrüßung</h1><p>Top, danke.</p><h2>Anträge</h2>',
    })

    expect(sections.cover.body).toContain('Gartentreffen Juni')
    expect(sections.cover.body).toContain('Maria')
    // The cover date is formatted for de-DE, not raw ISO.
    expect(sections.cover.body).toContain('15.06.2026')
    expect(sections.cover.body).not.toContain('2026-06-15')
    expect(sections.toc).toHaveLength(2)
    expect(sections.agenda.body).toContain('Wasserverteiler')
    expect(sections.agenda.body).toContain('✓')
    expect(sections.transcription.body).toContain(
      '<h1 id="begruessung">Begrüßung</h1>',
    )
  })

  it('emits an empty-state message for events without transcription', () => {
    const sections = buildPdfSections({
      event: makeEvent(),
      transcriptionHtml: '',
    })
    expect(sections.transcription.body).toContain('Kein Protokoll erfasst.')
    expect(sections.toc).toEqual([])
  })

  it('marks skipped agenda items with × and open items with ○', () => {
    const sections = buildPdfSections({
      event: makeEvent({
        agenda_items: [
          makeAgendaItem({ id: 1, title: 'Offen', status: 'open' }),
          makeAgendaItem({
            id: 2,
            title: 'Übersprungen',
            status: 'skipped',
            sort_order: 1,
          }),
        ],
      }),
      transcriptionHtml: '',
    })
    expect(sections.agenda.body).toContain('○')
    expect(sections.agenda.body).toContain('×')
  })
})

describe('buildPdfSections attachments', () => {
  const imageAtt = makeAttachment()
  const pdfAtt = makeAttachment({
    id: 12,
    agenda_item_id: 9,
    filename: 'rechnung.pdf',
    content_type: 'application/pdf',
    size: 1024 * 200,
    r2_key: 'events/1/rechnung.pdf',
    caption: 'Materialrechnung',
  })

  it('returns an empty body when there are no attachments', () => {
    const sections = buildPdfSections({
      event: makeEvent(),
      transcriptionHtml: '',
    })
    expect(sections.attachments.title).toBe('Anhänge')
    expect(sections.attachments.body).toBe('')
  })

  it('lists event-level and per-agenda attachments in order', () => {
    const sections = buildPdfSections({
      event: makeEvent({
        attachments: [imageAtt],
        agenda_items: [makeAgendaItem({ attachments: [pdfAtt] })],
      }),
      transcriptionHtml: '',
    })
    // Both groups rendered, event-level first
    const allMatches = sections.attachments.body.match(/<h3>/g) ?? []
    expect(allMatches).toHaveLength(2)
    const eventIndex = sections.attachments.body.indexOf('Allgemein')
    const agendaIndex = sections.attachments.body.indexOf('Wasserverteiler')
    expect(eventIndex).toBeGreaterThan(-1)
    expect(agendaIndex).toBeGreaterThan(eventIndex)
    expect(sections.attachments.body).toContain('Foto der Wasserleitung')
    expect(sections.attachments.body).toContain('Materialrechnung')
  })

  it('uses a data URL when the caller pre-fetches the image', () => {
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    const sections = buildPdfSections({
      event: makeEvent({ attachments: [imageAtt] }),
      transcriptionHtml: '',
      imageDataUrls: new Map([[imageAtt.id, dataUrl]]),
    })
    expect(sections.attachments.body).toContain(dataUrl)
    expect(sections.attachments.body).not.toContain('/api/admin/events/')
  })

  it('falls back to the same-origin download URL when no data URL is supplied', () => {
    const sections = buildPdfSections({
      event: makeEvent({ attachments: [imageAtt] }),
      transcriptionHtml: '',
    })
    expect(sections.attachments.body).toContain(
      `/api/admin/events/garten-juni/attachments/${imageAtt.id}/download`,
    )
  })

  it('renders a download link for non-image attachments', () => {
    const sections = buildPdfSections({
      event: makeEvent({ attachments: [pdfAtt] }),
      transcriptionHtml: '',
    })
    expect(sections.attachments.body).toContain('rechnung.pdf')
    expect(sections.attachments.body).toContain('PDF')
    // PDFs use the link to the auth-gated download endpoint.
    expect(sections.attachments.body).toContain(
      `/api/admin/events/garten-juni/attachments/${pdfAtt.id}/download`,
    )
  })
})

describe('buildPdfSections decisions', () => {
  const decisionWithVote = makeDecision({
    agenda_item_id: 9,
    proposer_user_id: 3,
    seconder_user_id: 4,
    vote_id: 42,
    proposer_display: 'Maria Hinkel',
    seconder_display: 'Tom S.',
    vote_snapshot: {
      id: 42,
      question: 'Anschaffung beschließen?',
      vote_type: 'yn' as const,
      counting_mode: 'per_attendee' as const,
      options: [
        { id: 100, vote_id: 42, label: 'Ja', count: 0, sort_order: 0 },
        { id: 101, vote_id: 42, label: 'Nein', count: 0, sort_order: 1 },
      ],
      attendee_votes: [
        { attendee_id: 1, option_id: null, response: true },
        { attendee_id: 2, option_id: null, response: true },
        { attendee_id: 3, option_id: null, response: false },
      ],
    },
  })
  const freeTextDecision = makeDecision({
    id: 2,
    resolution_number: 'B-2026-002',
    proposer_name: 'Oma (Gast)',
    seconder_name: 'Onkel Klaus',
    result_note: 'einstimmig angenommen',
    sort_order: 1,
  })

  it('returns an empty body when there are no decisions', () => {
    const sections = buildPdfSections({
      event: makeEvent(),
      transcriptionHtml: '',
    })
    expect(sections.decisions.title).toBe('Beschlüsse')
    expect(sections.decisions.body).toBe('')
  })

  it('renders the resolution number, wording, and proposer display', () => {
    const sections = buildPdfSections({
      event: makeEvent({ decisions: [freeTextDecision] }),
      transcriptionHtml: '',
    })
    expect(sections.decisions.body).toContain('B-2026-002')
    expect(sections.decisions.body).toContain('Anschaffung')
    expect(sections.decisions.body).toContain('Oma (Gast)')
    expect(sections.decisions.body).toContain('Onkel Klaus')
    expect(sections.decisions.body).toContain('einstimmig angenommen')
  })

  it('renders the linked vote tally using the snapshot', () => {
    const sections = buildPdfSections({
      event: makeEvent({ decisions: [decisionWithVote] }),
      transcriptionHtml: '',
    })
    expect(sections.decisions.body).toContain('Abstimmung:')
    // 2 ja, 1 nein from the per_attendee votes
    expect(sections.decisions.body).toContain('2 Stimmen')
    expect(sections.decisions.body).toContain('Mehrheit:')
    expect(sections.decisions.body).toContain('Maria Hinkel')
  })

  it('summarises the resolution numbers on the cover', () => {
    const sections = buildPdfSections({
      event: makeEvent({
        decisions: [decisionWithVote, freeTextDecision],
      }),
      transcriptionHtml: '',
    })
    expect(sections.cover.body).toContain('B-2026-001')
    expect(sections.cover.body).toContain('B-2026-002')
  })
})

describe('buildPdfSections tasks', () => {
  const openTask = makeTask({
    owner_user_id: 3,
    due_date: '2026-07-01',
    notes: 'Bitte vor dem nächsten Treffen erledigen.',
    owner_display: 'Maria Hinkel',
  })
  const carriedTask = makeTask({
    id: 2,
    title: 'Werkzeug aufräumen',
    sort_order: 1,
    carried_from_event_id: 1,
    carried_from_task_id: 99,
    is_carried_over: true,
  })
  const doneTask = makeTask({
    id: 3,
    title: 'Liste verschickt',
    status: 'done',
    sort_order: 2,
    completed_at: '2026-06-09T00:00:00.000Z',
  })

  it('returns an empty body when there are no tasks', () => {
    const sections = buildPdfSections({
      event: makeEvent(),
      transcriptionHtml: '',
    })
    expect(sections.tasks.title).toBe('Aufgaben')
    expect(sections.tasks.body).toBe('')
  })

  it('groups open and done tasks separately', () => {
    const sections = buildPdfSections({
      event: makeEvent({ tasks: [openTask, doneTask] }),
      transcriptionHtml: '',
    })
    expect(sections.tasks.body).toContain('Offen (1)')
    expect(sections.tasks.body).toContain('Erledigt (1)')
    expect(sections.tasks.body).toContain('Schlüssel bei Tom abholen')
    expect(sections.tasks.body).toContain('Liste verschickt')
  })

  it('renders owner and due date for each task', () => {
    const sections = buildPdfSections({
      event: makeEvent({ tasks: [openTask] }),
      transcriptionHtml: '',
    })
    expect(sections.tasks.body).toContain('Maria Hinkel')
    // Formatted in Europe/Vienna regardless of the host timezone.
    expect(sections.tasks.body).toContain('bis 01.07.2026')
  })

  it('marks carried-over tasks with a badge', () => {
    const sections = buildPdfSections({
      event: makeEvent({ tasks: [carriedTask] }),
      transcriptionHtml: '',
    })
    expect(sections.tasks.body).toContain('Werkzeug aufräumen')
    expect(sections.tasks.body).toContain('aus dem letzten Treffen')
  })

  it('shows task summary on the cover', () => {
    const sections = buildPdfSections({
      event: makeEvent({ tasks: [openTask, doneTask, carriedTask] }),
      transcriptionHtml: '',
    })
    // 2 open (openTask + carriedTask), 1 carried
    expect(sections.cover.body).toMatch(/Aufgaben.*1 aus dem letzten Treffen/)
  })
})

describe('buildPdfSections escaping', () => {
  it('escapes user-provided strings in attachments, decisions, and tasks', () => {
    const script = '<script>alert(1)</script>'
    const attribute = '"><img src=x onerror=alert(1)>'
    const sections = buildPdfSections({
      event: makeEvent({
        attachments: [
          makeAttachment({ filename: `${script}.jpg`, caption: attribute }),
        ],
        decisions: [makeDecision({ wording: script })],
        tasks: [makeTask({ title: script, notes: attribute })],
      }),
      transcriptionHtml: '',
    })
    for (const body of [
      sections.attachments.body,
      sections.decisions.body,
      sections.tasks.body,
    ]) {
      expect(body).not.toContain('<script>')
      expect(body).toContain('&lt;script&gt;')
    }
  })
})

describe('buildPrintDocument', () => {
  it('returns a self-contained HTML document', () => {
    const html = buildPrintDocument({
      event: makeEvent(),
      transcriptionHtml: '<h1>Titel</h1><p>Text</p>',
    })
    expect(html).toMatch(/^<!doctype html>/i)
    expect(html).toContain('Gartentreffen Juni')
    expect(html).toContain('<style>')
    expect(html).toContain('Inhalt')
    expect(html).toContain('id="titel"')
  })

  it('omits the TOC section when there are no headings', () => {
    const html = buildPrintDocument({
      event: makeEvent(),
      transcriptionHtml: '<p>Kein Heading.</p>',
    })
    expect(html).not.toContain('<section class="toc">')
  })

  it('renders the Anhänge, Beschlüsse, and Aufgaben sections when populated', () => {
    const html = buildPrintDocument({
      event: makeEvent({
        attachments: [makeAttachment()],
        decisions: [makeDecision()],
        tasks: [makeTask()],
      }),
      transcriptionHtml: '',
    })
    // Check the actual <section> tags rather than the CSS class names —
    // the inlined stylesheet contains the class names either way.
    expect(html).toContain('<section class="attachments-section">')
    expect(html).toContain('foto.jpg')
    expect(html).toContain('<section class="decisions-section">')
    expect(html).toContain('B-2026-001')
    expect(html).toContain('<section class="tasks-section">')
    expect(html).toContain('Schlüssel bei Tom abholen')
  })

  it('omits the optional sections when the event has no content for them', () => {
    const html = buildPrintDocument({
      event: makeEvent(),
      transcriptionHtml: '',
    })
    expect(html).not.toContain('<section class="attachments-section">')
    expect(html).not.toContain('<section class="decisions-section">')
    expect(html).not.toContain('<section class="tasks-section">')
  })
})
