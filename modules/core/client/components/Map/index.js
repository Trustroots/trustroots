// External dependencies
import { debounce } from 'lodash';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';
import ReactMapGL, { NavigationControl, ScaleControl } from 'react-map-gl';

// Internal dependencies
import osmStyle from './osm.json';
import '@/modules/core/client/components/Map/map.less';

export default function Map(props) {
  const MAPBOX_TOKEN = window.settings?.mapbox?.publicKey;
  const MAP_STYLE_MAPBOX_STREETS = 'mapbox://styles/mapbox/streets-v11';
  const MAP_STYLE_OSM = osmStyle;
  const MAP_STYLE_DEFAULT = MAPBOX_TOKEN
    ? MAP_STYLE_MAPBOX_STREETS
    : MAP_STYLE_OSM;

  const {
    children,
    location = [48.6908333333, 9.14055555556], // Default location to Europe when not set
    zoom = 6,
  } = props;

  const { t } = useTranslation('core');

  const [viewport, setViewport] = useState({
    latitude: location[0],
    longitude: location[1],
    zoom,
  });

  useEffect(() => {
    const debouncedHandleResize = debounce(function handleResize() {
      // Re-render map on window resize but preserve location
      const { latitude, longitude, zoom } = viewport;
      setViewport({ latitude, longitude, zoom });
    }, 1000);

    window.addEventListener('resize', debouncedHandleResize);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', debouncedHandleResize);
    };
  });

  return (
    <ReactMapGL
      dragRotate={false}
      height={320}
      mapboxApiAccessToken={MAPBOX_TOKEN}
      mapStyle={MAP_STYLE_DEFAULT}
      onViewportChange={setViewport}
      touchRotate={false}
      width="100%"
      {...props}
      {...viewport}
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
      {children}
    </ReactMapGL>
  );
}

Map.propTypes = {
  children: PropTypes.node,
  location: PropTypes.arrayOf(PropTypes.number),
  zoom: PropTypes.number,
};
