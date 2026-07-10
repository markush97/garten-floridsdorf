---
name: verify
description: Build, launch, and drive this app to verify a change end-to-end.
---

# Verifying changes in garten-floridsdorf

Vite + React (TanStack Router) frontend with a Cloudflare Worker API
(`@cloudflare/vite-plugin`), D1 via drizzle. `pnpm dev` serves both the
SPA and the `/api/*` worker routes on one port.

## Launch

```bash
pnpm dev --port 5199 --strictPort   # run in background; ready in ~3s
curl -s -o /dev/null -w "%{http_code}" http://localhost:5199/   # → 200
```

The local D1 database is usually empty/unseeded, so pages that need
API data won't have real tokens/records.

## Drive (Playwright, no test runner needed)

`playwright` is a devDependency but scripts outside the repo can't
resolve it by name — import it by absolute path:

```js
import { chromium } from 'file:///home/mhiadmin/projects/garten-floridsdorf/node_modules/playwright/index.mjs'
```

For token-gated public pages (`/dokumente/:token`, `/termine/:slug/:token`,
`/abstimmung/:slug[/:token]`), mock the API with `page.route('**/api/**', ...)`
and fulfill with a payload matching the zod schemas in
`functions/contracts/*.ts` — no DB seeding required. Fulfilling with a
non-OK status renders the pages' "Share-Link nicht mehr gültig" state.

Screenshot at 1920×1080 for desktop plus 390×844 for mobile; the public
pages share the landing-page layout (max-w-[1180px] container, rounded
Footer card pinned to viewport bottom via flex column + flex-1 main).

## Gotchas

- Playwright's `webServer` in playwright.config.ts expects
  `wrangler pages dev` on :8788 — for quick verification, plain
  `pnpm dev` + a standalone node script is faster.
- Biome warns `max-w-[1180px]` → `max-w-295`, but the arbitrary-value
  form is the established convention across the codebase.
