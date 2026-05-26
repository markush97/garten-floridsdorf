# Copilot Instructions

## Languages

- Keep all code, comments, identifiers, and documentation in English.
- Keep all user-facing UI text in German (labels, placeholders, tooltips,
  `aria-label`, toast messages, error copy). Use proper umlauts (`ä`, `ö`, `ü`,
  `ß`) — never ASCII fallbacks.

## Architecture & TypeScript

- Use React 19 with TypeScript strict mode + `noUncheckedIndexedAccess`.
- No `any`, no `enum` — use `as const` objects with derived types.
- Path alias `~/` → `src/`.
- Prefer direct, simple implementations over service or abstraction layers
  unless state or lifecycle makes them necessary.
- Keep route files thin once TanStack Router is added; move UI logic into
  `src/components/*`.
- Do not call `fetch` directly from React components once the service layer is
  introduced.
- Stable keys when mapping; never array index for mutable lists.

## Styling system

- Tailwind v4 with brand tokens from [src/styles/index.css](src/styles/index.css):
  `forest-900`, `forest-700`, `leaf-500`, `beet-700`, `cream-50`, `wood-600`.
  Use these tokens — do not introduce raw hex colors except inside arbitrary
  `bg-[...]`/`shadow-[...]` values that compose the tokens.
- Fonts: `font-display` (Fraunces) for headlines, default Inter for body.
- Use `cn()` from `~/lib/ui-utils.ts` to compose class names. Concat strings
  with `[a, b].filter(Boolean).join(" ")`.

## Mobile-first layout rules

- **Mobile-first always**: base classes target ≤ 390 px; layer up with `sm:`
  (≥ 640), `md:`, `lg:` (≥ 1024). Never write desktop-only sizing without a
  smaller mobile counterpart.
- Test against 375 / 768 / 1280 px. The page must not introduce horizontal
  scroll at any width; the root wrapper uses `overflow-x-hidden`.
- Page chrome paddings: `px-3 sm:px-6 lg:px-8`. Section vertical rhythm:
  `space-y-12 sm:space-y-16 lg:space-y-20`.
- Section card paddings: `p-5 sm:p-6 lg:p-8`. Section radii:
  `rounded-[1.5rem] sm:rounded-[2rem]` for the standard friendly silhouette.
  The hero is one step larger: `rounded-[1.75rem] sm:rounded-[2.5rem]`.
- Headline scale:
  - Hero `h1`: `text-[2.25rem] sm:text-6xl lg:text-7xl` with
    `leading-[1.08] sm:leading-[1.05]` and `max-w-[14ch]`.
  - Section `h2`: `text-3xl sm:text-4xl lg:text-5xl`.
  - Body copy: `text-base sm:text-lg`; supporting copy `text-sm sm:text-base`.
- Interactive controls: `min-h-11` for nav-style chips, `min-h-12` for primary
  CTAs (≥ 44 × 44 hit target). On mobile, stack primary CTAs vertically
  (`flex flex-col gap-3 sm:flex-row`).
- Cards typically use `bg-white/75 backdrop-blur` (light) or `bg-forest-900`
  (dark hero/teaser) with a soft `shadow-[0_22px_45px_rgba(31,61,43,0.08)]`.
  Pair white cards with `ring-1 ring-inset ring-white/40` when over photos.
- Sticky navbar lives at `top-3 sm:top-4` and shrinks its content on mobile
  (hide tagline, smaller logo, horizontally scrollable nav strip with hidden
  scrollbar).
- Wavy dividers and other full-bleed flourishes use negative margins matching
  the page padding (`-mx-3 sm:-mx-6 lg:-mx-8`).

## Motion & animation

- Custom animation utilities live in [src/styles/index.css](src/styles/index.css):
  `.animate-float`, `.animate-drift`, `.animate-pulse-soft`,
  `.animate-nudge-right`, `.shimmer-text`, plus the `.reveal` /
  `.reveal.is-visible` pair driven by the
  [Reveal](src/components/landing/Reveal.tsx) component (IntersectionObserver).
- Use `Reveal` for any element that should fade-up on scroll. Stagger child
  reveals with the `delay` prop (`index * 120 + 120` is the established
  cadence).
- Decorative motion (floating leaves, drifting dividers, shimmer) is purely
  cosmetic — keep it subtle and gate it behind `prefers-reduced-motion`
  (already handled centrally via the media query in `index.css`).
- Keep interactive animations ≤ 500 ms. Hover affordances should be
  `transition` + `translate-y` / `scale` / `shadow` — never heavy animation.
- Heavy decorative effects (floating leaves, blurred backdrops) should be
  hidden on mobile (`hidden sm:block`) to keep small screens calm and fast.

## Accessibility

- Semantic HTML: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`,
  `<footer>`.
- Icon-only controls require a German `aria-label` and a visible tooltip when
  applicable.
- Decorative SVGs/icons get `aria-hidden="true"`. Provide `<title>` for
  meaningful inline SVGs.
- Preserve the global `:focus-visible` outline (defined in `index.css`); do
  not override per-element unless replacing with an equally visible ring.
- Respect `prefers-reduced-motion`: any new animation utility must be disabled
  in the existing media query block.

## Brand voice in copy

- Warm, plural-collective, family-friendly German. Address readers informally
  (du / ihr) where natural.
- Section eyebrow labels in uppercase: `tracking-[0.24em]` with
  `text-forest-700` (light cards) or `text-leaf-500` (dark cards).

## Tooling

- Use Biome for linting and formatting; `noFloatingPromises`, filename
  conventions, and `noSecrets` are enforced.
- Use `pnpm` exclusively.
- Use Conventional Commits with scopes
  `landing|poll|admin|api|db|ui|deps|config`.
- After non-trivial changes run `pnpm lint && pnpm typecheck && pnpm test &&
  pnpm knip`.
- Do not create Markdown files for changelogs or summaries unless asked.
