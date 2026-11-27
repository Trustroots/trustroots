## Why

The iOS Search results list still uses SwiftUI. Sharing its presentation in
Compose completes the results surface alongside the existing search controls.

## What changes

- Present nearby offers and loading, empty and retry states in Compose.
- Use the map's active area and filters. Keep MapKit, location, offer requests,
  and host and profile navigation in the native app.
- Exercise the regular iOS journey and record acceptance evidence before rollout.

## Capabilities

### Modified capabilities

- `shared-mobile-build` gains the regular iOS nearby offer results surface.

## Impact

The iOS Search screen and shared Compose UI change. The API and Android Search
entry points retain their existing behaviour.
