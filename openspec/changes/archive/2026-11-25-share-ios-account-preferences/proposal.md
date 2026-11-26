## Why

Move the regular iOS Account email and newsletter form to shared Compose as part of #3232.

## What Changes

- Render the email field, newsletter switch, save action and feedback in Compose.
- Use the existing authenticated iOS account update and pending email state.
- Preserve the native Account password, Nostr and sign-out sections.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the iOS Account destination uses the shared email and newsletter form.

## Impact

The regular iOS Account presentation and shared UI change. No API or data migration is required.
