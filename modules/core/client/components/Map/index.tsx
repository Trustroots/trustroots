// External dependencies
import PropTypes from 'prop-types';
import React, { useEffect, useRef, useState } from 'react';
import { Map as ReactMapGL } from 'react-map-gl/mapbox-legacy';

// Internal dependencies
import './map.less';
import { MAP_STYLE_DEFAULT, MAP_STYLE_OSM } from './constants';
import MapNavigationControl from './MapNavigationControl';
import MapScaleControl from './MapScaleControl';
import MapStyleControl from './MapStyleControl';
import LeafletMap from './LeafletMap';
import { getMapBoxToken, isWebGLSupported } from '../../utils/map';

type MapProps = React.ComponentProps<typeof ReactMapGL> & {
  'aria-hidden'?: boolean;
  className?: string;
  fallbackMarker?: { color: string; location: [number, number] };
  height?: number | string;
  location?: [number, number];
  onLocationChange?: (location: [number, number]) => void;
  width?: number | string;
  showMapStyles?: boolean;
};
export default function Map(props: MapProps) {
  const {
    children,
    fallbackMarker,
    onLocationChange,
    onLoad,
    location = [48.6908333333, 9.14055555556], // Default location to Europe when not set
    zoom = 6,
    width = '100%',
    height = 320,
    ...overrideProps // anything else will be passed down to <ReactMapGL> as props
  } = props;

  const [mapStyle, setMapstyle] = useState<string | typeof MAP_STYLE_OSM>(
    MAP_STYLE_DEFAULT,
  );
  const [viewState, setViewState] = useState({
    latitude: location[0],
    longitude: location[1],
    zoom,
  });
  const pageWheelCleanup = useRef<(() => void) | null>(null);
  useEffect(() => {
    setViewState(current => ({
      ...current,
      latitude: location[0],
      longitude: location[1],
    }));
  }, [location[0], location[1]]);
  useEffect(
    () => () => {
      pageWheelCleanup.current?.();
    },
    [],
  );

  function handleMove(event: { viewState: typeof viewState }) {
    setViewState(event.viewState);
    if (onLocationChange) {
      onLocationChange([event.viewState.latitude, event.viewState.longitude]);
    }
  }
  function handleLoad(event: Parameters<NonNullable<MapProps['onLoad']>>[0]) {
    event.target.touchZoomRotate.disableRotation();
    pageWheelCleanup.current?.();

    const map = event.target;
    const container = map.getContainer();
    const handlePageWheel = (wheel: WheelEvent) => {
      if (wheel.deltaMode !== WheelEvent.DOM_DELTA_PAGE) return;

      const pageHeight = map.getContainer().getBoundingClientRect().height;
      if (pageHeight <= 0) return;

      wheel.preventDefault();
      wheel.stopPropagation();
      (wheel.target as EventTarget).dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          clientX: wheel.clientX,
          clientY: wheel.clientY,
          ctrlKey: wheel.ctrlKey,
          deltaMode: WheelEvent.DOM_DELTA_PIXEL,
          deltaX: wheel.deltaX,
          deltaY: wheel.deltaY * pageHeight,
          altKey: wheel.altKey,
          metaKey: wheel.metaKey,
          shiftKey: wheel.shiftKey,
        }),
      );
    };
    container.addEventListener('wheel', handlePageWheel, {
      capture: true,
      passive: false,
    });
    pageWheelCleanup.current = () =>
      container.removeEventListener('wheel', handlePageWheel, true);

    onLoad?.(event);
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
        height={height || 320}
        location={location}
        marker={fallbackMarker}
        onLocationChange={onLocationChange}
        scrollZoom={props.scrollZoom as boolean | undefined}
        width={width || '100%'}
        zoom={zoom}
      />
    );
  }

  return (
    <ReactMapGL
      reuseMaps
      dragRotate={false}
      style={{ height, width }}
      mapboxAccessToken={MAPBOX_TOKEN as string}
      mapStyle={mapStyle as React.ComponentProps<typeof ReactMapGL>['mapStyle']}
      onLoad={handleLoad}
      onMove={handleMove}
      {...viewState}
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
