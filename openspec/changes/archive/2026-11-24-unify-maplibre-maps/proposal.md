# Unify maps on MapLibre GL with OpenFreeMap

## Why

Maps ran on two renderers: Mapbox GL with a Mapbox token, and a Leaflet raster fallback without one or without WebGL2. Keeping both doubled the map code, tests and styles, and the main renderer depended on a paid token.

## What Changes

- Render search, offer-location, profile and circle maps with MapLibre GL through `@vis.gl/react-maplibre`, using the OpenFreeMap Liberty style. No token is needed.
- Remove the Leaflet renderer, its raster tile sources and the Streets/Outdoors/Satellite style switcher, which needed Mapbox styles.
- Without WebGL2, show a short notice where the map would be.
- Mapbox geocoding for place search is unchanged.

## Impact

Map search, offer-location editing, profile and circle maps, the CSP tile hosts and the map e2e suite.
