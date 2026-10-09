// External dependencies
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React, { useState } from 'react';

// Internal dependencies
import {
  MAP_STYLE_MAPBOX_STREETS,
  MAP_STYLE_MAPBOX_SATELLITE,
  MAP_STYLE_MAPBOX_OUTDOORS,
  MAP_STYLE_OSM,
} from './constants';
import { getMapBoxToken } from '../../utils/map';
import MapIcon from './MapIcon';
import MapStyleButton from './MapStyleButton';
import './map-style-control.less';

type MapStyle = string | { name: string; [key: string]: unknown };
type MapStyleControlProps = {
  mapStyle: MapStyle;
  setMapstyle: (style: string | typeof MAP_STYLE_OSM) => void;
};

export default function MapStyleControl({
  mapStyle,
  setMapstyle,
}: MapStyleControlProps) {
  const { t } = useTranslation(['core']) as { t: TFunction };
  const [isOpen, setIsOpen] = useState(false);
  const MAPBOX_TOKEN = getMapBoxToken();

  const mapboxStyleNames: Record<string, string> = {
    [MAP_STYLE_MAPBOX_STREETS]: t('Streets'),
    [MAP_STYLE_MAPBOX_SATELLITE]: t('Satellite'),
    [MAP_STYLE_MAPBOX_OUTDOORS]: t('Outdoors'),
  };
  const selectedStyle = typeof mapStyle === 'string' ? mapStyle : mapStyle.name;

  return (
    <div
      className="map-style-control-container"
      onMouseEnter={() => setIsOpen(true)}
    >
      {!isOpen && (
        <button
          aria-expanded={isOpen}
          aria-haspopup="true"
          className="btn"
          onClick={() => setIsOpen(true)}
          aria-label={t('Change map style')}
          type="button"
        >
          <MapIcon
            mapboxStyle={
              selectedStyle !== MAP_STYLE_OSM.name ? selectedStyle : ''
            }
          />
          {typeof mapStyle === 'string'
            ? mapboxStyleNames[mapStyle]
            : mapStyle.name}
        </button>
      )}
      {isOpen && (
        <div
          className="btn-group-vertical"
          onMouseLeave={() => setIsOpen(false)}
          role="group"
        >
          {[
            MAP_STYLE_MAPBOX_STREETS,
            MAP_STYLE_MAPBOX_OUTDOORS,
            MAP_STYLE_MAPBOX_SATELLITE,
          ].map(mapboxStyle => (
            <MapStyleButton
              disabled={!MAPBOX_TOKEN}
              key={mapboxStyle}
              label={mapboxStyleNames[mapboxStyle]}
              onClick={() => {
                setIsOpen(false);
                setMapstyle(mapboxStyle);
              }}
              selectedStyle={selectedStyle}
              style={mapboxStyle}
              styleName={mapboxStyle}
              iconStyle={mapboxStyle}
            />
          ))}
          {process.env.NODE_ENV !== 'production' && (
            <MapStyleButton
              label={MAP_STYLE_OSM.name}
              key={MAP_STYLE_OSM.name}
              onClick={() => {
                setIsOpen(false);
                setMapstyle(MAP_STYLE_OSM);
              }}
              selectedStyle={selectedStyle}
              styleName={MAP_STYLE_OSM.name}
            />
          )}
        </div>
      )}
    </div>
  );
}

MapStyleControl.propTypes = {
  mapStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.string])
    .isRequired,
  setMapstyle: PropTypes.func.isRequired,
};
