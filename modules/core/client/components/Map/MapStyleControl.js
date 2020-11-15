// External dependencies
import { BaseControl } from 'react-map-gl';
import { withTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import classnames from 'classnames';

// Internal dependencies
import {
  MAP_STYLE_MAPBOX_STREETS,
  MAP_STYLE_MAPBOX_SATELLITE,
  MAP_STYLE_MAPBOX_OUTDOORS,
  MAP_STYLE_OSM,
} from './constants';
import { getMapBoxToken } from '../../utils/map';
import MapIcon from './MapIcon';
import './map-style-control.less';

class MapStyleControl extends BaseControl {
  constructor(props) {
    super(props);
    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.state = {
      isOpen: false,
    };
  }

  open() {
    this.setState({ isOpen: true });
  }

  close() {
    this.setState({ isOpen: false });
  }

  _render() {
    const { t, mapStyle, setMapstyle } = this.props;
    const { isOpen } = this.state;
    const MAPBOX_TOKEN = getMapBoxToken();

    const mapboxStyleNames = {};
    mapboxStyleNames[MAP_STYLE_MAPBOX_STREETS] = t('Streets');
    mapboxStyleNames[MAP_STYLE_MAPBOX_SATELLITE] = t('Satellite');
    mapboxStyleNames[MAP_STYLE_MAPBOX_OUTDOORS] = t('Outdoors');

    // If it's an object, it'll have a name. Otherwise it's Mapbox URL in string presentation.
    const selectedStyle = mapStyle?.name || mapStyle;

    return (
      // _containerRef registers event listeners for map interactions
      <div ref={this._containerRef} className="map-style-control-container">
        {!isOpen && (
          <button
            aria-expanded={isOpen}
            aria-haspopup="true"
            className="btn"
            onClick={this.open}
            onMouseEnter={() => !this._context.isDragging && this.open()}
            aria-label={t('Change map style')}
          >
            <MapIcon
              mapboxStyle={
                selectedStyle !== MAP_STYLE_OSM.name ? selectedStyle : ''
              }
            />
            {mapStyle?.name || mapboxStyleNames[mapStyle]}
          </button>
        )}
        {isOpen && (
          <div
            className="btn-group-vertical"
            onMouseLeave={this.close}
            role="group"
          >
            {[
              MAP_STYLE_MAPBOX_STREETS,
              MAP_STYLE_MAPBOX_OUTDOORS,
              MAP_STYLE_MAPBOX_SATELLITE,
            ].map(mapboxStyle => (
              <button
                className={classnames('btn', 'btn-default', {
                  'is-active': selectedStyle === mapboxStyle,
                })}
                disabled={!MAPBOX_TOKEN}
                key={mapboxStyle}
                onClick={() => {
                  this.close();
                  setMapstyle(mapboxStyle);
                }}
                type="button"
              >
                <MapIcon mapboxStyle={mapboxStyle} />
                {mapboxStyleNames[mapboxStyle]}
              </button>
            ))}
            {process.env.NODE_ENV !== 'production' && (
              <button
                className={classnames('btn', 'btn-default', {
                  'is-active': selectedStyle === MAP_STYLE_OSM.name,
                })}
                key={MAP_STYLE_OSM.name}
                onClick={() => {
                  this.close();
                  setMapstyle(MAP_STYLE_OSM);
                }}
                type="button"
              >
                <MapIcon />
                {MAP_STYLE_OSM.name}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
}

MapStyleControl.propTypes = {
  mapStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.string])
    .isRequired,
  setMapstyle: PropTypes.func.isRequired,
};

export default withTranslation(['core'])(MapStyleControl);
