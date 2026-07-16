## Why

The map-search page renders entirely with Mapbox GL and therefore requires
WebGL. When a browser makes WebGL unavailable, members see map controls but an
empty map, despite map search being a core part of finding offers.

## What Changes

- Select a non-WebGL map renderer when the browser cannot create a WebGL
  context, before Mapbox GL is mounted.
- Provide an interactive Leaflet map with OpenStreetMap raster tiles for map
  search, including offer results, Community Notes, selection, and clustered
  results.
- Provide the same non-WebGL fallback for the compact offer-location map.
- Keep Mapbox GL as the renderer for browsers with WebGL support.

## Capabilities

### New Capabilities

- `map-rendering-compatibility`: Render Trustroots maps and their essential
  interactions when WebGL is unavailable.

### Modified Capabilities

- `offers-and-search`: Map search remains available in browsers without
  WebGL.

## Impact

- Affects the core map utility and components, the search map, and the offer
  location component.
- Uses the existing Leaflet dependency and adds `supercluster` as a direct
  dependency for the fallback's client-side clustering.
- No API, data migration, or production configuration change is required.
  The fallback uses the existing OpenStreetMap tile CSP allowance.
