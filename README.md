# SV Beet & Bewegung

<img src="public/brand/logo.png" alt="SV Beet & Bewegung Logo" width="180" />

Family calendar, date polling and doodle scheduling for two families and their shared garden in Floridsdorf, Vienna.

**Stack:** React 19 · Vite · TypeScript strict · Tailwind v4 · shadcn/ui · TanStack Router/Query/Form · Hono · Drizzle ORM · Cloudflare Pages + D1



## Development

```bash
pnpm install
cp .dev.vars.example .dev.vars   # local admin password + JWT secret
pnpm db:migrate:local            # apply Drizzle migrations to the local D1 SQLite
pnpm dev                         # http://localhost:5174 (Vite + Workers runtime + D1)
```

`pnpm dev` uses [`@cloudflare/vite-plugin`](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite-app/), which embeds the real Cloudflare Workers runtime directly inside the Vite dev server. The Hono API (Pages Functions) and the React frontend share the same port with full HMR and live D1 bindings — no separate wrangler process required. Local secrets live in `.dev.vars` (gitignored); production secrets are configured under **Pages → Settings → Environment variables** in the Cloudflare dashboard.

For schema changes:

```bash
pnpm db:generate       # emit a new migration into drizzle/
pnpm db:migrate:local  # apply it to the local DB
pnpm db:migrate:remote # apply it to the production D1
```

## Deployment

Production builds run on Cloudflare Pages via git integration. Set the Pages **Build command** to `pnpm build:cf`, which applies any pending D1 migrations to the remote database before producing the static bundle:

```bash
pnpm build:cf  # = pnpm db:migrate:remote && pnpm build
```

For `wrangler d1 migrations apply --remote` to succeed inside the Pages build container, add a **`CLOUDFLARE_API_TOKEN`** environment variable (Pages → Settings → Environment variables → Production) with a token scoped to *Account → D1 → Edit* and *Account → Cloudflare Pages → Edit*. Wrangler picks it up automatically.

## Quality

```bash
pnpm lint         # Biome
pnpm typecheck    # tsc --noEmit
pnpm test         # Vitest
pnpm knip         # dead-code check
pnpm pushcheck    # all four in one run
```
