// External dependencies
import '@/node_modules/mapbox-gl/dist/mapbox-gl.css';
// import { NavigationControl, ScaleControl } from 'react-map-gl';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import ReactMapGL, { NavigationControl, ScaleControl } from 'react-map-gl';
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';

// Internal dependencies
import osmStyle from './osm.json';

export default function Map(props) {
  const MAPBOX_TOKEN = window.settings?.mapbox?.publicKey;
  const MAP_STYLE_MAPBOX_STREETS = 'mapbox://styles/mapbox/streets-v11';
  const MAP_STYLE_MAPBOX_SATELLITE =
    'mapbox://styles/mapbox/satellite-streets-v11';
  const MAP_STYLE_MAPBOX_OUTDOORS = 'mapbox://styles/mapbox/outdoors-v11';
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

  // Set default map style here
  const [mapStyle, setMapstyle] = useState(MAP_STYLE_DEFAULT);

  const showMapStyleSelector =
    MAPBOX_TOKEN || process.env.NODE_ENV !== 'production';

  return (
    <ReactMapGL
      dragRotate={false}
      height={320}
      mapboxApiAccessToken={MAPBOX_TOKEN}
      mapStyle={mapStyle}
      onViewportChange={setViewport}
      touchRotate={false}
      width="100%"
      {...props}
      {...viewport}
    >
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 5 }}>
        <NavigationControl
          showCompass={false}
          zoomInLabel={t('Zoom in')}
          zoomOutLabel={t('Zoom out')}
        />
      </div>
      <div style={{ position: 'absolute', bottom: 10, right: 50 }}>
        <ScaleControl />
      </div>
      {showMapStyleSelector && (
        <div
          className="btn-group-vertical btn-group-xs"
          role="group"
          aria-label={t('Map style')}
          style={{ position: 'absolute', top: 10, left: 10, zIndex: 5 }}
        >
          <button
            className={classnames('btn btn-default', {
              'btn-primary': mapStyle === MAP_STYLE_MAPBOX_STREETS,
            })}
            disabled={!MAPBOX_TOKEN}
            onClick={() => setMapstyle(MAP_STYLE_MAPBOX_STREETS)}
          >
            {t('Streets')}
          </button>
          <button
            className={classnames('btn btn-default', {
              'btn-primary': mapStyle === MAP_STYLE_MAPBOX_SATELLITE,
            })}
            disabled={!MAPBOX_TOKEN}
            onClick={() => setMapstyle(MAP_STYLE_MAPBOX_SATELLITE)}
          >
            {t('Satellite')}
          </button>
          <button
            className={classnames('btn btn-default', {
              'btn-primary': mapStyle === MAP_STYLE_MAPBOX_OUTDOORS,
            })}
            disabled={!MAPBOX_TOKEN}
            onClick={() => setMapstyle(MAP_STYLE_MAPBOX_OUTDOORS)}
          >
            {t('Outdoors')}
          </button>
          {process.env.NODE_ENV !== 'production' && (
            <button
              className={classnames('btn btn-default', {
                'btn-primary': mapStyle === MAP_STYLE_OSM,
              })}
              onClick={() => setMapstyle(MAP_STYLE_OSM)}
            >
              OSM
            </button>
          )}
        </div>
      )}
      {children}
    </ReactMapGL>
  );
}

Map.propTypes = {
  children: PropTypes.node,
  location: PropTypes.arrayOf(PropTypes.number),
  zoom: PropTypes.number,
  onMapViewPortChange: PropTypes.func,
};
