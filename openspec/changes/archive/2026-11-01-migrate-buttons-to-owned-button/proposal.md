## Why

Issue #3248 moves the web client towards Tailwind gradually. The owned Button
covered two looks, while about 95 components still hand-wrote Bootstrap button
classes (`btn btn-primary btn-lg`, `btn-inverse`, `btn-offer-hosting-yes`, …) on
buttons, links and labels, styled by Bootstrap variables and module Less rules.
Every new button had to pick class names, and the Less rules could not be
removed.

## What Changes

- Rebuild Button from shadcn's Base UI button with class-variance-authority.
  Consumers pick a `variant` (solid, inverse, offer, link, plain), a `colour`
  valid for that variant, a `size` (xs, sm, md, lg, action) and the `round`,
  `raised` and `block` flags. Base UI's `render` prop puts the look on links,
  router links and labels, which keep their own semantics. Buttons default to
  `type="button"`.
- Add ButtonGroup for joined buttons, replacing `btn-group`,
  `btn-group-vertical` and `btn-group-justified`.
- Migrate every button in the app to Button or ButtonGroup and remove the Less
  and legacy Bootstrap button rules that become dead. Module rules that styled
  buttons in context target the Button's data attributes instead of classes.
- The component supports only variants, colours and sizes the app uses.

## Impact

Pages keep their appearance and behaviour in LTR and RTL, at desktop and touch
widths; main and branch are compared pixel by pixel. Two deliberate changes:
disabled solid and offer buttons keep their colour at reduced opacity, and hover
styles apply only on devices that hover. No API or database change is required.
