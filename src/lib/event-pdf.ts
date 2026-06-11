import type { EventWithDetails } from '~func/contracts/event'
import { summarizeVote } from './event-helpers'

/**
 * A single entry in the auto-generated table of contents. `level` is
 * 1 (H1), 2 (H2) or 3 (H3); `slug` is the stable anchor id we'll add to
 * the heading in the source HTML so the PDF can deep-link to it.
 */
export type TocEntry = {
  level: 1 | 2 | 3
  text: string
  slug: string
}

// Tiptap emits `<h1>…</h1>` and we also add `id="…"` attributes via
// `injectHeadingIds`, so the opening tag may carry attributes. The
// `[^>]*` allows any attribute soup while still keeping the regex
// greedy-safe via the `[\s\S]*?` non-greedy body. Deeper levels aren't
// produced by the editor toolbar.
const HEADING_RE = /<h([1-3])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/gi

/**
 * Extract a flat TOC from a Tiptap HTML string. Whitespace and any inline
 * tags inside the heading are stripped from the displayed text, but the
 * raw text content is preserved in the slug for human-readable anchors.
 */
export function extractToc(html: string): TocEntry[] {
  const entries: TocEntry[] = []
  if (!html) return entries
  HEADING_RE.lastIndex = 0
  const seen = new Map<string, number>()
  // Use a manual re-match loop to avoid Biome's "no assignment in
  // expression" rule. `RegExp.prototype.exec` advances `lastIndex` on
  // each call when the regex carries the `g` flag.
  let match = HEADING_RE.exec(html)
  while (match !== null) {
    const level = Number(match[1]) as 1 | 2 | 3
    const raw = match[2] ?? ''
    const text = stripTags(raw).trim()
    if (text.length > 0) {
      const base = slugifyHeading(text)
      const seenCount = seen.get(base) ?? 0
      seen.set(base, seenCount + 1)
      const slug = seenCount === 0 ? base : `${base}-${seenCount + 1}`
      entries.push({ level, text, slug })
    }
    match = HEADING_RE.exec(html)
  }
  return entries
}

/**
 * Injects `id="…"` attributes on every heading in the source HTML so the
 * TOC anchors and the PDF view line up. Returns a new string; the input
 * is not mutated. The order of headings is preserved and matches the
 * order returned by `extractToc`.
 */
export function injectHeadingIds(html: string): string {
  if (!html) return html
  const entries = extractToc(html)
  let i = 0
  return html.replace(HEADING_RE, (full, level: string, inner: string) => {
    const entry = entries[i++]
    if (!entry) return full
    return `<h${level} id="${entry.slug}">${inner}</h${level}>`
  })
}

/**
 * Generates a URL-friendly slug from heading text. We keep it ASCII-only
 * (German umlauts → ae/oe/ue/ss) so the anchor survives every PDF viewer
 * — some strip non-ASCII ids without warning.
 */
function slugifyHeading(text: string): string {
  const UMLAUT_MAP: Record<string, string> = {
    ä: 'ae',
    ö: 'oe',
    ü: 'ue',
    Ä: 'ae',
    Ö: 'oe',
    Ü: 'ue',
    ß: 'ss',
  }
  return text
    .replace(/[äöüÄÖÜß]/g, (c) => UMLAUT_MAP[c] ?? c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, '')
}

export type PrintSection = {
  title: string
  body: string
}

/**
 * Builds the agenda section of the PDF/print view. We pull the agenda
 * items straight from the event payload (not from the editor's
 * transcription) so the user gets the full structured meeting outline,
 * including per-item status and any votes. The transcriber's free-form
 * notes go in the body.
 */
export function buildAgendaSection(event: EventWithDetails): PrintSection {
  const items = [...event.agenda_items].sort(
    (a, b) => a.sort_order - b.sort_order,
  )
  if (items.length === 0) return { title: 'Tagesordnung', body: '' }

  const lines: string[] = []
  for (const item of items) {
    const status =
      item.status === 'discussed' ? '✓' : item.status === 'skipped' ? '×' : '○'
    lines.push(
      `<li class="agenda-item"><span class="agenda-marker">${status}</span><span class="agenda-title">${escapeHtml(item.title)}</span>${item.notes ? `<p class="agenda-notes">${escapeHtml(item.notes)}</p>` : ''}</li>`,
    )
  }
  return {
    title: 'Tagesordnung',
    body: `<ol class="agenda">${lines.join('')}</ol>`,
  }
}

/**
 * Escapes user-provided strings before inlining them into HTML. The
 * server already returns plain text for `notes` / `title` / `location`,
 * but a future caller could pass unsanitised data; this keeps the PDF
 * renderer safe.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export type PdfContext = {
  event: EventWithDetails
  /** Optional override: when the user is editing, we render the in-memory
   *  HTML (not yet saved). Falling back to the persisted value. */
  transcriptionHtml: string
  /**
   * If supplied, images are embedded inline in the PDF preview as
   * data URLs. The print iframe shares cookies with the parent so it
   * can fetch the auth-gated download URLs directly — but some
   * browsers / extensions block that, so callers can pre-fetch and
   * pass in a map for a guaranteed render.
   */
  imageDataUrls?: Map<number, string>
}

/**
 * Returns the data needed to render the print/PDF view: a title, a list
 * of sections (cover, TOC, agenda, decisions, attachments, transcription),
 * and a flat TOC.
 */
export function buildPdfSections(ctx: PdfContext): {
  cover: PrintSection
  toc: TocEntry[]
  agenda: PrintSection
  decisions: PrintSection
  attachments: PrintSection
  transcription: PrintSection
} {
  const event = ctx.event
  const transcriptionHtml = injectHeadingIds(ctx.transcriptionHtml)

  const coverLines: string[] = []
  coverLines.push(`<h1 class="cover-title">${escapeHtml(event.title)}</h1>`)
  const meta: string[] = []
  meta.push(
    `<dt>Datum</dt><dd>${escapeHtml(event.scheduled_date)}${event.scheduled_time ? ` · ${escapeHtml(event.scheduled_time)} Uhr` : ''}</dd>`,
  )
  if (event.location) {
    meta.push(`<dt>Ort</dt><dd>${escapeHtml(event.location)}</dd>`)
  }
  if (event.actual_attendees.length > 0) {
    const names = event.actual_attendees
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((a) => escapeHtml(a.name))
      .join(', ')
    meta.push(`<dt>Anwesende</dt><dd>${names}</dd>`)
  }
  if (event.planned_attendees.length > 0) {
    const names = event.planned_attendees
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((a) => escapeHtml(a.name))
      .join(', ')
    meta.push(`<dt>Geplant</dt><dd>${names}</dd>`)
  }
  if (event.decisions.length > 0) {
    const numbers = event.decisions
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .map((d) => escapeHtml(d.resolution_number))
      .join(', ')
    meta.push(`<dt>Beschlüsse</dt><dd>${numbers}</dd>`)
  }
  const coverBody = `${coverLines.join('')}<dl class="cover-meta">${meta.join('')}</dl>`

  return {
    cover: { title: 'Termin', body: coverBody },
    toc: extractToc(transcriptionHtml),
    agenda: buildAgendaSection(event),
    decisions: buildDecisionsSection(event),
    attachments: buildAttachmentsSection(event, ctx.imageDataUrls),
    transcription: {
      title: 'Protokoll',
      body: transcriptionHtml || '<p class="empty">Kein Protokoll erfasst.</p>',
    },
  }
}

/**
 * Renders the formal "Beschlüsse" section. Each decision shows its
 * resolution number, the exact wording, the proposer / seconder
 * (using the server-computed display strings so the PDF doesn't need
 * a users join), the linked vote tally when one is set, and the
 * optional result note. The section is omitted entirely when the
 * event has no decisions so the cover summary doesn't get a "0"
 * counter.
 */
function buildDecisionsSection(event: EventWithDetails): PrintSection {
  const decisions = [...event.decisions].sort(
    (a, b) => a.sort_order - b.sort_order || a.id - b.id,
  )
  if (decisions.length === 0) return { title: 'Beschlüsse', body: '' }

  const items = decisions.map((d) => {
    const proposer = d.proposer_display ?? d.proposer_name
    const seconder = d.seconder_display ?? d.seconder_name
    const tally = d.vote_snapshot
      ? summarizeVote(d.vote_snapshot, d.vote_snapshot.attendee_votes)
      : null
    const tallyHtml =
      tally && d.vote_snapshot
        ? renderDecisionTally(d.vote_snapshot.question, tally)
        : ''
    return `<article class="decision">
      <header class="decision-head">
        <span class="decision-number">${escapeHtml(d.resolution_number)}</span>
      </header>
      <p class="decision-wording">${escapeHtml(d.wording)}</p>
      <dl class="decision-meta">
        <dt>Antragsteller:in</dt><dd>${escapeHtml(proposer ?? '–')}</dd>
        <dt>Zweite Person</dt><dd>${escapeHtml(seconder ?? '–')}</dd>
      </dl>
      ${tallyHtml}
      ${d.result_note ? `<p class="decision-note">${escapeHtml(d.result_note)}</p>` : ''}
    </article>`
  })

  return {
    title: 'Beschlüsse',
    body: `<div class="decisions-list">${items.join('')}</div>`,
  }
}

/**
 * Renders the inline vote tally for a decision. Reuses `summarizeVote`
 * from `event-helpers` so the per-decision tallies match the
 * editor's read view exactly.
 */
function renderDecisionTally(
  question: string,
  tally: ReturnType<typeof summarizeVote>,
): string {
  if (tally.totalCount === 0) {
    return `<p class="decision-tally-empty">Abstimmung noch nicht ausgezählt.</p>`
  }
  const tallyLines = tally.tallies
    .map(
      (t) =>
        `<li><span class="tally-label">${escapeHtml(t.option.label)}</span><span class="tally-count">${t.count}</span></li>`,
    )
    .join('')
  const leading = tally.leadingLabel
    ? `<p class="decision-tally-leader">Mehrheit: <strong>${escapeHtml(tally.leadingLabel)}</strong> (${tally.leadingCount} Stimmen)</p>`
    : `<p class="decision-tally-leader">Stimmengleichstand (${tally.leadingCount} : ${tally.leadingCount}).</p>`
  return `<div class="decision-tally">
    <p class="decision-tally-question">Abstimmung: ${escapeHtml(question)}</p>
    <ul class="tally">${tallyLines}</ul>
    ${leading}
  </div>`
}

/**
 * Renders the "Anhänge" section. We list attachments in two groups —
 * the event-level ones first, then per-agenda-item — so the reader
 * sees them in the same order the admin uploaded them. Image
 * attachments get an inline `<img>` (data URL if provided, otherwise a
 * same-origin URL the iframe can fetch); everything else is a link
 * with the filename and size.
 */
function buildAttachmentsSection(
  event: EventWithDetails,
  imageDataUrls?: Map<number, string>,
): PrintSection {
  const eventLevel = event.attachments
  const perAgenda = event.agenda_items
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      item,
      attachments: item.attachments,
    }))
    .filter((g) => g.attachments.length > 0)

  const hasAny = eventLevel.length > 0 || perAgenda.length > 0
  if (!hasAny) return { title: 'Anhänge', body: '' }

  const groups: string[] = []
  if (eventLevel.length > 0) {
    groups.push(
      `<h3>Allgemein</h3><ul class="attachments-list">${renderAttachmentList(
        eventLevel,
        event.slug,
        imageDataUrls,
      )}</ul>`,
    )
  }
  for (const { item, attachments } of perAgenda) {
    groups.push(
      `<h3>${escapeHtml(item.title)}</h3><ul class="attachments-list">${renderAttachmentList(
        attachments,
        event.slug,
        imageDataUrls,
      )}</ul>`,
    )
  }
  return { title: 'Anhänge', body: groups.join('') }
}

function renderAttachmentList(
  attachments: EventWithDetails['attachments'],
  eventSlug: string,
  imageDataUrls?: Map<number, string>,
): string {
  return attachments
    .map((att) => {
      const isImage = att.content_type.startsWith('image/')
      const dataUrl = imageDataUrls?.get(att.id)
      const url = dataUrl
        ? dataUrl
        : `/api/admin/events/${eventSlug}/attachments/${att.id}/download`
      const caption = att.caption
        ? `<p class="attachment-caption">${escapeHtml(att.caption)}</p>`
        : ''
      const size = ` (${formatBytes(att.size)})`
      if (isImage) {
        return `<li class="attachment attachment-image"><img alt="${escapeHtml(att.caption ?? att.filename)}" src="${url}" /><p class="attachment-meta">${escapeHtml(att.filename)}${size}</p>${caption}</li>`
      }
      return `<li class="attachment attachment-file"><a href="${url}">${escapeHtml(att.filename)}</a><span class="attachment-meta">${size}${att.content_type === 'application/pdf' ? ' · PDF' : ''}</span>${caption}</li>`
    })
    .join('')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Renders the full HTML document used for the print preview and the
 * standalone download. It is intentionally self-contained (inlines the
 * print stylesheet) so it renders identically when opened from disk.
 */
export function buildPrintDocument(ctx: PdfContext): string {
  const sections = buildPdfSections(ctx)
  const event = ctx.event
  const tocHtml = renderToc(sections.toc)
  const decisionsHtml = sections.decisions.body
    ? `<section class="decisions-section">
        <h2>${escapeHtml(sections.decisions.title)}</h2>
        ${sections.decisions.body}
      </section>`
    : ''
  const attachmentsHtml = sections.attachments.body
    ? `<section class="attachments-section">
        <h2>${escapeHtml(sections.attachments.title)}</h2>
        ${sections.attachments.body}
      </section>`
    : ''

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(event.title)} – Protokoll</title>
    <style>${PRINT_STYLESHEET}</style>
  </head>
  <body>
    <article class="event-pdf-root">
      <header class="cover">
        <p class="cover-eyebrow">SV Beet &amp; Bewegung</p>
        ${sections.cover.body}
      </header>
      ${tocHtml ? `<section class="toc"><h2>Inhalt</h2><ol>${tocHtml}</ol></section>` : ''}
      <section class="agenda-section">
        <h2>${escapeHtml(sections.agenda.title)}</h2>
        ${sections.agenda.body}
      </section>
      ${decisionsHtml}
      ${attachmentsHtml}
      <section class="transcription">
        <h2>${escapeHtml(sections.transcription.title)}</h2>
        <div class="prose-content">${sections.transcription.body}</div>
      </section>
    </article>
  </body>
</html>`
}

function renderToc(entries: TocEntry[]): string {
  if (entries.length === 0) return ''
  return entries
    .map(
      (entry) =>
        `<li class="toc-level-${entry.level}"><a href="#${entry.slug}">${escapeHtml(entry.text)}</a></li>`,
    )
    .join('')
}

const PRINT_STYLESHEET = `
@page { size: A4; margin: 22mm 18mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; color: #1f3d2b; font-family: 'Inter', system-ui, sans-serif; line-height: 1.55; }
.event-pdf-root { max-width: 100%; }
.cover { border-bottom: 2px solid #1f3d2b; padding-bottom: 1.5rem; margin-bottom: 1.5rem; }
.cover-eyebrow { font-size: 0.7rem; letter-spacing: 0.24em; text-transform: uppercase; color: #2d5239; margin: 0 0 0.5rem; }
.cover-title { font-family: 'Fraunces', Georgia, serif; font-size: 2.2rem; line-height: 1.1; margin: 0 0 1rem; color: #1f3d2b; }
.cover-meta { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem; margin: 0; font-size: 0.95rem; }
.cover-meta dt { font-weight: 600; color: #2d5239; }
.cover-meta dd { margin: 0; }
.toc { page-break-after: always; padding: 1rem 0; border-bottom: 1px solid #c2b8a4; margin-bottom: 1.5rem; }
.toc h2 { font-family: 'Fraunces', Georgia, serif; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.18em; color: #1f3d2b; margin: 0 0 0.75rem; }
.toc ol { list-style: none; padding: 0; margin: 0; }
.toc li { padding: 0.2rem 0; }
.toc li.toc-level-1 { font-weight: 600; }
.toc li.toc-level-2 { padding-left: 1.2rem; }
.toc li.toc-level-3 { padding-left: 2.4rem; color: #2d5239; font-size: 0.92rem; }
.toc a { color: #1f3d2b; text-decoration: none; border-bottom: 1px dotted #c2b8a4; }
.agenda-section h2, .transcription h2 { font-family: 'Fraunces', Georgia, serif; font-size: 1.4rem; color: #1f3d2b; margin: 1.5rem 0 0.75rem; page-break-after: avoid; }
.agenda { list-style: none; padding: 0; margin: 0; }
.agenda-item { padding: 0.5rem 0; border-bottom: 1px solid #e7dfc9; page-break-inside: avoid; }
.agenda-marker { display: inline-block; width: 1.2rem; color: #2d5239; font-weight: 700; }
.agenda-title { font-weight: 600; }
.agenda-notes { margin: 0.25rem 0 0 1.2rem; color: #2d5239; font-size: 0.92rem; white-space: pre-line; }
.prose-content { font-size: 0.95rem; }
.prose-content h1, .prose-content h2, .sektion-h3 { font-family: 'Fraunces', Georgia, serif; color: #1f3d2b; page-break-after: avoid; }
.prose-content h1 { font-size: 1.3rem; margin: 1.5rem 0 0.5rem; }
.prose-content h2 { font-size: 1.1rem; margin: 1.2rem 0 0.4rem; }
.prose-content h3 { font-size: 1rem; margin: 1rem 0 0.3rem; }
.prose-content ul, .prose-content ol { margin: 0.4rem 0 0.4rem 1.4rem; }
.prose-content li { margin: 0.15rem 0; }
.prose-content .empty { color: #2d5239; font-style: italic; }
.attachments-section h2 { font-family: 'Fraunces', Georgia, serif; font-size: 1.4rem; color: #1f3d2b; margin: 1.5rem 0 0.5rem; page-break-after: avoid; }
.decisions-section h2 { font-family: 'Fraunces', Georgia, serif; font-size: 1.4rem; color: #1f3d2b; margin: 1.5rem 0 0.5rem; page-break-after: avoid; }
.decisions-list { display: flex; flex-direction: column; gap: 0.75rem; }
.decision { padding: 0.75rem 0; border-bottom: 1px solid #e7dfc9; page-break-inside: avoid; }
.decision:last-child { border-bottom: 0; }
.decision-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; }
.decision-number { display: inline-block; padding: 0.15rem 0.6rem; border-radius: 999px; background: #1f3d2b; color: #f5f0e1; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em; }
.decision-wording { white-space: pre-line; margin: 0.2rem 0 0.5rem; font-size: 0.95rem; }
.decision-meta { display: grid; grid-template-columns: max-content 1fr; gap: 0.2rem 0.75rem; margin: 0.25rem 0 0; font-size: 0.85rem; }
.decision-meta dt { font-weight: 600; color: #2d5239; }
.decision-meta dd { margin: 0; }
.decision-tally { margin-top: 0.5rem; padding: 0.5rem 0.75rem; background: #f5f0e1; border-radius: 0.5rem; font-size: 0.85rem; }
.decision-tally-question { font-weight: 600; margin: 0 0 0.4rem; }
.decision-tally .tally { list-style: none; padding: 0; margin: 0 0 0.4rem; display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; }
.decision-tally .tally li { display: inline-flex; align-items: baseline; gap: 0.25rem; }
.decision-tally .tally-label { color: #2d5239; }
.decision-tally .tally-count { font-weight: 700; }
.decision-tally-leader { margin: 0; }
.decision-tally-empty { margin: 0; font-style: italic; color: #2d5239; }
.decision-note { margin: 0.4rem 0 0; padding: 0.4rem 0.6rem; background: #f5f0e1; border-left: 3px solid #1f3d2b; font-size: 0.85rem; white-space: pre-line; }
.attachments-section h3 { font-family: 'Fraunces', Georgia, serif; font-size: 1.05rem; color: #1f3d2b; margin: 1rem 0 0.4rem; page-break-after: avoid; }
.attachments-list { list-style: none; padding: 0; margin: 0 0 0.5rem; }
.attachment { padding: 0.5rem 0; page-break-inside: avoid; }
.attachment-image img { display: block; max-width: 100%; max-height: 14cm; width: auto; height: auto; margin: 0.25rem 0 0.4rem; border-radius: 0.25rem; box-shadow: 0 2px 6px rgba(31, 61, 43, 0.12); }
.attachment-file a { color: #1f3d2b; text-decoration: none; border-bottom: 1px solid #c2b8a4; font-weight: 600; }
.attachment-meta { display: block; font-size: 0.8rem; color: #2d5239; margin-top: 0.2rem; }
.attachment-caption { font-size: 0.9rem; font-style: italic; color: #2d5239; margin: 0.2rem 0 0; }
@media print {
  .no-print { display: none !important; }
}
`
