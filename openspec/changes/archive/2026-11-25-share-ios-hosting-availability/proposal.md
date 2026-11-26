## Why

Move a complete set of availability controls in the regular iOS hosting editor
to shared Compose.

## What Changes

- Render hosting and meeting availability, guest capacity and circle visibility
  with Compose controls inside the existing editor.
- Keep offer loading, validation, location capture and saving in the iOS host.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: iOS uses Compose for the availability section of the
  hosting editor.

## Impact

Changes presentation in the shared UI and regular iOS app. The form payload,
validation and existing location fields are unchanged.
