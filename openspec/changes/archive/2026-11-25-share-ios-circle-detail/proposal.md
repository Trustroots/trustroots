## Why

The regular iOS Circles list uses Compose. Use the shared UI for Circle details
so the list, summary and member discovery have the same interaction model.

## What Changes

- Render the Circle summary, member groups and Wiki action in Compose.
- Keep the existing iOS artwork, authenticated member discovery, cache, and
  profile and Wiki routes.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: regular iOS Circle details use Compose.

## Impact

Changes the regular iOS Circle presentation and shared Kotlin UI. No API,
data or deployment changes are required.
