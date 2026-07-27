## Context

`SearchMap` and the generic `Map` component use `react-map-gl` and
`mapbox-gl@1.13.2`. Mapbox GL draws its map and all search markers in a WebGL
canvas. When a browser makes that context unavailable, the search shell loads
but the canvas remains blank. The legacy Angular location editors already use
Leaflet and are unaffected.

## Goals / Non-Goals

**Goals:**

- Keep map search and offer-location maps useful when WebGL is unavailable.
- Preserve the normal Mapbox GL experience when WebGL is supported.
- Preserve result fetching, persisted viewport, offer and Community Note
  actions, and clustering in the fallback.
- Detect the capability without identifying or tracking members.

**Non-Goals:**

- Detecting a browser mode or asking members to change browser settings.
- Replacing Mapbox GL for supported browsers.
- Giving the fallback Mapbox style switching, 3D rendering, or hover effects.

## Decisions

### Choose by WebGL capability before mounting Mapbox GL

A shared utility will attempt to obtain a `webgl` (or legacy
`experimental-webgl`) context and return false for unavailable, blocked, or
exceptional browser implementations. Components select the renderer from that
result before Mapbox GL creates a canvas. This fixes the actual compatibility
constraint without attempting to identify a browser mode.

An error-event-only fallback was rejected because Mapbox GL may fail before a
usable map instance exists, producing a blank viewport first.

### Use Leaflet and raster OpenStreetMap tiles for the fallback

Leaflet is already a first-class project dependency for location editors and
uses DOM and image tiles rather than WebGL. Its OpenStreetMap layer works with
the current CSP and does not need a Mapbox token. A separate renderer keeps the
WebGL-only Mapbox source/layer API out of the fallback.

Using a newer Mapbox GL release was rejected because Mapbox GL still requires
WebGL. A static image would not preserve navigation or result selection.

When a configured Mapbox token selects Mapbox raster tiles, the Leaflet layer
listens once for `tileerror`. Its first provider error removes that layer and
adds the existing OpenStreetMap raster layer to the same map. This preserves
the current viewport, result markers, and event handlers while avoiding a
blank map when a configured token or Mapbox service fails at runtime.

### Cluster fallback points with Supercluster

The fallback will index the existing GeoJSON result collections using
`supercluster`, then render ordinary Leaflet markers for individual points and
cluster markers for grouped points. Clicking a cluster uses its expansion zoom;
clicking an offer or Community Note invokes the existing callbacks. This keeps
the number of DOM markers bounded and preserves the current interaction model.

`supercluster` is presently transitive through Mapbox GL, so it will be added
as a direct dependency rather than importing an undeclared dependency.

### Keep the compact offer map covered

The only consumer of the generic Mapbox-based `Map` component is the offer
location display. It will select an equivalent Leaflet renderer and show the
offer marker, so all currently shipped Mapbox GL map entry points have a
fallback.

## Risks / Trade-offs

- [Raster tiles have less visual detail and no style switcher] → show the
  fallback only where WebGL cannot run; preserve current Mapbox styles
  elsewhere.
- [Imperative Leaflet lifecycle can leak maps or event handlers] → initialise
  once per container and remove the map and handlers during React cleanup.
- [Fallback tiles are external network requests] → use the existing
  OpenStreetMap CSP source and deterministic local tile routes in end-to-end
  tests.
- [Map data changes while moving] → rebuild the small, bounded marker layer
  from the current feature collection and viewport on each relevant change.

## Migration Plan

1. Deploy with the capability gate and fallback renderer.
2. Verify an iPhone browser without WebGL and a normal Safari control case
   before and after deployment.
3. If an unexpected regression is found, revert the client-only change; no
   data or server migration is involved.

## Open Questions

None. The capability gate intentionally treats all missing WebGL support the
same way.
