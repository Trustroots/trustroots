## Why

Issue #3248 moves the web client towards Tailwind gradually. The owned UI
primitives still ship a hand-written stylesheet, and Tailwind utilities sit in a
cascade layer that loses to every unlayered Bootstrap and Less rule, including
element selectors such as Bootstrap's `button { border-radius: 0 }`. Utilities
therefore cannot style a primitive reliably.

## What Changes

- Give `@trustroots/ui` a Tailwind entry, `src/globals.css`, holding the theme
  tokens and the source scan for its components. The web client's Tailwind
  stylesheet imports it once.
- Move the primitives to `packages/ui/src/components/` and express their styles
  as prefixed Tailwind utilities, removing `primitives.css`. Import paths and
  component props stay the same.
- Emit Tailwind utilities unlayered, after Bootstrap and the global Less, so a
  utility class overrides element rules and wins specificity ties with Bootstrap
  classes. Module stylesheets still load afterwards.

## Impact

The primitives keep their appearance in LTR and RTL; isolated before and after
screenshots are compared pixel by pixel. Pages that do not use `tw:` utilities
are unaffected. No API or database change is required.
