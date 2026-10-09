// External dependencies
import { NavigationControl } from 'react-map-gl/mapbox-legacy';
import React from 'react';

// Internal dependencies
import './map-navigation-control.less';

export default function MapNavigationControl() {
  return (
    <div className="map-navigation-control-container">
      <NavigationControl showCompass={false} />
    </div>
  );
}

MapNavigationControl.propTypes = {};
