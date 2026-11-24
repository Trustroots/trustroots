# Unify maps on MapLibre GL with OpenFreeMap

## Why

Maps ran on two renderers, Mapbox GL with a Mapbox token and a Leaflet raster fallback, each with its own per-page map code, tests and styles. The main renderer depended on a paid token.

## What Changes

- Render search, offer-location, profile and circle maps with MapLibre GL through `@vis.gl/react-maplibre`, using the OpenFreeMap Liberty style. No token is needed.
- Put both renderers behind one map component (points with clusters, pins, popups, bounds and an approximate-area circle), so pages hold no renderer-specific code.
- Without WebGL2, load a Leaflet renderer with OpenStreetMap raster tiles on demand, and record an analytics event without personal data.
- Remove the Streets/Outdoors/Satellite style switcher, which needed Mapbox styles.
- Mapbox geocoding for place search is unchanged.

## Impact

Map search, offer-location editing, profile and circle maps, the CSP tile hosts and the map e2e suite.
