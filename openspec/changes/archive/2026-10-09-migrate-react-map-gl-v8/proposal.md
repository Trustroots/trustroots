# Migrate the map UI to react-map-gl v8

## Why

The dependency upgrade to react-map-gl v8 removes the v5 entry point and its
custom controller, viewport callback, and overlay APIs. The map components
must use the supported v8 interfaces so production builds, type checks, and
map interactions continue to work.

## What changes

- Migrate search and location maps to the explicit Mapbox legacy entry point,
  which supports the repository's existing mapbox-gl v1 renderer.
- Adapt map state, controls, offer overlays, and wheel handling to v8 APIs.
- Preserve current map search, style selection, location picking, and WebGL
  fallback behaviour.

## Impact

This is an internal compatibility change. Members should retain existing map
features and persisted map locations while the application moves to the
supported package interface.
