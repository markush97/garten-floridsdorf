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
    agenda_items: [],
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
        {
          id: 9,
          event_id: 1,
          title: 'Wasserverteiler',
          notes: 'Reparatur beauftragt',
          status: 'discussed',
          sort_order: 0,
          votes: [],
          attachments: [],
        },
      ],
    })
    const sections = buildPdfSections({
      event,
      transcriptionHtml: '<h1>Begrüßung</h1><p>Top, danke.</p><h2>Anträge</h2>',
    })

    expect(sections.cover.body).toContain('Gartentreffen Juni')
    expect(sections.cover.body).toContain('Maria')
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
          {
            id: 1,
            event_id: 1,
            title: 'Offen',
            notes: null,
            status: 'open',
            sort_order: 0,
            votes: [],
            attachments: [],
          },
          {
            id: 2,
            event_id: 1,
            title: 'Übersprungen',
            notes: null,
            status: 'skipped',
            sort_order: 1,
            votes: [],
            attachments: [],
          },
        ],
      }),
      transcriptionHtml: '',
    })
    expect(sections.agenda.body).toContain('○')
    expect(sections.agenda.body).toContain('×')
  })
})

describe('buildPdfSections attachments', () => {
  const imageAtt = {
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
  }
  const pdfAtt = {
    id: 12,
    event_id: 1,
    agenda_item_id: 9,
    filename: 'rechnung.pdf',
    content_type: 'application/pdf',
    size: 1024 * 200,
    r2_key: 'events/1/rechnung.pdf',
    caption: 'Materialrechnung',
    uploaded_by_user_id: null,
    created_at: '2026-06-10T00:00:00.000Z',
  }

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
        agenda_items: [
          {
            id: 9,
            event_id: 1,
            title: 'Wasserverteiler',
            notes: null,
            status: 'open',
            sort_order: 0,
            votes: [],
            attachments: [pdfAtt],
          },
        ],
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

  it('escapes filenames and captions to prevent HTML injection', () => {
    const evilAtt = {
      ...imageAtt,
      id: 99,
      filename: '<script>alert(1)</script>.jpg',
      caption: '"><img src=x onerror=alert(1)>',
    }
    const sections = buildPdfSections({
      event: makeEvent({ attachments: [evilAtt] }),
      transcriptionHtml: '',
    })
    expect(sections.attachments.body).not.toContain('<script>')
    expect(sections.attachments.body).toContain('&lt;script&gt;')
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

  it('renders an Anhänge section when the event has attachments', () => {
    const event = makeEvent({
      attachments: [
        {
          id: 11,
          event_id: 1,
          agenda_item_id: null,
          filename: 'foto.jpg',
          content_type: 'image/jpeg',
          size: 1024,
          r2_key: 'k',
          caption: 'Foto',
          uploaded_by_user_id: null,
          created_at: '2026-06-10T00:00:00.000Z',
        },
      ],
    })
    const html = buildPrintDocument({ event, transcriptionHtml: '' })
    expect(html).toContain('attachments-section')
    expect(html).toContain('Anhänge')
    expect(html).toContain('Allgemein')
    expect(html).toContain('foto.jpg')
  })

  it('omits the Anhänge section when there are no attachments', () => {
    const html = buildPrintDocument({
      event: makeEvent(),
      transcriptionHtml: '',
    })
    // The CSS rule `.attachments-section h2` lives in the stylesheet;
    // we check for the actual <section> tag instead so the assertion
    // doesn't get tripped up by the stylesheet copy.
    expect(html).not.toContain('<section class="attachments-section">')
  })
})
