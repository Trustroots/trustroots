## Why

Move the regular iOS profile Experiences section to shared Compose so the
summary, published feedback and replies can share a mobile presentation.

## What Changes

- Render published Experience ratings, feedback and responses in Compose.
- Preserve percentages, six-item preview and expansion.
- Keep the native profile routes and avatars for authors and respondents.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the regular iOS profile shares its Experiences section.

## Impact

The shared Kotlin UI and iOS profile change. The existing API and its visibility rules stay in use.
