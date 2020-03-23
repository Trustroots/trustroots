// External dependencies
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import {
  MAPBOX_TOKEN,
  MAP_STYLE_MAPBOX_STREETS,
  MAP_STYLE_MAPBOX_SATELLITE,
  MAP_STYLE_MAPBOX_OUTDOORS,
  MAP_STYLE_OSM,
} from './constants';

/**
 * The main LanguageSwitch component.
 * @param {'dropdown'|'select'} presentation - should we show dropdown (header), or select (account) selector?
 * @param {Boolean} [saveToAPI=false] - should we save selected language to API?
 */
export default function MapStyleControl({ mapStyle, setMapstyle }) {
  const { t } = useTranslation('core');

  return (
    <div
      className="btn-group-vertical btn-group-xs"
      role="group"
      aria-label={t('Map style')}
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
  );
}

MapStyleControl.propTypes = {
  mapStyle: PropTypes.string.isRequired,
  setMapstyle: PropTypes.func.isRequired,
};
