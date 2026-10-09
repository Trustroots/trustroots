// External dependencies
import { Marker, useMap } from 'react-map-gl/mapbox-legacy';
import React, { useEffect, useState } from 'react';

// Internal dependencies
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
  const maps = useMap();
  const [zoom, setZoom] = useState(0);

  useEffect(() => {
    const map = maps.current?.getMap();
    if (!map) return undefined;

    const updateZoom = () => setZoom(map.getZoom());
    updateZoom();
    map.on('zoom', updateZoom);
    return () => {
      map.off('zoom', updateZoom);
    };
  }, [maps]);

  const [latitude, longitude] = location;
  const circleRadius =
    zoom >= 11 ? zoomToPixelMeters({ latitude, meters: 1000, zoom }) : 12;
  const circleStyle =
    zoom >= 11
      ? {
          backgroundColor: 'rgba(177, 177, 177, 0.5)',
          border: '2px solid #989898',
        }
      : { backgroundColor: getOfferHexColor({ offerType, offerStatus }) };

  return (
    <Marker
      latitude={latitude}
      longitude={longitude}
      anchor="center"
      style={{ pointerEvents: 'none' }}
    >
      <span
        aria-hidden="true"
        style={{
          ...circleStyle,
          borderRadius: '50%',
          display: 'block',
          height: circleRadius * 2,
          pointerEvents: 'none',
          width: circleRadius * 2,
        }}
      />
    </Marker>
  );
}
