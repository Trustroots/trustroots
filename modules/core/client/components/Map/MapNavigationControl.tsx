// External dependencies
import { useMap } from 'react-map-gl/mapbox';
import { useTranslation } from 'react-i18next';
import React from 'react';

// Internal dependencies
import './map-navigation-control.less';

export default function MapNavigationControl() {
  const { t } = useTranslation('core');
  const { current: map } = useMap();

  return (
    <div
      className="map-navigation-control-container"
      role="presentation"
      onMouseDown={event => event.stopPropagation()}
      onDoubleClick={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}
    >
      <div className="mapboxgl-ctrl mapboxgl-ctrl-group">
        <button
          type="button"
          className="mapboxgl-ctrl-zoom-in"
          aria-label={t<string>('Zoom in')}
          onClick={() => map?.zoomIn()}
        >
          <span className="mapboxgl-ctrl-icon" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="mapboxgl-ctrl-zoom-out"
          aria-label={t<string>('Zoom out')}
          onClick={() => map?.zoomOut()}
        >
          <span className="mapboxgl-ctrl-icon" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
