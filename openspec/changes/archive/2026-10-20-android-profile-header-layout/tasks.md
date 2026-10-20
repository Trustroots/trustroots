## 1. Specification

- [x] 1.1 Validate this focused OpenSpec proposal before implementation.
- [x] 1.2 Revalidate the artwork-backed tab placement before implementing it.

## 2. Profile layout

- [x] 2.1 Move the artwork header and section tabs outside the section pager,
      preserving actions above the artwork and section content scrolling.
- [x] 2.2 Use a compact horizontal avatar and text arrangement, sizing the
      artwork against measured action and tab rows plus bottom insets.
- [x] 2.3 Preserve selected-page and selected-tab synchronisation for both
      tab selection and pager swipes.
- [x] 2.4 Preserve loading, error, API, action, nested navigation and Back
      behaviour.
- [x] 2.5 Put the shared section tabs inside the artwork header with readable
      foreground and selected-state treatment.

## 3. Verification

- [x] 3.1 Add anonymous Android journeys that verify the fixed shared profile
      frame while scrolling and swiping between sections.
- [x] 3.2 Validate the completed OpenSpec change and run the checks selected by
      the parent agent.

Strict OpenSpec validation, `pnpm check`, Android unit tests, lint and APK builds
have passed. All six rich-profile journeys and nine related profile and shell
journeys pass; anonymous normal and compact screenshots have been inspected.
