# Improve Android map browsing

## Why

Issue #3683 reports that Android map filters are hard to discover and a current-area results list is missing. The six-month activity default already exists and should remain explicit and covered.

## What Changes

- Expand map filters initially, retain an accessible collapse action and arrange controls in wrapping rows.
- Preserve the six-month last-active default and existing filter semantics.
- Add an offers list for the current map area, using existing offer details and navigation. Keep the viewport and filters when switching views or inspecting an offer.
- Show loading, empty and retry states, and respect session invalidation.

## Impact

- Affected code: native Android host map controls, a current-area results composable and Android journeys.
- No backend contract, permission, data migration, dependency or deployment changes.
- Existing map markers, host/meeting filters and host-detail navigation remain compatible. Community notes remain available on the map.
