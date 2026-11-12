## Why

Tooltip is one of the remaining React Bootstrap components in the web
client. Moving it to the shared UI package advances issue #3248 and lets
the existing Base UI dependency handle popup positioning and interaction.

## What Changes

- Add a shared, Tailwind-styled Tooltip that preserves the compact dark
  appearance and supports the four placements used in the web client.
- Migrate the existing tooltip triggers, keeping their semantics and
  providing a focusable trigger for disabled offer actions.
- Cover keyboard and pointer interaction in Storybook and Playwright.

## Impact

Applies to shared web tooltips. No API, database or dependency change is
required.
