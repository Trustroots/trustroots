import React, { useEffect, useRef, useState } from 'react';
import ReactMapGL, { type ViewStateChangeEvent } from 'react-map-gl/mapbox';
import type { StyleSpecification } from 'mapbox-gl';

// Internal dependencies
import './map.less';
import { MAP_STYLE_DEFAULT, MAP_STYLE_OSM } from './constants';
import MapNavigationControl from './MapNavigationControl';
import MapScaleControl from './MapScaleControl';
import MapStyleControl from './MapStyleControl';
import LeafletMap from './LeafletMap';
import usePageWheel from './use-page-wheel';
import { getMapBoxToken, isWebGLSupported } from '../../utils/map';

type MapProps = React.ComponentProps<typeof ReactMapGL> & {
  'aria-hidden'?: boolean;
  fallbackMarker?: { color: string; location: [number, number] };
  location?: [number, number];
  onLocationChange?: (location: [number, number]) => void;
  preferRaster?: boolean;
  showMapStyles?: boolean;
  height?: number | string;
  width?: number | string;
  className?: string;
};
export default function Map(props: MapProps) {
  const {
    children,
    fallbackMarker,
    preferRaster = false,
    onLocationChange,
    location = [48.6908333333, 9.14055555556], // Default location to Europe when not set
    zoom = 6,
    height = 320,
    width = '100%',
    showMapStyles: requestedMapStyles,
    className,
    ...overrideProps // anything else will be passed down to <ReactMapGL> as props
  } = props;

  const [mapStyle, setMapstyle] = useState<string | typeof MAP_STYLE_OSM>(
    MAP_STYLE_DEFAULT,
  );
  const [useWebGL] = useState(
    () => isWebGLSupported() && Boolean(getMapBoxToken()),
  );
  const surfaceRef = useRef<HTMLDivElement>(null);
  usePageWheel(surfaceRef, useWebGL && !preferRaster);
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

  function handleViewportChange(event: ViewStateChangeEvent) {
    const { viewState } = event;
    setViewport(viewState);
  }
  const MAPBOX_TOKEN = getMapBoxToken();
  const showMapStyles =
    requestedMapStyles &&
    (!!MAPBOX_TOKEN || process.env.NODE_ENV !== 'production');

  if (preferRaster || !useWebGL) {
    return (
      <LeafletMap
        ariaHidden={props['aria-hidden']}
        className={props.className}
        height={height}
        location={location}
        marker={fallbackMarker}
        onLocationChange={onLocationChange}
        scrollZoom={props.scrollZoom as boolean | undefined}
        width={width}
        zoom={zoom}
      />
    );
  }

  return (
    <div
      ref={surfaceRef}
      className={className}
      aria-hidden={props['aria-hidden']}
      style={{ width, height }}
    >
      <ReactMapGL
        reuseMaps
        dragRotate={false}
        mapboxAccessToken={MAPBOX_TOKEN || undefined}
        mapStyle={mapStyle as string | StyleSpecification}
        onMove={handleViewportChange}
        onDrag={event => {
          // Zoom controls and place searches must not choose an offer location.
          if (!event.target.isZooming()) {
            onLocationChange?.([
              event.viewState.latitude,
              event.viewState.longitude,
            ]);
          }
        }}
        onLoad={event => {
          event.target.touchZoomRotate.disableRotation();
          event.target.scrollZoom.setWheelZoomRate(1 / 100);
        }}
        {...viewport}
        style={{ width, height }}
        {...overrideProps}
      >
        <MapNavigationControl />
        <MapScaleControl />
        {showMapStyles && (
          <MapStyleControl mapStyle={mapStyle} setMapstyle={setMapstyle} />
        )}
        {children}
      </ReactMapGL>
    </div>
  );
}
