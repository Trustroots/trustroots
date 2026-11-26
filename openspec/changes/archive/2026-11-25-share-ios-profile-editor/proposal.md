## Why

Move the regular iOS profile editor fields and save feedback to shared Compose as part of #3232.

## What Changes

- Render the name, tagline, locations, language selector, biography and save action in Compose.
- Use the existing iOS profile client and language picker. Keep the current input trimming, required name and plain-text biography loading.
- Keep the profile editor's native back and cancel actions.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the regular iOS profile editor uses shared Compose for the editable form.

## Impact

The regular iOS profile editor and shared UI change. No API or data migration is required.
