import { describe, expect, it } from 'vitest'
import {
  applyLinkPreview,
  INVITE_PREVIEW,
  stripPrerenderedRoot,
} from './link-preview'

// The shape `index.html` has after the build + prerender step.
const SHELL = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <link rel="manifest" href="/icons/site.webmanifest" />
    <meta name="description" content="Landing-Beschreibung" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Bewegung im Grünen in Jedlesee" />
    <meta property="og:title" content="Bewegung im Grünen in Jedlesee" />
    <meta property="og:image" content="https://garten.hinkel.co/images/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Bewegung im Grünen in Jedlesee" />
    <title>Bewegung im Grünen in Jedlesee</title>
  </head>
  <body>
    <div id="root" data-prerendered="true"><div class="hero"><p>Landing</p></div></div>
    <script type="module" src="/assets/index.js"></script>
  </body>
</html>`

const URL_UNDER_TEST = 'https://garten.hinkel.co/einladung/abc123'

describe('applyLinkPreview', () => {
  const html = applyLinkPreview(SHELL, INVITE_PREVIEW, URL_UNDER_TEST)

  function contentOf(attr: string, key: string): string[] {
    const pattern = new RegExp(
      `<meta ${attr}="${key}" content="([^"]*)" />`,
      'g',
    )
    return [...html.matchAll(pattern)].map((m) => m[1] ?? '')
  }

  it('replaces the title with the invite title', () => {
    expect(html).toContain(`<title>${INVITE_PREVIEW.title}</title>`)
    expect(html).not.toContain('<title>Bewegung im Grünen in Jedlesee</title>')
  })

  it('sets exactly one og:title, og:description and description', () => {
    expect(contentOf('property', 'og:title')).toEqual([INVITE_PREVIEW.title])
    expect(contentOf('property', 'og:description')).toEqual([
      INVITE_PREVIEW.description,
    ])
    expect(contentOf('name', 'description')).toEqual([
      INVITE_PREVIEW.description,
    ])
  })

  it('drops the landing-page preview tags instead of keeping both', () => {
    expect(html).not.toContain('Landing-Beschreibung')
    expect(contentOf('property', 'og:image')).toEqual([
      'https://garten.hinkel.co/images/og-einladung.png',
    ])
  })

  it('makes the image URL absolute on the requested origin', () => {
    const local = applyLinkPreview(
      SHELL,
      INVITE_PREVIEW,
      'http://localhost:5199/einladung/abc123',
    )
    expect(local).toContain(
      '<meta property="og:image" content="http://localhost:5199/images/og-einladung.png" />',
    )
  })

  it('declares the card size so unfurlers render a large image', () => {
    expect(contentOf('property', 'og:image:width')).toEqual(['1200'])
    expect(contentOf('property', 'og:image:height')).toEqual(['630'])
    expect(contentOf('name', 'twitter:card')).toEqual(['summary_large_image'])
  })

  it('points og:url at the shared link', () => {
    expect(contentOf('property', 'og:url')).toEqual([URL_UNDER_TEST])
  })

  it('keeps the tags it does not own', () => {
    expect(html).toContain('<meta charset="UTF-8" />')
    expect(html).toContain(
      '<link rel="manifest" href="/icons/site.webmanifest" />',
    )
  })

  it('escapes quotes and ampersands in the copy', () => {
    const escaped = applyLinkPreview(
      SHELL,
      { ...INVITE_PREVIEW, title: 'Beet & "Bewegung"' },
      URL_UNDER_TEST,
    )
    expect(escaped).toContain(
      '<meta property="og:title" content="Beet &amp; &quot;Bewegung&quot;" />',
    )
  })

  it('leaves markup without a head untouched', () => {
    expect(
      applyLinkPreview('<p>kein Kopf</p>', INVITE_PREVIEW, URL_UNDER_TEST),
    ).toBe('<p>kein Kopf</p>')
  })
})

describe('stripPrerenderedRoot', () => {
  it('empties the root and drops the hydration marker', () => {
    const html = stripPrerenderedRoot(SHELL)
    expect(html).toContain('<div id="root"></div>')
    expect(html).not.toContain('data-prerendered')
    expect(html).not.toContain('<div class="hero">')
  })

  it('leaves the head alone', () => {
    expect(stripPrerenderedRoot(SHELL)).toContain(
      '<meta name="description" content="Landing-Beschreibung" />',
    )
  })

  it('keeps the module script that boots the app', () => {
    expect(stripPrerenderedRoot(SHELL)).toContain(
      '<script type="module" src="/assets/index.js"></script>',
    )
  })

  it('is a no-op without a root element', () => {
    expect(stripPrerenderedRoot('<body></body>')).toBe('<body></body>')
  })

  it('strips a built shell whose entry script sits in the head', () => {
    // Vite hoists the bundled module script into <head>, so nothing
    // recognizable follows the root element.
    const built =
      '<html><head><script type="module" crossorigin src="/assets/index-a1b2.js"></script></head>' +
      '<body><div id="root" data-prerendered="true"><div><section><div>tief</div></section></div></div></body></html>'
    expect(stripPrerenderedRoot(built)).toBe(
      '<html><head><script type="module" crossorigin src="/assets/index-a1b2.js"></script></head>' +
        '<body><div id="root"></div></body></html>',
    )
  })

  it('keeps markup that follows the root element', () => {
    const html =
      '<div id="root" data-prerendered="true"><div>a</div></div><footer>bleibt</footer>'
    expect(stripPrerenderedRoot(html)).toBe(
      '<div id="root"></div><footer>bleibt</footer>',
    )
  })

  it('is a no-op when the root element is never closed', () => {
    const broken = '<div id="root" data-prerendered="true"><div>a</div>'
    expect(stripPrerenderedRoot(broken)).toBe(broken)
  })
})
