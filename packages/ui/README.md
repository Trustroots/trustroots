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

These are initial primitives, not complete replacements for Bootstrap. Add
variants only when a real consumer needs them, keeping keyboard access and
existing appearance in mind.

## Class names and variants

Components build their class names with `cn()` from `src/lib/utils.ts`
(imported as `#lib/utils`): `clsx` joins conditional classes, and
`tailwind-merge`, configured for the `tw:` prefix and this package's theme
tokens, lets a later utility replace a conflicting earlier one. When
`globals.css` gains a token that utilities use (a spacing, radius or line
height name), add it to the `extendTailwindMerge` call too. Components with
variants describe them with `class-variance-authority` (`cva`).

## Badge

Every badge in the app is a `Badge`, including the status tags that were
Bootstrap 3 `.label`s. Callers pick `variant` (`solid` or `outline`) and
`tone` (`neutral`, `primary`, `success`, `warning`, `danger`, `inverse`), both
required, and optionally `size` (`md`, the default, scales with the text like
Bootstrap's `.badge`; `sm` for profile counts and tags; `xs` for the header's
unread counter) and `shape` (`rounded` or `pill`). `indicator` adds the
notification dot. The badge renders `data-slot="badge"` and its resolved
`data-variant`, `data-tone`, `data-size` and `data-shape`, which tests should
use instead of class names. Only offer a value that the app uses; drop it
when its last use goes.

## shadcn

`components.json` configures the shadcn CLI for the Base UI flavour
(`base-vega`), the `tw` prefix, RTL-aware classes and this package's
`#components` and `#lib` imports. To start a component from shadcn, preview
it from this directory:

```sh
pnpm dlx shadcn@latest add button --dry-run --view
```

Then write it into `src/components/` by hand, adapted to the Trustroots look
and tokens. The CLI writes lowercase file names, which would overwrite the
existing PascalCase files on a case-insensitive file system, and imports
`cn` from `"cn"` instead of `#lib/utils`.
