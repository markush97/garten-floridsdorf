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
          },
          {
            id: 2,
            event_id: 1,
            title: 'Übersprungen',
            notes: null,
            status: 'skipped',
            sort_order: 1,
            votes: [],
          },
        ],
      }),
      transcriptionHtml: '',
    })
    expect(sections.agenda.body).toContain('○')
    expect(sections.agenda.body).toContain('×')
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
})
