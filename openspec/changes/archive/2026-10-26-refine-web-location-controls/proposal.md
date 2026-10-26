## Why

The text action inherits search form styling and occupies too much space. Members who deny browser location permission should be able to navigate approximately using the existing GeoIP service.

## What Changes

- Replace the text action with an accessible location icon over each map.
- Reuse the control on the hackers and hitchhikers circle maps.
- On device-location failure, try the existing authenticated GeoIP lookup and clearly identify an approximate result.
- Use the GeoIP viewport's coarse zoom. In offer editors, move only the viewport and require an explicit coordinate selection before saving.
- Retain manual selection and actionable feedback when neither source is available.

## Impact

Core, search, offers and tribes client components and tests. Reuses the existing endpoint and local database; adds no dependencies, tracking or persisted location fields.
