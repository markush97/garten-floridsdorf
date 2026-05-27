import { createReadStream } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { chromium } from 'playwright'

const distDir = resolve('dist')
const indexPath = join(distDir, 'index.html')
const port = 4567

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://x')
    let pathname = decodeURIComponent(url.pathname)
    if (pathname.endsWith('/')) pathname += 'index.html'
    const filePath = normalize(join(distDir, pathname))
    if (!filePath.startsWith(distDir + sep) && filePath !== distDir) {
      res.statusCode = 403
      return res.end('Forbidden')
    }
    try {
      await stat(filePath)
    } catch {
      // SPA fallback
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      createReadStream(indexPath).pipe(res)
      return
    }
    res.setHeader(
      'Content-Type',
      mime[extname(filePath)] ?? 'application/octet-stream',
    )
    createReadStream(filePath).pipe(res)
  } catch (err) {
    res.statusCode = 500
    res.end(String(err))
  }
})

await new Promise((res) => server.listen(port, '127.0.0.1', res))

let browser
try {
  browser = await chromium.launch().catch((err) => {
    if (String(err).includes("Executable doesn't exist")) {
      console.warn(
        '⚠  Chromium not found – skipping prerender (no browsers installed).',
      )
      return null
    }
    throw err
  })
  if (!browser) {
    server.close()
    process.exit(0)
  }
  const page = await browser.newPage()
  page.on('pageerror', (err) => console.error('[prerender pageerror]', err))
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[prerender console]', msg.text())
  })

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' })
  // Give React a tick to mount + IntersectionObserver to fire on in-view items.
  await page.waitForFunction(
    () => document.getElementById('root')?.children.length > 0,
    null,
    { timeout: 10_000 },
  )
  await page.waitForTimeout(500)

  const rootHtml = await page.evaluate(() => {
    const root = document.getElementById('root')
    if (!root) throw new Error('Root element missing in built page.')
    return root.innerHTML
  })

  const template = await readFile(indexPath, 'utf8')
  if (!template.includes('<div id="root"></div>')) {
    throw new Error(
      'Expected <div id="root"></div> placeholder in dist/index.html',
    )
  }
  const next = template.replace(
    '<div id="root"></div>',
    `<div id="root" data-prerendered="true">${rootHtml}</div>`,
  )
  await writeFile(indexPath, next, 'utf8')
  console.log(`\u2713 pre-rendered / into ${indexPath}`)
} finally {
  if (browser) await browser.close()
  await new Promise((res) => server.close(res))
}
