## Why

The Mapbox GL JS v3 dependency update leaves React Map GL v5 using its own
Mapbox v1 dependency. Trustroots needs one Mapbox renderer version, with its
React integration, stylesheet and TypeScript definitions aligned.

## What Changes

- Upgrade the React map integration to the v8 Mapbox entry point and use the
  existing direct Mapbox GL JS v3 dependency throughout.
- Replace legacy viewport, control and overlay APIs while preserving map
  styles, offer selection, community notes, clustering and location editing.
- Select the existing Leaflet raster renderer when WebGL2 is unavailable.
- Remove the redundant external Mapbox type package and legacy controller.

## Capabilities

### Modified Capabilities

- `map-rendering-compatibility`: Align the WebGL renderer and its React
  integration and retain essential interactions without WebGL2.

## Impact

Changes core map components, search maps and offer-location overlays. The
client uses one Mapbox version and its bundled types. No server API, database
migration or new production configuration is required. Existing map styles
and raster providers remain in use.
