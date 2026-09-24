// External dependencies
import L from 'leaflet';
import PropTypes from 'prop-types';
import React, { useEffect, useRef } from 'react';

import { getRasterMapTiles } from '../../utils/map';

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
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const previousZoomRef = useRef(zoom);
  const locationChangeRef = useRef(onLocationChange);
  locationChangeRef.current = onLocationChange;

  useEffect(() => {
    const map = L.map(containerRef.current, {
      scrollWheelZoom: scrollZoom,
      zoomControl: true,
    }).setView(location, zoom);

    const tiles = getRasterMapTiles();
    L.tileLayer(tiles.url, tiles.options).addTo(map);

    mapRef.current = map;
    map.on('dragend', () => {
      if (locationChangeRef.current) {
        const centre = map.getCenter();
        locationChangeRef.current([centre.lat, centre.lng]);
      }
    });

    return () => {
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

LeafletMap.propTypes = {
  onLocationChange: PropTypes.func,
  ariaHidden: PropTypes.bool,
  className: PropTypes.string,
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  location: PropTypes.arrayOf(PropTypes.number).isRequired,
  marker: PropTypes.shape({
    color: PropTypes.string.isRequired,
    location: PropTypes.arrayOf(PropTypes.number).isRequired,
  }),
  scrollZoom: PropTypes.bool,
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  zoom: PropTypes.number,
};
