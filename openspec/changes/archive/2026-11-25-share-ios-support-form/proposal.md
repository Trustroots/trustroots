## Why

Move the regular iOS support form to the shared Compose UI as part of #3232.

## What Changes

- Render the support message form, sending feedback, confirmation and FAQ action using existing shared Compose controls.
- Keep the iOS authenticated support client and bounded FAQ browser route.
- Preserve the draft when sending fails so the member can retry.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the iOS support destination uses the shared form.

## Impact

The regular iOS support screen and shared UI change. No API, data or Android navigation changes are required.
