// External dependencies
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import ReactMapGL from 'react-map-gl';

// Internal dependencies
import './map.less';
import { MAP_STYLE_DEFAULT } from './constants';
import MapNavigationControl from './MapNavigationControl';
import MapScaleControl from './MapScaleControl';
import MapStyleControl from './MapStyleControl';
import { getMapBoxToken } from '../../utils/map';

export default function Map(props) {
  const {
    children,
    location = [48.6908333333, 9.14055555556], // Default location to Europe when not set
    zoom = 6,
    ...overrideProps // anything else will be passed down to <ReactMapGL> as props
  } = props;

  const [mapStyle, setMapstyle] = useState(MAP_STYLE_DEFAULT);
  const [viewport, setViewport] = useState({
    latitude: location[0],
    longitude: location[1],
    zoom,
  });
  const MAPBOX_TOKEN = getMapBoxToken();
  const showMapStyles =
    props.showMapStyles &&
    (!!MAPBOX_TOKEN || process.env.NODE_ENV !== 'production');

  return (
    <ReactMapGL
      dragRotate={false}
      height={320}
      mapboxApiAccessToken={MAPBOX_TOKEN}
      mapStyle={mapStyle}
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
      {showMapStyles && (
        <MapStyleControl mapStyle={mapStyle} setMapstyle={setMapstyle} />
      )}
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
