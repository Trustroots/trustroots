# Shared UI primitives

Import directly from `@trustroots/ui/Button`, `Alert`, `Badge` or `Spinner`.
They accept caller-supplied text and do not depend on translations or feature
modules. `Button` is non-submitting by default; set `type="submit"` when
needed. `Alert` currently provides the warning appearance and alert semantics;
`Spinner` requires a translated `label` supplied by its caller.

Components live in `src/components/` and are styled with `tw:`-prefixed
Tailwind utilities. `src/globals.css` (exported as `@trustroots/ui/globals.css`)
is the package's Tailwind entry: it declares the `@theme` tokens the components
use and the `@source` that lets Tailwind find their classes. The web client's
Tailwind stylesheet imports it once; components do not import CSS themselves.
Tokens refer to the app's `--tr-*` custom properties where one exists, so values
stay owned by the Less variables.

## Storybook

Each component has a `*.stories.tsx` file next to it. Stories render with the
app's stylesheets (Bootstrap, the global Less and Tailwind), loaded through
`config/vite/load-styles.ts`, so they look as they do on the site. The toolbar
switches between left-to-right and right-to-left.

- `pnpm --filter @trustroots/ui run storybook` serves Storybook on port 6006.
- `pnpm --filter @trustroots/ui run test:stories` runs every story as a Vitest
  browser test in headless Chromium. A story fails if it throws while rendering
  or if its `play` checks fail. CI runs this in the `client` job.

When you add or change a variant, add or update its story so reviewers can see
it.

These are initial primitives, not complete replacements for Bootstrap. Add
variants only when a real consumer needs them, keeping keyboard access and
existing appearance in mind.
