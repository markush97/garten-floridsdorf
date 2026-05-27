# SV Beet & Bewegung

<img src="public/brand/logo.png" alt="SV Beet & Bewegung Logo" width="180" />

Family calendar, date polling and doodle scheduling for two families and their shared garden in Floridsdorf, Vienna.

**Stack:** React 19 · Vite · TypeScript strict · Tailwind v4 · shadcn/ui · TanStack Router/Query/Form · Hono · Drizzle ORM · Cloudflare Workers + Workers Assets + D1



## Development

```bash
pnpm install
cp .dev.vars.example .dev.vars   # local admin password + JWT secret
pnpm db:migrate:local            # apply Drizzle migrations to the local D1 SQLite
pnpm dev                         # Vite + real Workers runtime + D1 on a local port
```

`pnpm dev` uses [`@cloudflare/vite-plugin`](https://developers.cloudflare.com/workers/vite-plugin/), which embeds the real Cloudflare Workers runtime directly inside the Vite dev server. The Hono API (`worker/index.ts`) and the React SPA share the same port with full HMR and live D1 bindings — no separate `wrangler` process required. Local secrets live in `.dev.vars` (gitignored); production secrets are configured under **Workers & Pages → Settings → Variables and Secrets** in the Cloudflare dashboard.

For schema changes:

```bash
pnpm db:generate       # emit a new migration into drizzle/
pnpm db:migrate:local  # apply it to the local DB
pnpm db:migrate:remote # apply it to the production D1
```

## Deployment

This project deploys as a single **Cloudflare Worker** with [Workers Assets](https://developers.cloudflare.com/workers/static-assets/) serving the SPA and `run_worker_first = ["/api/*"]` routing API traffic to the Hono worker.

Deploy from a local checkout:

```bash
wrangler login
pnpm deploy           # = pnpm db:migrate:remote && pnpm build && wrangler deploy
```

For CI-driven deploys, use [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) (Cloudflare dashboard → Workers & Pages → Create → Import a repository). Add a **`CLOUDFLARE_API_TOKEN`** build env var with a token scoped to *Account → D1 → Edit* and *Account → Workers Scripts → Edit* so `pnpm db:migrate:remote` succeeds before the build.


## Quality

```bash
pnpm lint         # Biome
pnpm typecheck    # tsc --noEmit
pnpm test         # Vitest
pnpm knip         # dead-code check
pnpm pushcheck    # all four in one run
```
