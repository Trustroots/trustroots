## Why

The Android member profile currently places its artwork header and section tabs
inside every `HorizontalPager` page. This repeats those controls in the pager's
semantics and lets the header and tabs scroll away with profile content. The
profile actions already sit above the pager, but the complete profile frame
does not have a stable placement while members switch sections or scroll.

## What Changes

- Keep the profile actions, artwork header and section tabs in one shared
  column outside the `HorizontalPager`.
- Keep the action row above the artwork as it is today; moving it over the
  artwork is a separate visual refinement outside this slice.
- Place the section tabs inside the shared artwork header so the profile
  background image and scrim continue behind them, while keeping them outside
  the pager.
- Keep only the selected section's independently scrollable content inside the
  pager, preserving tab-to-page and swipe-to-tab synchronisation.
- Use a compact horizontal avatar and text arrangement when height is limited.
  Derive artwork height from the measured action row, tab row and bottom inset
  so profile content remains usable after shell padding.
- Add anonymous Android journeys that verify the shared header and tabs remain
  visible while section content scrolls and that swiping changes the selected
  tab without duplicating the shared profile frame.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: define stable placement for the native profile
  actions above an artwork header that contains the section tabs, with profile
  sections paging and scrolling independently, including compact-height sizing.

## Impact

- Changes the Android profile screen, its UI journey coverage, and the living
  Android member-app specification.
- Preserves profile loading and failure states, actions, API requests, nested
  navigation and current section selection behaviour. The action row remains
  above the artwork; overlay placement is deferred.
- Requires no data migration, backend change or new dependency.
