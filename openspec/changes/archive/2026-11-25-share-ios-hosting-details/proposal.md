## Why

Move the hosting descriptions and volunteering controls to shared Compose in
the regular iOS hosting editor.

## What Changes

- Render editable multiline hosting descriptions, the reason the member is
  unavailable, and volunteering preferences with Compose.
- Keep the location fields, validation, stored rich text and saving in the iOS
  form.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the hosting editor uses Compose for its description and
  volunteering section.

## Impact

Changes shared UI and iOS presentation. No API, data or deployment changes are
required.
