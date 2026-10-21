// External dependencies
import { ScaleControl } from 'react-map-gl/mapbox';
import React from 'react';

// Internal dependencies
import './map-scale-control.less';

export default function MapScaleControl() {
  return (
    <div className="map-scale-control-container">
      <ScaleControl position="bottom-left" maxWidth={100} unit="metric" />
    </div>
  );
}
