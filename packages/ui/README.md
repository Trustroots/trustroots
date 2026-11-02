# Shared UI primitives

Import directly from `@trustroots/ui/Button`, `ButtonGroup`, `Alert`, `Badge` or
`Spinner`. They accept caller-supplied text and do not depend on translations
or feature modules. `Button` is non-submitting by default; set `type="submit"` when
needed. `Alert` takes a status intent (`danger`, `warning`, `info` or `success`) and a
required `role`; `Spinner` requires a translated `label` supplied by its caller.

Components live in `src/components/` and are styled with `tw:`-prefixed
Tailwind utilities. `src/globals.css` (exported as `@trustroots/ui/globals.css`)
is the package's Tailwind entry: it declares the `@theme` tokens the components
use and the `@source` that lets Tailwind find their classes. The web client's
Tailwind stylesheet imports it once; components do not import CSS themselves.
Tokens refer to the app's `--tr-*` custom properties where one exists, so values
stay owned by the Less variables.

## Intents and variants

Every component that has a colour takes an `intent` from `src/lib/intent.ts`
(`@trustroots/ui/intent`): `primary`, `neutral`, `success`, `warning`, `danger`,
`info` or `inverse`. An intent sets two custom properties, `--intent` (the
colour) and `--on-intent` (text on a solid fill of it), from the app's `--tr-*`
tokens. Variants only read those two properties, so they need no compound
variant per colour, and hover and pressed shades are mixed with `color-mix()`
instead of being stored as tokens.

`Button` has four variants: `solid` (the default), `outline`, `ghost` and
`link`. Its default intent is `inverse`, white with brand-green text. Sizes are
`xs`, `sm`, `md` (the default), `lg` and `xl`; `round` makes an icon button a
circle.
Layout such as full width or a shadow belongs in `className`.

Every variant, intent and size must have a use in app code: when a change
removes the last use of a value, remove the value too. Add new values only for
a real consumer, and add them to the component's stories.

## Class names

Components build their class names with `cn()` from `src/lib/utils.ts`
(imported as `#lib/utils`): `clsx` joins conditional classes, and
`tailwind-merge`, configured for the `tw:` prefix and this package's theme
tokens, lets a later utility replace a conflicting earlier one. When
`globals.css` gains a token that utilities use (a spacing, radius or line
height name), add it to the `extendTailwindMerge` call too.

## shadcn

`components.json` configures the shadcn CLI for the Base UI flavour
(`base-vega`), the `tw` prefix, RTL-aware classes and this package's
`#components` and `#lib` imports. To start a component from shadcn, preview
it from this directory:

```sh
pnpm dlx shadcn@latest add button --dry-run --view
```

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
