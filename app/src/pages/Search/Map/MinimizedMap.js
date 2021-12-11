// External dependencies
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import ReactMapGL from 'react-map-gl';

// Internal dependencies
import './map.less';
import { MAP_STYLE_DEFAULT } from './lib/constants';
import MapNavigationControl from './MapNavigationControl';
import MapScaleControl from './MapScaleControl';
import { getMapBoxToken } from './utils';

export default function Map(props) {
  const {
    children,
    location = [48.6908333333, 9.14055555556], // Default location to Europe when not set
    zoom = 6,
    ...overrideProps // anything else will be passed down to <ReactMapGL> as props
  } = props;

  const [viewport, setViewport] = useState({
    latitude: location[0],
    longitude: location[1],
    zoom,
  });
  const MAPBOX_TOKEN = getMapBoxToken();

  return (
    <ReactMapGL
      dragRotate={false}
      height={320}
      mapboxApiAccessToken={MAPBOX_TOKEN}
      mapStyle={MAP_STYLE_DEFAULT}
      onViewportChange={setViewport}
      touchRotate={false}
      {...viewport}
      width={
        '100%' /* this must come after viewport, or width gets set to fixed size via onViewportChange */
      }
      {...overrideProps}
    >
      <MapNavigationControl />
      <MapScaleControl />
      {children}
    </ReactMapGL>
  );
}

Map.propTypes = {
  children: PropTypes.node,
  location: PropTypes.arrayOf(PropTypes.number),
  showMapStyles: PropTypes.bool,
  zoom: PropTypes.number,
};
