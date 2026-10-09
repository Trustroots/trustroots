# Design: react-map-gl v8 migration

The application uses the Mapbox GL JS v1 renderer, so all map components and
types will import from `react-map-gl/mapbox-legacy`. Replace v5's controller
and viewport abstractions with v8's map event callbacks and controlled camera
state. The custom style switcher will use `useControl` to own a DOM control,
and offer location indicators will use map markers positioned by coordinates.

Preserve the existing tokenless OpenStreetMap style and Leaflet fallback. Do
not add a Mapbox GL version that requires paid tokens for rendering custom
tiles.
