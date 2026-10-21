// External dependencies
import { useMap, type MapRef } from 'react-map-gl/mapbox';
import type { TFunction } from 'i18next';
import { withTranslation } from 'react-i18next';
import React from 'react';

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
  t: TFunction;
  map?: MapRef;
};
type MapStyleControlState = { isOpen: boolean };

class MapStyleControl extends React.Component<
  MapStyleControlProps,
  MapStyleControlState
> {
  constructor(props: MapStyleControlProps) {
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

  render() {
    const { t, mapStyle, setMapstyle } = this.props;
    const { isOpen } = this.state as MapStyleControlState;
    const MAPBOX_TOKEN = getMapBoxToken();

    const mapboxStyleNames: Record<string, string> = {};
    mapboxStyleNames[MAP_STYLE_MAPBOX_STREETS] = t('Streets');
    mapboxStyleNames[MAP_STYLE_MAPBOX_SATELLITE] = t('Satellite');
    mapboxStyleNames[MAP_STYLE_MAPBOX_OUTDOORS] = t('Outdoors');

    // If it's an object, it'll have a name. Otherwise it's Mapbox URL in string presentation.
    const selectedStyle =
      typeof mapStyle === 'string' ? mapStyle : mapStyle.name;

    return (
      <div
        className="map-style-control-container"
        role="presentation"
        onMouseDown={event => event.stopPropagation()}
        onDoubleClick={event => event.stopPropagation()}
        onClick={event => event.stopPropagation()}
      >
        {!isOpen && (
          <button
            aria-expanded={isOpen}
            aria-haspopup="true"
            className="btn"
            onClick={this.open}
            onMouseEnter={() => !this.props.map?.isMoving() && this.open()}
            aria-label={t('Change map style')}
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
            onMouseLeave={this.close}
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
                  this.close();
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
                  this.close();
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
}

function MapStyleControlWithMap(props: Omit<MapStyleControlProps, 'map'>) {
  const { current: map } = useMap();
  return <MapStyleControl {...props} map={map} />;
}

export default withTranslation(['core'])(MapStyleControlWithMap);
