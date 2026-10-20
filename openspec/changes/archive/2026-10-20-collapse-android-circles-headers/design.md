## Context

`CirclesScreen` currently places “Discover circles”, its explanatory text,
and the live filter above a `LazyColumn`. The selected-circle branch places a
250 dp `ArtworkHero` in a vertically scrolling `Column`, followed by the
description and membership action. Neither layout keeps a compact title row
visible during scrolling.

Existing journeys establish behaviour that this layout change must preserve:
the list is sorted and filterable by label and formatted description; the
filter's clear action restores the loaded list; description formatting is
shown with links inert; membership updates remain available; and Back returns
from detail to the overview. The list and detail also receive `contentPadding`
from the app shell and use shared physical horizontal and bottom inset helpers.

## Goals and non-goals

**Goals:**

- Give both Circles states a compact single-row title/navigation context after
  scrolling.
- Use one title typography scale for the compact overview and detail rows.
- Keep the filter usable and its value intact through scrolling and detail
  navigation.
- Preserve the existing data, membership, description, error, loading and Back
  behaviour.
- Keep the implementation inside the existing Material 3 and Compose
  dependencies.

**Non-goals:**

- Changing the Android navigation shell, circle API, filtering rules, or
  membership semantics.
- Applying collapsing headers to other app destinations in this slice.
- Introducing a general-purpose shared app-bar abstraction before another
  screen has demonstrated the same need.

## Decisions

### Scope the first slice to both Circles states

The overview and detail are two states of the same screen and share the
requirement that a title and navigation context remain available during
scrolling. Implement and validate both together so entering and leaving detail
does not produce a different header model. Keep the work in `CirclesScreen`
unless implementation reveals a concrete reusable primitive that reduces
duplication without hiding screen-specific behaviour.

### Use the existing Material 3 scroll APIs

Coordinate the expanded content and compact title row with the scroll state of
each screen using the Material 3 top-app-bar APIs already available through the
Compose BOM. Do not add a dependency. The overview's filter remains a real
`LiveFilterField` with its current labels, value, clear action and filtering
rules. It may move with the expanded content as the header collapses; scrolling
must not clear or resubmit its query.

The detail header keeps its artwork and expanded title presentation in the
scrolling content. Its compact row retains the circle label and Back action.
Both compact rows use the same Material typography token for the title.

### Preserve shell layout and interaction contracts

Apply the shell-provided top and bottom padding exactly once, retain physical
left/right inset behaviour in both layout directions, and keep the list/detail
content clear of the system bars and bottom navigation. BackHandler and the
visible Back control continue to return to the overview. Keep controls at
accessible touch sizes and expose meaningful labels and traversal order. Use
theme colours for app-bar surfaces and title content so light and dark themes
remain legible.

## Validation approach

Before implementation, reproduce the tall-header behaviour on the agreed
Android device using the existing anonymous circle journey fixture, and record
the observed screen state. The source baseline is `CirclesScreen.kt`; existing
fixtures in `CirclesJourneyTest`, `CirclesDescriptionFilterJourneyTest`,
`CircleDescriptionJourneyTest`, `SearchControlsJourneyTest`, and
`DesignFixesJourneyTest` cover the relevant journeys and inset paths.

Add focused instrumentation coverage showing that scrolling each Circles state
reaches a compact single-row title; verify overview and detail title typography
matches; verify the filter can still be edited and cleared, formatted
description links remain inert, join/leave and Back still work, and long lists
remain reachable above bottom navigation. Include an inset-aware layout check
in LTR and RTL, accessible Back/filter semantics and touch sizes, and a visual
inspection in light and dark themes. Run only the Android validation assigned
by the repository owner after proposal approval.
