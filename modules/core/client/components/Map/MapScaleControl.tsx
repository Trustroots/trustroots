// External dependencies
import { ScaleControl } from 'react-map-gl';
import React from 'react';

// Internal dependencies
import './map-scale-control.less';

export default function MapScaleControl() {
  return (
    <div className="map-scale-control-container">
      <ScaleControl />
    </div>
  );
}

MapScaleControl.propTypes = {};
