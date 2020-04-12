// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import ReactMapGL, { NavigationControl, ScaleControl } from 'react-map-gl';

// Internal dependencies
import MapStyleControl from './MapStyleControl';
import '@/modules/core/client/components/Map/map.less';
import {
  getMapboxToken,
  MAP_STYLE_MAPBOX_STREETS,
  MAP_STYLE_OSM,
} from './constants';

export default function Map(props) {
  const mapboxToken = getMapboxToken();
  const defaultStyle = mapboxToken ? MAP_STYLE_MAPBOX_STREETS : MAP_STYLE_OSM;
  const showMapStyles =
    props.showMapStyles &&
    (!!mapboxToken || process.env.NODE_ENV !== 'production');

  const {
    children,
    location = [48.6908333333, 9.14055555556], // Default location to Europe when not set
    zoom = 6,
    ...overrideProps // anything else will be passed down to <ReactMapGL> as props
  } = props;

  const { t } = useTranslation('core');

  const [mapStyle, setMapstyle] = useState(defaultStyle);
  const [viewport, setViewport] = useState({
    latitude: location[0],
    longitude: location[1],
    zoom,
  });

  return (
    <ReactMapGL
      dragRotate={false}
      height={320}
      mapboxApiAccessToken={mapboxToken}
      mapStyle={mapStyle}
      onViewportChange={setViewport}
      touchRotate={false}
      {...viewport}
      width={
        '100%' /* this must come after viewport, or width gets set to fixed size via onViewportChange */
      }
      {...overrideProps}
    >
      <div className="map-navigation-control-container">
        <NavigationControl
          showCompass={false}
          zoomInLabel={t('Zoom in')}
          zoomOutLabel={t('Zoom out')}
        />
      </div>
      <div className="map-scale-control-container">
        <ScaleControl />
      </div>
      {showMapStyles && (
        <div className="map-style-control-container">
          <MapStyleControl mapStyle={mapStyle} setMapstyle={setMapstyle} />
        </div>
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
