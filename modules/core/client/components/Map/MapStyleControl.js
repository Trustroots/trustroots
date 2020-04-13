// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import { DropdownButton, MenuItem, ButtonGroup } from 'react-bootstrap';

// Internal dependencies
import {
  getMapboxToken,
  MAP_STYLE_MAPBOX_STREETS,
  MAP_STYLE_MAPBOX_SATELLITE,
  MAP_STYLE_MAPBOX_OUTDOORS,
  MAP_STYLE_OSM,
} from './constants';
import MapIcon from './MapIcon';

export default function MapStyleControl({ mapStyle, setMapstyle }) {
  const { t } = useTranslation('core');
  const mapboxToken = getMapboxToken();

  const mapboxStyleNames = {};
  mapboxStyleNames[MAP_STYLE_MAPBOX_STREETS] = t('Streets');
  mapboxStyleNames[MAP_STYLE_MAPBOX_SATELLITE] = t('Satellite');
  mapboxStyleNames[MAP_STYLE_MAPBOX_OUTDOORS] = t('Outdoors');

  // If it's an object, it'll have a name. Otherwise it's Mapbox URL in string presentation.
  const selectedStyle = mapStyle?.name || mapStyle;

  return (
    <ButtonGroup aria-label={t('Map style')}>
      <DropdownButton
        dropup
        noCaret
        title={
          <>
            <MapIcon
              mapboxStyle={
                selectedStyle !== MAP_STYLE_OSM.name ? selectedStyle : false
              }
              mapboxToken={mapboxToken}
            />
            {mapStyle?.name || mapboxStyleNames[mapStyle]}
          </>
        }
        id="map-style-picker"
      >
        {[
          MAP_STYLE_MAPBOX_STREETS,
          MAP_STYLE_MAPBOX_SATELLITE,
          MAP_STYLE_MAPBOX_OUTDOORS,
        ].map(mapboxStyle => (
          <MenuItem
            active={selectedStyle === mapboxStyle}
            disabled={!mapboxToken}
            key={mapboxStyle}
            onClick={() => setMapstyle(mapboxStyle)}
          >
            <MapIcon mapboxStyle={mapboxStyle} mapboxToken={mapboxToken} />
            {mapboxStyleNames[mapboxStyle]}
          </MenuItem>
        ))}
        {process.env.NODE_ENV !== 'production' && (
          <MenuItem
            active={selectedStyle === MAP_STYLE_OSM.name}
            key={MAP_STYLE_OSM.name}
            onClick={() => setMapstyle(MAP_STYLE_OSM)}
          >
            <MapIcon />
            {MAP_STYLE_OSM.name}
          </MenuItem>
        )}
      </DropdownButton>
    </ButtonGroup>
  );
}

MapStyleControl.propTypes = {
  mapStyle: PropTypes.string.isRequired,
  setMapstyle: PropTypes.func.isRequired,
};
