## Why

Use shared Compose for the regular iOS profile header identity and tagline.
Keep the existing native profile artwork and the separate Back row.

## What Changes

- Render name, handle, avatar placement and tagline in Compose.
- Keep native avatar fetching and the blurred artwork background.
- Keep Back above the avatar on profiles reached from the map and other routes.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the regular iOS profile uses a shared identity header.

## Impact

The iOS profile presentation changes. Profile data, artwork loading and navigation remain with the existing host.
