## Why

Issue #3248 moves the web client towards Tailwind gradually. The owned Button
covered two looks, while about 95 components still hand-wrote Bootstrap button
classes (`btn btn-primary btn-lg`, `btn-inverse`, `btn-offer-hosting-yes`, …) on
buttons, links and labels, styled by Bootstrap variables and module Less rules.
Every new button had to pick class names, and the Less rules could not be
removed.

## What Changes

- Add a shared `Intent` (primary, neutral, success, warning, danger, info,
  inverse) in `@trustroots/ui/intent`. Each intent sets two CSS custom
  properties, the colour and the text on it, from existing `--tr-*` tokens; the
  four status colours become `--tr-success`, `--tr-warning`, `--tr-danger` and
  `--tr-info`, and `--tr-neutral` is the grey used by labels.
- Rebuild Button from shadcn's Base UI button with class-variance-authority.
  Consumers pick a `variant` (solid, outline, ghost, link), an `intent` and a
  `size` (sm, md, lg, xl), plus the `round` flag. Variants only read the intent's
  properties, so any variant takes any intent. Hover and pressed shades are
  derived with `color-mix()` rather than stored as tokens. Base UI's `render`
  prop puts the look on links, router links and labels, which keep their own
  semantics. Buttons default to `type="button"`.
- Add ButtonGroup for joined buttons, replacing `btn-group`,
  `btn-group-vertical` and `btn-group-justified`.
- Migrate every button in the app to Button or ButtonGroup and remove the Less
  and legacy Bootstrap button rules that become dead. Module rules that styled
  buttons in context target the Button's data attributes instead of classes.
- The component supports only variants, intents and sizes the app uses, and
  its Storybook stories show each of them.

## Impact

Pages keep their layout and behaviour in LTR and RTL. Visible changes: the
admin danger buttons use the app red (#d9534f) instead of Bootstrap's
(#dc3545); the one info button uses the meet teal with white text instead of
cyan with black text; muted links use the app's muted text colour; plain
buttons use the app's text colour; extra-small buttons become small; large
round buttons have 2px less padding; and hover and pressed shades come from
`color-mix()`. Disabled solid buttons keep their colour at reduced opacity. No
API or database change is required.
