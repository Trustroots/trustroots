import { ScaleControl } from 'react-map-gl/mapbox';
import React from 'react';

export default function MapScaleControl({
  showMapStyles = false,
}: {
  showMapStyles?: boolean;
}) {
  return (
    <ScaleControl
      position="bottom-left"
      maxWidth={100}
      unit="metric"
      style={showMapStyles ? { marginBottom: 62 } : undefined}
    />
  );
}
