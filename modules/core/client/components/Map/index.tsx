// External dependencies
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import ReactMapGL from 'react-map-gl';

// Internal dependencies
import './map.less';
import { MAP_STYLE_DEFAULT, MAP_STYLE_OSM } from './constants';
import MapNavigationControl from './MapNavigationControl';
import MapScaleControl from './MapScaleControl';
import MapStyleControl from './MapStyleControl';
import LeafletMap from './LeafletMap';
import WheelMapController from './WheelMapController';
import { getMapBoxToken, isWebGLSupported } from '../../utils/map';

type MapProps = React.ComponentProps<typeof ReactMapGL> & {
  'aria-hidden'?: boolean;
  fallbackMarker?: { color: string; location: [number, number] };
  location?: [number, number];
  onLocationChange?: (location: [number, number]) => void;
  showMapStyles?: boolean;
};
export default function Map(props: MapProps) {
  const {
    children,
    fallbackMarker,
    onLocationChange,
    location = [48.6908333333, 9.14055555556], // Default location to Europe when not set
    zoom = 6,
    ...overrideProps // anything else will be passed down to <ReactMapGL> as props
  } = props;

  const [mapStyle, setMapstyle] = useState<string | typeof MAP_STYLE_OSM>(
    MAP_STYLE_DEFAULT,
  );
  const [mapController] = useState(() => new WheelMapController());
  const [viewport, setViewport] = useState({
    latitude: location[0],
    longitude: location[1],
    zoom,
  });
  useEffect(() => {
    setViewport(current => ({
      ...current,
      latitude: location[0],
      longitude: location[1],
    }));
  }, [location[0], location[1]]);

  function handleViewportChange(nextViewport: {
    latitude: number;
    longitude: number;
    zoom: number;
  }) {
    setViewport(nextViewport);
    if (onLocationChange) {
      onLocationChange([nextViewport.latitude, nextViewport.longitude]);
    }
  }
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
        onLocationChange={onLocationChange}
        scrollZoom={props.scrollZoom as boolean | undefined}
        width={props.width || '100%'}
        zoom={zoom}
      />
    );
  }

  return (
    <ReactMapGL
      reuseMaps
      controller={mapController}
      dragRotate={false}
      height={320}
      mapboxApiAccessToken={MAPBOX_TOKEN as string}
      mapStyle={mapStyle}
      onViewportChange={handleViewportChange}
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
  onLocationChange: PropTypes.func,
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  scrollZoom: PropTypes.bool,
  showMapStyles: PropTypes.bool,
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  zoom: PropTypes.number,
};
