/**
 * Renders `public/images/og-einladung.png` — the link-preview card for
 * invite links (`/einladung/:token`). Run manually after changing the
 * card copy or the brand:
 *
 *   node scripts/make-invite-og.mjs
 *
 * 1200×630 is the size WhatsApp, Signal and the other unfurlers crop to.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const WIDTH = 1200
const HEIGHT = 630

async function dataUri(path, mime) {
  const bytes = await readFile(resolve(path))
  return `data:${mime};base64,${bytes.toString('base64')}`
}

const [fraunces, inter, logo, garden] = await Promise.all([
  dataUri(
    'node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2',
    'font/woff2',
  ),
  dataUri(
    'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
    'font/woff2',
  ),
  dataUri('public/brand/logo.png', 'image/png'),
  dataUri('public/images/og.webp', 'image/webp'),
])

const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face {
        font-family: 'Fraunces';
        src: url('${fraunces}') format('woff2-variations');
        font-weight: 100 900;
      }
      @font-face {
        font-family: 'Inter';
        src: url('${inter}') format('woff2-variations');
        font-weight: 100 900;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: ${WIDTH}px;
        height: ${HEIGHT}px;
        display: flex;
        font-family: 'Inter', sans-serif;
        background: #f5f0e1;
        overflow: hidden;
      }
      .art {
        width: 420px;
        flex: none;
        background-image: url('${garden}');
        background-size: cover;
        background-position: 32% center;
        position: relative;
      }
      .art::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(
          100deg,
          rgba(31, 61, 43, 0.18) 0%,
          rgba(245, 240, 225, 0.1) 55%,
          #f5f0e1 100%
        );
      }
      .card {
        flex: 1;
        padding: 60px 64px 56px 40px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 22px;
      }
      .eyebrow {
        display: inline-flex;
        align-self: flex-start;
        align-items: center;
        gap: 10px;
        padding: 9px 20px;
        border-radius: 999px;
        background: #1f3d2b;
        color: #f5f0e1;
        font-size: 22px;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      h1 {
        font-family: 'Fraunces', Georgia, serif;
        font-weight: 600;
        font-size: 66px;
        line-height: 1.05;
        color: #1f3d2b;
        letter-spacing: -0.5px;
      }
      h1 span { color: #7a1f3d; }
      p.lead {
        font-size: 27px;
        line-height: 1.35;
        color: #2d5239;
        max-width: 21ch;
      }
      .steps {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .step {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        padding: 9px 18px;
        border-radius: 999px;
        background: rgba(122, 181, 46, 0.16);
        border: 2px solid rgba(45, 82, 57, 0.16);
        color: #2d5239;
        font-size: 21px;
        font-weight: 500;
      }
      .step b { color: #1f3d2b; }
      footer {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-top: 6px;
      }
      footer img { height: 74px; width: auto; mix-blend-mode: multiply; }
      footer div { line-height: 1.25; }
      .club {
        font-family: 'Fraunces', Georgia, serif;
        font-size: 27px;
        color: #1f3d2b;
      }
      .club-full { font-size: 17px; color: #2d5239; opacity: 0.75; }
    </style>
  </head>
  <body>
    <div class="art"></div>
    <div class="card">
      <span class="eyebrow">Persönliche Einladung</span>
      <h1>Dein Zugang zum <span>Mitgliederbereich</span></h1>
      <p class="lead">Link öffnen, Benutzernamen und Passwort festlegen – fertig.</p>
      <div class="steps">
        <span class="step"><b>1</b> Link öffnen</span>
        <span class="step"><b>2</b> Zugang einrichten</span>
        <span class="step"><b>3</b> Termine im Blick</span>
      </div>
      <footer>
        <img alt="" src="${logo}" />
        <div>
          <div class="club">Bewegung im Grünen</div>
          <div class="club-full">Sport- und Grünflächenpflegeverein · Jedlesee, Wien</div>
        </div>
      </footer>
    </div>
  </body>
</html>`

const browser = await chromium.launch()
try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  })
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  const png = await page.screenshot({ type: 'png' })
  const out = resolve('public/images/og-einladung.png')
  await writeFile(out, png)
  console.log(`✓ wrote ${out} (${WIDTH}×${HEIGHT})`)
} finally {
  await browser.close()
}
