import React, { useEffect, useState } from 'react';
import { Marker, useMap } from 'react-map-gl/mapbox';

import { getOfferHexColor, zoomToPixelMeters } from '../utils/markers.js';

interface OfferLocationOverlayProps {
  location: [number, number];
  offerStatus?: string;
  offerType?: string;
}

export default function OfferLocationOverlay({
  location,
  offerType,
  offerStatus,
}: OfferLocationOverlayProps) {
  const { current: map } = useMap();
  const [zoom, setZoom] = useState(() => map?.getZoom() ?? 0);

  useEffect(() => {
    if (!map) return;
    const updateZoom = () => setZoom(map.getZoom());
    updateZoom();
    map.on('zoom', updateZoom);
    return () => {
      map.off('zoom', updateZoom);
    };
  }, [map]);

  const [latitude, longitude] = location;
  const detailed = zoom >= 11;
  const radius = detailed
    ? zoomToPixelMeters({ latitude, meters: 1000, zoom })
    : 12;
  const diameter = radius * 2;

  return (
    <Marker
      latitude={latitude}
      longitude={longitude}
      anchor="center"
      style={{ pointerEvents: 'none' }}
    >
      <svg
        width={diameter}
        height={diameter}
        style={{ overflow: 'visible', pointerEvents: 'none' }}
        aria-hidden="true"
      >
        <circle
          cx={radius}
          cy={radius}
          r={radius}
          style={
            detailed
              ? {
                  fill: '#b1b1b1',
                  fillOpacity: '0.5',
                  stroke: '#989898',
                  strokeWidth: '2px',
                }
              : { fill: getOfferHexColor({ offerType, offerStatus }) }
          }
        />
      </svg>
    </Marker>
  );
}
