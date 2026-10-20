## Why

The Android Circles overview and detail screens spend substantial vertical
space on their headers. As members scroll through the circle list or a circle's
details, the screen title and navigation context should remain available in a
compact app bar with consistent title typography.

## What Changes

- Collapse the Circles overview header into a single-row app bar as its content
  scrolls.
- Collapse the circle detail artwork header into a single-row app bar that
  retains the circle title and Back action.
- Keep the expanded overview description, circle artwork, and detail content
  available in the scrollable screen.
- Preserve filter state and clear/search behaviour, formatted description text
  and inert links, membership actions, API requests, selection and Back state.
- Respect system insets, right-to-left layout, touch targets, accessibility,
  and light/dark theme colours.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: Circles overview and detail headers collapse
  during scrolling while keeping their title and primary navigation context
  available.

## Impact

- Affects the Android Circles overview and detail Compose layouts and their
  instrumentation journeys.
- Uses the existing Compose Material 3 dependency; no server, API, persistence,
  or web behaviour changes.
