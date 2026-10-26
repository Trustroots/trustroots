## Why

Issue #3248 proposes an incremental move towards owned UI components. Existing
Less values are inaccessible to CSS-in-JS consumers, which copy colour literals.
Expose those values first, preserving the current website appearance.

## What Changes

- Emit a small `--tr-*` CSS custom property vocabulary from existing Less values
  once in the client stylesheet entry.
- Cover brand and text colours, surfaces, typography, component padding, radii
  and the notification badge colour. Keep Less as the source of values for now.
- Consume the notification token in the existing React Badge.
- Document CSS and TSX usage and verify production LTR and RTL styles.

## Impact

Affected areas: client stylesheet composition, core Badge and site-presentation.
No appearance change, data migration, API change or deployment step is required.
Bootstrap remains in place. Tailwind, new primitives, screen migrations and the
future `packages/ui` extraction in `adopt-modular-workspace` are separate slices.
This change does not complete #3248 or introduce a competing `modules/ui` owner.
