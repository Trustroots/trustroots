// External dependencies
import { NavigationControl } from 'react-map-gl';
import React from 'react';

// Internal dependencies
import './map-navigation-control.less';

export default function MapNavigationControl() {

  return (
    <div className="map-navigation-control-container">
      <NavigationControl
        showCompass={false}
        zoomInLabel={'Zoom in'}
        zoomOutLabel={'Zoom out'}
      />
    </div>
  );
}

MapNavigationControl.propTypes = {};
