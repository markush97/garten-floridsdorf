# AGENTS

## Project Rules

- All code, comments, and documentation stay in English.
- All visible UI text stays in German.
- Prefer simple exported helpers over unnecessary services or wrappers.
- Keep implementations direct and complete instead of adding temporary workaround layers.
- Preserve the brand direction from the implementation plan: forest, beet, cream, and handmade warmth.

## Frontend

- Use Tailwind v4 tokens from `src/styles/index.css`.
- Keep component logic in `src/components/*` and use route wrappers only for routing once TanStack Router is added.
- Respect accessibility: semantic HTML, robust focus-visible states, and German `aria-label` values for icon-only buttons.

## Tooling

- Use Biome for linting and formatting.
- Use Conventional Commits with scopes `landing`, `poll`, `admin`, `api`, `db`, `ui`, `deps`, `config`.
- Prefer `pnpm` for all package management.