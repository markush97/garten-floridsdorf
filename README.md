# SV Beet & Bewegung

<img src="public/logo.png" alt="SV Beet & Bewegung Logo" width="180" />

Family calendar, date polling and doodle scheduling for two families and their shared garden in Floridsdorf, Vienna.

**Stack:** React 19 · Vite · TypeScript strict · Tailwind v4 · shadcn/ui · TanStack Router/Query/Form · Hono · Drizzle ORM · Cloudflare Pages + D1



## Development

```bash
pnpm install
pnpm dev          # http://localhost:5174
```

`pnpm dev` uses [`@cloudflare/vite-plugin`](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite-app/), which embeds the real Cloudflare Workers runtime directly inside the Vite dev server. The Hono API (Pages Functions) and the React frontend share the same port with full HMR and live D1 bindings — no separate wrangler process required.

## Quality

```bash
pnpm lint         # Biome
pnpm typecheck    # tsc --noEmit
pnpm test         # Vitest
pnpm knip         # dead-code check
pnpm pushcheck    # all four in one run
```
