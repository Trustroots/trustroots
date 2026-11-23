import React, { useEffect, useRef, useState } from 'react';
import ReactMapGL, { type ViewStateChangeEvent } from '@vis.gl/react-maplibre';
import { cn } from '@trustroots/ui/cn';

// Internal dependencies
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_STYLE } from './constants';
import MapNavigationControl from './MapNavigationControl';
import MapScaleControl from './MapScaleControl';
import MapUnavailable from './MapUnavailable';
import usePageWheel from './use-page-wheel';
import { isWebGLSupported } from '../../utils/map';

type MapProps = React.ComponentProps<typeof ReactMapGL> & {
  'aria-hidden'?: boolean;
  location?: [number, number];
  onLocationChange?: (location: [number, number]) => void;
  height?: number | string;
  width?: number | string;
  className?: string;
};
export default function Map(props: MapProps) {
  const {
    children,
    onLocationChange,
    location = [48.6908333333, 9.14055555556], // Default location to Europe when not set
    zoom = 6,
    height = 320,
    width = '100%',
    className,
    ...overrideProps // anything else will be passed down to <ReactMapGL> as props
  } = props;

  const [webGL] = useState(isWebGLSupported);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  usePageWheel(surfaceRef, webGL);
  const [viewport, setViewport] = useState({
    latitude: location[0],
    longitude: location[1],
    zoom,
  });
  useEffect(() => {
    setViewport(current => ({
      latitude: location[0],
      longitude: location[1],
      zoom: current.zoom,
    }));
  }, [location[0], location[1]]);
  useEffect(() => {
    setViewport(current => ({ ...current, zoom }));
  }, [zoom]);

  if (!webGL) {
    return <MapUnavailable className={className} style={{ width, height }} />;
  }

  return (
    <div
      ref={surfaceRef}
      className={cn(className, 'tw:map-scale')}
      aria-hidden={props['aria-hidden']}
      data-map-latitude={viewport.latitude}
      data-map-longitude={viewport.longitude}
      data-map-zoom={viewport.zoom}
      style={{ width, height }}
    >
      <ReactMapGL
        reuseMaps
        dragRotate={false}
        mapStyle={MAP_STYLE}
        onMove={(event: ViewStateChangeEvent) => setViewport(event.viewState)}
        onDragStart={() => {
          dragged.current = true;
        }}
        onMoveEnd={event => {
          // Include inertial movement after the pointer is released, without
          // choosing locations during zooms or programmatic camera changes.
          if (dragged.current) {
            onLocationChange?.([
              event.viewState.latitude,
              event.viewState.longitude,
            ]);
          }
          dragged.current = false;
        }}
        onClick={event =>
          onLocationChange?.([event.lngLat.lat, event.lngLat.lng])
        }
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
        {children}
      </ReactMapGL>
    </div>
  );
}
