# Change: Share iOS place search for offers

## Why

The iOS offer results screen uses a separate native text field, failure message and filter action above the results. Share that presentation and retain the native iOS geocoder and map camera.

## What changes

- Render the place field, failed lookup and filter action in Compose.
- Preserve the typed place when the member switches between Results and Map.
- Keep place lookup, map positioning, offer loading and filter presentation in the existing iOS host.

## Impact

- Affected spec: shared-mobile-build
- Affected code: shared Compose offer search and the regular iOS Search screen
