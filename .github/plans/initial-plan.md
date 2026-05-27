# SV Beet & Bewegung – Implementierungsplan

> **Status:** v2 (genehmigt)
> **Domain (initial):** `garten.hinkel.co`
> **Hosting:** Cloudflare Pages + Pages Functions (Hono) + D1 (SQLite)

## TL;DR

React-SPA (Vite + Tailwind v4 + shadcn/ui + TanStack Router/Query/Form) deployed auf
**Cloudflare Pages**, mit **Pages Functions** (Hono) als API und **Cloudflare D1**
(SQLite) als DB. Zero-Cost im Free-Tier. Code-Qualitätsregeln stark angelehnt an das
EDS-Repository — minus Enterprise-Overhead. Landing im Logo-Stil (Forstgrün /
Burgund / Cream). Doodle: Admin (Passwort-geschützt) erstellt **genau eine aktive
Umfrage**, Familie antwortet via geteiltem Link mit Name + Ja/Nein/Vielleicht +
Kommentar; bestehende Antworten sind vor eigener Stimmabgabe sichtbar.

---

## Beantwortete Eckpunkte

| Frage | Entscheidung |
|---|---|
| Wie viele Umfragen gleichzeitig? | Genau **eine aktive** Umfrage. DB-Schema bleibt mehrpoll-fähig (Feld `is_active`), UI/Admin zeigt aber nur die aktive plus optionales Archiv. |
| Votes vor eigener Abgabe sichtbar? | **Ja** — klassisches Doodle-Verhalten, fördert Konsens. |
| SVG-Logo nachbauen? | **Ja**, in Phase 5 — Quellbild `public/icon.png`. |

## Vorhandene public (`/public/`)

- `logo.png` — vollständiges Crest (Footer, About-Sektion)
- `icon.png` — rundes Icon (Navbar, Favicon-Basis, OG-Image-Basis, SVG-Vorlage)
- `banner.png` — Hero-Banner

---

## Architektur-Überblick

```
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Pages (garten.hinkel.co)                    │
│                                                         │
│  /            → React SPA (Vite Build, statisch)        │
│    - Landing (Hero, About, Familien, aktive Umfrage)    │
│    - /poll/:id (Doodle-Antwort-Seite)                   │
│    - /admin (Passwort + Poll-Verwaltung)                │
│                                                         │
│  /api/*      → Pages Functions (Hono)                   │
│    - GET    /api/polls/active                           │
│    - GET    /api/polls/:id                              │
│    - POST   /api/polls/:id/votes                        │
│    - POST   /api/admin/login                            │
│    - GET    /api/admin/polls                            │
│    - POST   /api/admin/polls           (auto-aktiv)     │
│    - PATCH  /api/admin/polls/:id       (close, final)   │
│    - DELETE /api/admin/polls/:id                        │
│                                                         │
│  Bindings: D1 + Secrets (ADMIN_PASSWORD, JWT_SECRET)    │
└─────────────────────────────────────────────────────────┘
```

**Tech-Begründung:**
- **Vite + React SPA**: minimal, keine SSR-Komplexität.
- **TanStack Router**: file-based, auto-code-splitting, typsicher.
- **Hono**: Standard auf Cloudflare Pages Functions, < 20 kB.
- **D1**: native SQLite, free-tier deckt Familien-Bedarf weit ab.
- **Drizzle ORM + Drizzle Kit**: leichtgewichtig, D1-native, typsichere Queries und saubere Migrationen.
- **shadcn/ui**: kopieren-und-besitzen statt npm-Dependency.
- **Domain-Wechsel** = 2 Klicks in Cloudflare, keine Codeänderung.

---

## Adopted Quality Standards (aus EDS)

## Reuse from /monorepo (for later implementation)

The following sources are explicitly adopted into this project plan and should be applied during implementation:

- **Frontend visual direction** from `.agents/skills/frontend-design/SKILL.md`:
  distinctive, intentional landing page design with bold typography, cohesive palette, and purposeful motion.
- **Border restraint** from `.agents/skills/minimal-ui-borders/SKILL.md`:
  use spacing/contrast/hierarchy first; borders only when they improve clarity.
- **Accessibility and UI checklist** from `.agents/skills/patholux-frontend/rules/ui-quality.md`:
  icon-only buttons require German `aria-label`; semantic controls; robust `:focus-visible`; proper labels.
- **React performance/correctness patterns** from `.agents/skills/patholux-frontend/rules/performance.md`:
  derive state in render, functional state updates, explicit ternaries over `&&`, immutable array helpers.
- **Component API composition rules** from `.agents/skills/vercel-composition-patterns/SKILL.md` and rules:
  avoid boolean-prop proliferation; prefer explicit variants and composition.
- **CI split pattern** from `.github/workflows/code-quality.yml`:
  separate lint/typecheck/test jobs.
- **PR orchestration pattern** from `.github/workflows/pull_request.yml`:
  one PR workflow orchestrates reusable sub-workflows.
- **Biome baseline** from `biome.json`:
  enforce `noFloatingPromises`, filename conventions, `noSecrets`, and ignore generated route trees.

### Tooling & Workflow
- **Biome** statt ESLint+Prettier (ein Tool, schneller).
- **Husky + lint-staged + commitlint** mit Conventional Commits.
  Reduzierte Scopes: `landing|poll|admin|api|db|ui|deps|config`.
- **Pre-commit**: Biome auf staged files + `tsc --noEmit`.
- **Pre-push**: `pnpm run pushcheck` = lint + format:check + typecheck + test + knip.
- **knip** für Dead-Code-Detection.
- **pnpm** (kein npm/yarn).
- Code-Quality-Checks am Ende batchen, nicht nach jeder Änderung.
- CI folgt dem reusable Workflow-Muster: split jobs (`lint`, `typecheck`, `test`) plus PR-Orchestrierung über aufrufbare Workflows.

### TypeScript-Strenge
- Strict + `noUncheckedIndexedAccess: true`.
- **Kein `any`, kein `enum`** → `as const`-Objekte mit derived types.
- Explizite Typen an öffentlichen Funktionsgrenzen.

### Frontend-Architektur
- Path-Alias `~/` → `src/`.
- **TanStack Router / Query / Form** + Zod.
- **Service-Layer-Pflicht**: Komponenten rufen NIE `fetch` direkt — alles über
  `src/services/{domain}.service.ts` (Service-Objekt + `use*`-Hooks).
  Biome-Rule `noRestrictedImports` blockt Direkt-Imports.
- Route-Files sind dünne Wrapper, Logik in `src/components/{domain}/`.
- Components: `PascalCase`-Dateien für eigene, `kebab-case` für shadcn.
  `const`-Definition + `export default` am Ende.
- Stabile Keys beim Mappen (nie Array-Index, wenn Liste mutieren kann).
- Namens-Concat: `[a, b].filter(Boolean).join(" ")`.

### UI-Bibliothek
- **shadcn/ui** Primitives unter `~/ui/*`.
- **Tailwind v4** mit `@theme`-Block für Brand-Tokens.
- **lucide-react** für Icons.
- **sonner** für Toasts.
- **`cn()`** aus `~/lib/ui-utils.ts`.

### UX-Regeln
- **UI-Sprache: Deutsch**; Code/Identifier englisch.
- **Icon-only Buttons MÜSSEN `<Tooltip>` + matching `aria-label`** (gleicher deutscher Text).
- **`<DatePicker>` Pflicht** statt `<input type="date">`.
- **`?`-Icons** öffnen Popover, navigieren nie weg.
- **Confirm-Dialog** nur bei nicht-umkehrbaren Aktionen (z. B. Poll löschen).
- **Delight**: kleine Animationen (≤ 500 ms), `prefers-reduced-motion` respektieren.
- Border usage follows the minimal-ui-borders rules: no decorative border stacks.

### Daten & Zeit
- Zentrales **`~/lib/timezone.ts`** mit dayjs + Plugins, Default `Europe/Vienna`.
  Nie dayjs direkt importieren. Nie moment.
- Timestamps **UTC at rest**, Anzeige Europe/Vienna.
- Datums-Logik mit **frozen-clock-Tests** (`vi.useFakeTimers()` + `setSystemTime()`).

### Zod-Regeln
- Geteilte Schemas direkt im Backend unter `functions/contracts/` — exportiert von dort
  und importiert von Frontend UND Hono.
  (Kein eigenes Package — KISS.)
- `.nullable()` für DB-nullable Felder (nicht `.optional()`) — sonst silent 500 bei
  Response-Validation.

### Backend (Hono)
- Pflicht-Input-Validation pro Route mit Zod.
- ORM: **Drizzle ORM** auf D1, Migrations via **Drizzle Kit**.
- Standard-Fehler-Shape `{ code, message }`; Codes als `as const`-Map in
  `functions/_lib/errors.ts`.
- `requireAdmin`-Middleware für Admin-Routen.
- DB-Helper werfen statt `undefined` durchzureichen (`findPollOrThrow` etc.).
- Mit gemeinsamem `~/lib/timezone`-Pendant unter `functions/_lib/dayjs.ts`.

### Testing
- **Vitest** für Unit-Tests (Komponenten + Hono-Logik).
- **Playwright** für 1 kritischen E2E-Flow (siehe Phase 6).
- **Bug-Fix = Regression-Test**.
- Async-Mocks: `mockResolvedValue` / `mockRejectedValue` — nie bares `vi.fn()`.

### Commits & Docs
- Conventional Commits, enforced via commitlint.
- **Keine Markdown-Files anlegen** außer angefordert.
- **Keine erklärenden Kommentare** zu offensichtlichem Code oder zu entferntem Code.
- **Kein commented-out Code**.

### Nicht übernommen (Overkill)
Turborepo, eigenes `contracts`-Package, React-Email Templates, Entra ID / RBAC,
Multi-Environment-Setup, `<RowActions>`, `<HelpPopover>`, `<PageHelpButton>`,
Help-Center.

---

## Brand / Design-Tokens

| Token | Hex | Verwendung |
|---|---|---|
| `forest-900` | `#1F3D2B` | Primärtext, Headlines, Buttons |
| `forest-700` | `#2D5239` | Sekundär-Akzent |
| `leaf-500` | `#7AB52E` | Vibrant Akzent, Erfolg, Highlights |
| `beet-700` | `#7A1F3D` | CTA-Sekundär, Hover |
| `cream-50` | `#F5F0E1` | Page-Background |
| `wood-600` | `#8B5A2B` | Trennlinien, Holz-Elemente |

**Fonts:** *Fraunces* (Display, Headlines) + *Inter* (Body) via Google Fonts.
**Stil:** warm-handgemacht — `rounded-2xl`-Karten, organische SVG-Wellen-Trenner,
subtile Papier-/Leinen-Textur als Body-Background.

---

## Phasen & Steps

### Phase 1 — Projekt-Setup & Tooling
1. `pnpm create vite@latest` mit React + TS Template.
2. Tailwind v4 + PostCSS einrichten; `@theme`-Block mit Brand-Tokens + Fonts.
3. **Biome** installieren + `biome.json` (Format + Lint + `noRestrictedImports` für
  Service-Layer-Pflicht; zusätzlich `noFloatingPromises`, filename conventions,
  `noSecrets`, Ignore für `routeTree.gen.ts`).
4. **Husky + lint-staged + commitlint** installieren; `commitlint.config.ts` mit
   reduzierten Types/Scopes.
5. **knip** konfigurieren.
6. `tsconfig.json` strict + `noUncheckedIndexedAccess`; Path-Alias `~/*` → `src/*`.
7. **shadcn-init** mit cream/forest-Theme; Primitives installieren:
   Button, Input, Label, Dialog, Card, Tooltip, Popover, Form, Sonner, Badge,
   Tabs, Separator, Calendar, custom DatePicker.
8. `~/lib/timezone.ts` (dayjs + Europe/Vienna); Pendant `functions/_lib/dayjs.ts`.
9. `~/lib/ui-utils.ts` mit `cn()`; `~/lib/query-keys.ts`; `~/lib/api-client.ts`.
10. `wrangler.toml` (Pages-Projekt, D1-Binding, Compatibility-Date).
11. **`AGENTS.md`** + **`.github/copilot-instructions.md`** anlegen
  (komprimierte Regeln, bindet künftige Agenten-Sessions), inkl. Verweisen auf
  die übernommenen monorepo-Skills (frontend-design, minimal-ui-borders,
  ui-quality, performance, composition-patterns).
12. CI-Workflow-Set vorbereiten: reusable `lint`, `typecheck`, `test` Workflows,
  `code-quality.yml` als Aggregator, `pull_request.yml` als Orchestrator.
13. Repo-Struktur (siehe unten).

*Steps 1–4 sequenziell, 5–10 weitestgehend parallel.*

### Phase 2 — Cloudflare-Setup & Deploy-Pipeline
1. Cloudflare-Account verbinden, Pages-Projekt anlegen (User).
2. D1 erstellen: `wrangler d1 create garten-db` → Binding in `wrangler.toml`.
3. GitHub-Repo anlegen, Pages mit Repo verbinden → Auto-Deploy auf `main`.
4. Custom Domain `garten.hinkel.co` in Pages-Settings.
5. Secrets `ADMIN_PASSWORD` und `JWT_SECRET` via `wrangler pages secret put`.

*Vom User durchgeführt, im README dokumentiert.*

### Phase 3 — DB-Schema & API (Hono + Drizzle)
1. Drizzle-Schema in `functions/db/schema.ts` modellieren:
  - Tabellen `polls`, `poll_options`, `votes`
  - Partielle Unique-Constraint für genau eine aktive Umfrage
  - Unique `(poll_id, voter_name, option_id)` für Vote-Upsert.
2. Migrationen mit Drizzle Kit erzeugen (`drizzle/` + SQL Output), danach via
  Wrangler auf D1 anwenden.
3. Geteilte Zod-Schemas in `functions/contracts/poll.ts`:
  `pollSchema`, `pollOptionSchema`, `voteSchema`, `createPollInputSchema`,
  `submitVotesInputSchema`. `.nullable()` für DB-null.
4. Hono-App in `functions/api/[[path]].ts` mit `handle(app)` aus
   `hono/cloudflare-pages`. Eine Route-Datei für V1 (KISS).
5. Auth: Constant-Time-Vergleich gegen `ADMIN_PASSWORD` → signed JWT (HS256 via
   `jose`) als HttpOnly-Cookie, 7 Tage. `requireAdmin`-Middleware.
6. Public Endpoints:
   - `GET /api/polls/active` → aktive Umfrage + Optionen + alle Votes (Namen sichtbar).
   - `GET /api/polls/:id` → wie oben, identifiziert per ID.
   - `POST /api/polls/:id/votes` → Body
     `{ voter_name, responses: [{option_id, response, comment?}] }`. **Upsert**
     pro `(poll_id, voter_name, option_id)`.
7. Admin Endpoints:
   - `POST /api/admin/login`
   - `POST /api/admin/polls` (Create — automatisch `is_active=1`, vorherige aktive
     wird auf `is_active=0` gesetzt in Transaction).
   - `GET /api/admin/polls` (List inkl. Archiv).
   - `PATCH /api/admin/polls/:id` (Final-Option setzen, schließen).
   - `DELETE /api/admin/polls/:id`.
8. Drizzle-Repositories/Queries + DB-Helper `findPollOrThrow(db, id)` etc.

*Step 1 vor allen anderen. Steps 3–8 dann parallelisierbar.*

### Phase 4 — React Frontend
1. **TanStack Router**: Routen in `src/routes/`:
   - `__root.tsx`, `index.tsx` = Landing, `poll.$id.tsx`,
   - `admin/index.tsx` = Login, `admin/polls.tsx`, `admin/polls.$id.tsx`.
   - Vite-Plugin generiert `routeTree.gen.ts`.
2. App-Shell: Top-Bar mit `icon.png` + Titel, Footer mit `logo.png`.
3. Landing-Sektionen:
   - **Hero** — `banner.png` als Hintergrund, Titel/Subline, CTA "Aktueller Termin".
   - **Über uns** — Familien Kirschenhofer & Hinkel, Vereinsidee.
   - **Was wir tun** — 3-Karten-Grid (Beet / Ernte / Bewegung).
   - **Aktuelle Umfrage** — Teaser auf einzige aktive Poll (falls vorhanden;
     sonst dezenter "noch keine Umfrage"-Hinweis).
   - **Kontakt** — statisch (mailto).
4. Komponenten:
   - `components/poll/PollView.tsx` — Tabelle Optionen × Teilnehmer, Ja/Nein/Vielleicht
     Pills, ausklappbare Kommentare. **Bestehende Votes immer sichtbar.**
   - `components/poll/VoteForm.tsx` — Namens-Input (LocalStorage-Persistenz),
     Antwort-Buttons pro Option, optional Kommentar.
   - `components/admin/AdminLogin.tsx`, `AdminDashboard.tsx`, `PollEditor.tsx`.
   - `components/landing/Hero.tsx`, `AboutUs.tsx`, `WhatWeDo.tsx`,
     `ActivePollTeaser.tsx`, `Navbar.tsx`, `Footer.tsx`, `WavyDivider.tsx`.
5. Service-Layer:
   - `~/services/poll.service.ts` (public) → `usePoll(id)`, `useActivePoll()`,
     `useSubmitVotes()`.
   - `~/services/admin.service.ts` → `useAdminLogin()`, `useAdminPolls()`,
     `useCreatePoll()`, `useFinalizePoll()`, `useDeletePoll()`.
6. **TanStack Form + Zod** für Poll-Editor und Vote-Form.
7. Custom `<DatePicker>` für Termin-Optionen.
8. UI-Texte deutsch direkt im JSX. Code englisch.
9. Icon-only Buttons → Tooltip + `aria-label`.
10. Confirm-Dialog nur für Poll-Löschen.
11. WCAG AA: Kontrast prüfen, Focus-Visible-States.

*Step 1 vor allen. Steps 2–5 parallel. 6–11 querschnitt.*

### Phase 5 — Bilder, Logo & Content
1. **SVG-Logo** aus `public/icon.png` nachbauen (manuell mit Figma/Illustrator oder
   im Code als reine SVG-Komposition). Ziele: scharfes Rendering in allen Größen,
   ≤ 6 KB, gleiche Farb-Tokens. Speicherort: `public/icon.svg` + `public/logo.svg`.
2. **Favicon-Set** generieren aus `icon.png`/SVG: `favicon.ico`, `apple-touch-icon.png`,
   `icon-192.png`, `icon-512.png`, plus `site.webmanifest`.
3. **OG-Image** (`public/og-image.png`, 1200×630) aus Crest + `banner.png` komponieren
   für Link-Vorschauen (WhatsApp/Telegram).
4. **`docs/image-prompts.md`** mit 3–5 zusätzlichen Hero/Section-Background-Prompts
   im Logo-Stil (für künftige Bild-Updates durch User).
   Beispiel-Prompt:
   > *"Watercolor illustration of an Austrian Schrebergarten in early summer,
   > raised wooden vegetable beds, sunflowers, blurred soft greens and creams,
   > warm afternoon light, hand-drawn feel, horizontal banner 1920×800, subtle
   > paper texture, palette: forest green #1F3D2B, beet purple #7A1F3D, cream
   > #F5F0E1, vibrant leaf green #7AB52E"*
5. SVG-Wellen-Trenner zwischen Sektionen direkt im Code (`WavyDivider.tsx`).
6. Platzhalter-Texte für "Über uns" / "Was wir tun" in Folgerunde mit User abstimmen.

### Phase 6 — Verification & Launch
1. `pnpm run pushcheck` grün (lint + format:check + typecheck + test + knip).
2. GitHub Actions `pull_request` läuft grün und ruft `code-quality` mit getrennten
  Jobs (`lint`, `typecheck`, `test`) erfolgreich auf.
3. `wrangler pages dev` lokal → SPA + Functions + lokales D1 testen.
4. **Vitest** Unit-Tests:
   - `requireAdmin`-Middleware (401 / 200 Pfade).
   - Vote-Upsert-Logik (zweimal gleicher Name → 1 Row).
   - "Nur eine aktive Umfrage"-Constraint.
   - Datums-Helper mit `vi.useFakeTimers()`.
5. **Playwright E2E** (`e2e/poll-flow.spec.ts`):
   Admin-Login → Poll mit 3 Optionen anlegen → 2 Voter geben Stimmen ab
   (Vote-Tabelle zeigt sie an) → Admin markiert final → Banner "Termin steht" sichtbar.
6. Manuelle Smoke-Tests:
   - [ ] Landing rendert sauber bei 375 / 768 / 1280 px.
   - [ ] Admin-Login falsch → Fehler-Toast, kein Cookie.
   - [ ] Vote mit gleichem Namen → Update (nicht dupliziert).
   - [ ] Lighthouse ≥ 90 (Performance / Accessibility / SEO).
7. `wrangler d1 migrations apply garten-db --remote`.
8. Deploy auf Cloudflare Pages → `garten.hinkel.co` live testen.

---

## Repo-Struktur

```
/src
  /routes              TanStack Router file-based
    __root.tsx
    index.tsx          Landing
    poll.$id.tsx
    admin/
      index.tsx        Login
      polls.tsx        Liste / Dashboard
      polls.$id.tsx    Editor
  /components
    /landing           Hero, AboutUs, WhatWeDo, ActivePollTeaser, Navbar, Footer, WavyDivider
    /poll              PollView, VoteForm
    /admin             AdminLogin, AdminDashboard, PollEditor
  /ui                  shadcn primitives inkl. date-picker.tsx
  /services            poll.service.ts, admin.service.ts
  /lib                 timezone.ts, ui-utils.ts, query-keys.ts, api-client.ts
  /styles              index.css
  main.tsx
/functions
  /api
    [[path]].ts        Hono-Catchall
  /contracts           poll.ts (Zod-Schemas, Backend-Export für Frontend+API)
  /db                  schema.ts, client.ts, queries/
  /_lib                auth.ts, db.ts, dayjs.ts, errors.ts
/migrations
  (optional, falls von Drizzle Kit separat exportiert)
/drizzle               Drizzle Migrationen + SQL Snapshots
/public                icon.svg, logo.svg, favicon.ico, og-image.png, site.webmanifest, originale aus public/
/e2e                   Playwright
/docs                  plan.md, image-prompts.md
AGENTS.md
.github/copilot-instructions.md
.github/workflows/
  pull_request.yml
  code-quality.yml
  lint.yml
  typecheck.yml
  test.yml
biome.json
commitlint.config.ts
knip.json
wrangler.toml
package.json, tsconfig.json, vite.config.ts, index.html, README.md
.husky/                pre-commit, pre-push, commit-msg
```

---

## Out of Scope V1

E-Mail-Notifications · mehrere parallele aktive Umfragen · Foto-Galerie ·
Vereins-Mitgliederverwaltung · Mehrsprachigkeit · Help-Center · RBAC ·
Multi-Environment.