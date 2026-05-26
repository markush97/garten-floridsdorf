# AGENTS

## Project Rules

- All code, comments, and documentation stay in English.
- All visible UI text stays in German with proper umlauts (`ä`, `ö`, `ü`, `ß`).
- Prefer simple exported helpers over unnecessary services or wrappers.
- Keep implementations direct and complete instead of adding temporary
  workaround layers.
- Preserve the brand direction from the implementation plan: forest, beet,
  cream, and handmade warmth.

## Frontend

- Use Tailwind v4 tokens from `src/styles/index.css`.
- Keep component logic in `src/components/*` and use route wrappers only for
  routing once TanStack Router is added.
- **Design mobile-first**: every layout, font size, spacing, and radius starts
  with the base (≤ 390 px) and scales up at `sm:` / `lg:`. Verify at 375 /
  768 / 1280 px; no horizontal scroll at any width.
- Reuse the established conventions from
  [.github/copilot-instructions.md](.github/copilot-instructions.md) (section
  paddings, radii, headline scale, CTA stacking, sticky navbar, wavy
  dividers).
- Reuse the `Reveal` component and the custom animation utilities defined in
  `src/styles/index.css` for on-scroll motion. All decorative motion respects
  `prefers-reduced-motion`.
- Respect accessibility: semantic HTML, robust focus-visible states, German
  `aria-label` values for icon-only buttons, decorative icons marked
  `aria-hidden`.

## Tooling

- Use Biome for linting and formatting.
- Use Conventional Commits with scopes `landing`, `poll`, `admin`, `api`,
  `db`, `ui`, `deps`, `config`.
- Prefer `pnpm` for all package management.