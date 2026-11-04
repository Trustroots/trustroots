## 1. Compatibility foundation

- [x] 1.1 Add and test a shared, exception-safe WebGL capability check
- [x] 1.2 Add `supercluster` as a direct client dependency and refresh the
      lockfile
- [x] 1.3 Add a reusable Leaflet raster-map lifecycle component and styles

## 2. Map fallbacks

- [x] 2.1 Add a Leaflet search-map renderer with persisted viewport and map
      bounds result fetching
- [x] 2.2 Render and expand clustered offer results and open selected offers
      in the fallback
- [x] 2.3 Render and open Community Notes in the fallback
- [x] 2.4 Render an offer-location marker with Leaflet when WebGL is
      unavailable

## 3. Verification

- [x] 3.1 Add client tests for the capability gate and fallback interactions
- [x] 3.2 Add end-to-end coverage that blocks WebGL and verifies a visible,
      interactive fallback map
- [ ] 3.3 Run targeted client and end-to-end tests, then the relevant coverage
      checks
- [ ] 3.4 Validate on an iPhone without WebGL and a normal-Safari control
      case
- [ ] 3.5 Add and verify one-shot Mapbox-raster to OpenStreetMap runtime
      failover coverage
