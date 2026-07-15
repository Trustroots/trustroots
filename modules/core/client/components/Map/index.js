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
import LeafletMap from './LeafletMap';
import { getMapBoxToken, isWebGLSupported } from '../../utils/map';

export default function Map(props) {
  const {
    children,
    fallbackMarker,
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

  if (!isWebGLSupported()) {
    return (
      <LeafletMap
        ariaHidden={props['aria-hidden']}
        className={props.className}
        height={props.height || 320}
        location={location}
        marker={fallbackMarker}
        scrollZoom={props.scrollZoom}
        width={props.width || '100%'}
        zoom={zoom}
      />
    );
  }

  return (
    <ReactMapGL
      reuseMaps
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
  'aria-hidden': PropTypes.bool,
  children: PropTypes.node,
  className: PropTypes.string,
  fallbackMarker: PropTypes.shape({
    color: PropTypes.string.isRequired,
    location: PropTypes.arrayOf(PropTypes.number).isRequired,
  }),
  location: PropTypes.arrayOf(PropTypes.number),
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  scrollZoom: PropTypes.bool,
  showMapStyles: PropTypes.bool,
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  zoom: PropTypes.number,
};
