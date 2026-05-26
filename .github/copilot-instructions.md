# Copilot Instructions

- Keep all code, comments, and documentation in English.
- Keep all user-facing UI text in German.
- Prefer direct, simple implementations over service or abstraction layers unless state or lifecycle makes them necessary.
- Use React with TypeScript strict mode and avoid `any`.
- Keep route files thin once TanStack Router is added; move UI logic into `src/components/*`.
- Do not call `fetch` directly from React components once the service layer is introduced.
- Respect accessibility basics: semantic elements, visible focus states, and German `aria-label` text for icon-only controls.
- Use brand tokens from the implementation plan: forest, leaf, beet, cream, wood.