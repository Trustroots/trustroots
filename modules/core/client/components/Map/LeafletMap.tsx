// External dependencies
import L from 'leaflet';
import React, { useEffect, useRef } from 'react';

import { getRasterMapTiles } from '../../utils/map';

type Coordinate = [number, number];
type LeafletMapProps = {
  ariaHidden?: boolean;
  className?: string;
  height?: number | string;
  location: Coordinate;
  marker?: { color: string; location: Coordinate } | null;
  onLocationChange?: (location: Coordinate) => void;
  scrollZoom?: boolean;
  width?: number | string;
  zoom?: number;
};

/**
 * Small Leaflet renderer for maps that cannot use WebGL.
 *
 * This intentionally uses raster tiles and native Leaflet controls so it can
 * run in browsers where WebGL is unavailable.
 */
export default function LeafletMap({
  ariaHidden,
  className,
  height = 320,
  location,
  marker,
  onLocationChange,
  scrollZoom = true,
  width = '100%',
  zoom = 6,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const previousZoomRef = useRef(zoom);
  const locationChangeRef = useRef(onLocationChange);
  locationChangeRef.current = onLocationChange;

  useEffect(() => {
    const map = L.map(containerRef.current as HTMLDivElement, {
      scrollWheelZoom: scrollZoom,
      zoomControl: true,
    }).setView(location, zoom);

    const tiles = getRasterMapTiles();
    L.tileLayer(tiles.url, tiles.options).addTo(map);

    mapRef.current = map;
    // Tabs can initialise the map while hidden. Recalculate tile positions
    // when the editor becomes visible or its responsive container changes.
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => map.invalidateSize({ animate: false }));
    resizeObserver?.observe(containerRef.current as HTMLDivElement);
    let hasDragged = false;
    map.on('dragstart', () => {
      hasDragged = true;
    });
    map.on('moveend', () => {
      // Include inertial movement after the pointer is released, without
      // choosing locations during zooms or programmatic viewport changes.
      if (hasDragged && locationChangeRef.current) {
        const centre = map.getCenter();
        locationChangeRef.current([centre.lat, centre.lng]);
      }
      hasDragged = false;
    });
    map.on('click', (event: L.LeafletMouseEvent) => {
      locationChangeRef.current?.([event.latlng.lat, event.latlng.lng]);
    });

    return () => {
      resizeObserver?.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !location) {
      return;
    }

    const current = map.getCenter();
    if (
      current.lat !== location[0] ||
      current.lng !== location[1] ||
      previousZoomRef.current !== zoom
    ) {
      map.setView(
        location,
        previousZoomRef.current !== zoom ? zoom : map.getZoom(),
      );
    }
    previousZoomRef.current = zoom;
  }, [location, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !marker?.location) {
      return;
    }

    markerRef.current?.remove();
    markerRef.current = L.circleMarker(marker.location, {
      color: marker.color,
      fillColor: marker.color,
      fillOpacity: 1,
      radius: 12,
      weight: 2,
    }).addTo(map);

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [marker]);

  return (
    <div
      aria-hidden={ariaHidden}
      className={className}
      data-testid="leaflet-map"
      ref={containerRef}
      style={{ height, width }}
    />
  );
}
