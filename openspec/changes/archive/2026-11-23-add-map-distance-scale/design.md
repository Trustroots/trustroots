## Context

Mapbox already provides a metric scale. Leaflet has an equivalent control. The native maps expose their projection so the app can show metric units independently of device preferences.

## Goals / Non-Goals

Show the distance represented by the bar at the current zoom. Walking routes are outside this change.

## Decisions

Use the built-in web controls. Measure the distance between two projected screen points on the native maps, then draw a bar for a rounded metric distance.

## Risks / Trade-offs

Distances are measured near the map centre and vary over the viewport.
