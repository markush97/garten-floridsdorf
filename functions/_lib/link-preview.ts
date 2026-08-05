/**
 * Per-route link previews (Open Graph / Twitter cards).
 *
 * The app is a single-page app: every route is served the same built
 * `index.html`, so every shared link unfurls with the landing page's
 * generic preview. Chat apps never run our JavaScript, so the tags
 * have to be right in the served HTML — the worker rewrites the head
 * for the routes that need their own preview (see `worker/index.ts`).
 *
 * Pure string functions, no Workers APIs, so the rewriting is
 * unit-testable.
 */

export type LinkPreview = {
  title: string
  description: string
  /** Absolute path of a 1200×630 card inside `public/`. */
  imagePath: string
  imageAlt: string
}

/** The short official name, used across the previews. */
const CLUB_NAME = 'Bewegung im Grünen in Jedlesee'

/**
 * Preview for a personal invite link. Deliberately free of personal
 * data: whoever renders the preview (WhatsApp's servers, everyone in
 * a group chat the link is forwarded to) is not necessarily the
 * invited person. It only has to answer "what does this link do?".
 */
export const INVITE_PREVIEW: LinkPreview = {
  title: `Einladung: Dein Zugang zum Mitgliederbereich – ${CLUB_NAME}`,
  description:
    'Persönlicher Einladungslink: Zugang einrichten – Benutzernamen und Passwort festlegen. Danach hast du Termine, Kalender, Aufgaben und Unterlagen im Blick.',
  imagePath: '/images/og-einladung.png',
  imageAlt: `Einladung in den Mitgliederbereich von ${CLUB_NAME}`,
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Every tag the preview owns — removed before the fresh block is
// inserted, so the landing-page defaults can't linger next to it.
const OWNED_TAGS =
  /[^\S\n]*<meta\s+(?:property="og:[a-z:_]+"|name="(?:description|twitter:[a-z:_]+)")[^>]*>\n?/g
const TITLE_TAG = /[^\S\n]*<title>[\s\S]*?<\/title>\n?/

/**
 * Replaces the preview tags in a built `index.html` head. `pageUrl` is
 * the canonical URL of the page being served and supplies the origin
 * for the (absolute) image URL that unfurlers require.
 */
export function applyLinkPreview(
  html: string,
  preview: LinkPreview,
  pageUrl: string,
): string {
  const headEnd = html.indexOf('</head>')
  if (headEnd === -1) return html

  const url = new URL(pageUrl)
  const imageUrl = new URL(preview.imagePath, url.origin).toString()
  const head = html
    .slice(0, headEnd)
    .replace(OWNED_TAGS, '')
    .replace(TITLE_TAG, '')

  const attr = escapeAttribute
  const tags = [
    `<title>${attr(preview.title)}</title>`,
    `<meta name="description" content="${attr(preview.description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${attr(CLUB_NAME)}" />`,
    `<meta property="og:locale" content="de_AT" />`,
    `<meta property="og:title" content="${attr(preview.title)}" />`,
    `<meta property="og:description" content="${attr(preview.description)}" />`,
    `<meta property="og:url" content="${attr(url.toString())}" />`,
    `<meta property="og:image" content="${attr(imageUrl)}" />`,
    `<meta property="og:image:secure_url" content="${attr(imageUrl)}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${attr(preview.imageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${attr(preview.title)}" />`,
    `<meta name="twitter:description" content="${attr(preview.description)}" />`,
    `<meta name="twitter:image" content="${attr(imageUrl)}" />`,
    `<meta name="twitter:image:alt" content="${attr(preview.imageAlt)}" />`,
  ]
    .map((tag) => `    ${tag}`)
    .join('\n')

  return `${head}${tags}\n  ${html.slice(headEnd)}`
}

/**
 * Empties the root element, dropping the pre-rendered landing page.
 * `scripts/prerender.mjs` bakes the landing page into `index.html` and
 * marks it `data-prerendered`, which makes the client hydrate it — on
 * any other route that means a flash of the landing page before the
 * router swaps in the real one. Without the marker the client mounts
 * from scratch instead.
 *
 * The closing tag is found by counting `div` nesting, so it does not
 * matter what surrounds the root element (the bundled entry script
 * sits before it in a built `index.html`, after it in the dev shell).
 */
export function stripPrerenderedRoot(html: string): string {
  const rootAt = html.indexOf('<div id="root"')
  if (rootAt === -1) return html
  const openTagEnd = html.indexOf('>', rootAt)
  if (openTagEnd === -1) return html

  const divTags = /<(\/?)div\b/gi
  divTags.lastIndex = openTagEnd + 1
  let depth = 1
  for (let tag = divTags.exec(html); tag; tag = divTags.exec(html)) {
    depth += tag[1] === '/' ? -1 : 1
    if (depth > 0) continue
    const closeTagEnd = html.indexOf('>', tag.index)
    if (closeTagEnd === -1) return html
    return `${html.slice(0, rootAt)}<div id="root"></div>${html.slice(closeTagEnd + 1)}`
  }
  return html
}
