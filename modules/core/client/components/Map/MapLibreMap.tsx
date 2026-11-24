/// <reference types="vite/client" />
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import ReactMapGL, {
  Layer,
  Marker,
  Popup,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from '@vis.gl/react-maplibre';
import {
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type Map as MapLibre,
  type MapGeoJSONFeature,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@trustroots/ui/cn';

import { MAP_STYLE } from './constants';
import MapNavigationControl from './MapNavigationControl';
import MapScaleControl from './MapScaleControl';
import usePageWheel from './use-page-wheel';
import {
  AREA_RADIUS_METRES,
  MIN_AREA_CIRCLE_ZOOM,
  type MapBounds,
  type MapPoint,
  type MapProps,
  type MapView,
} from './types';

// MapLibre resolves its worker next to its own module, which the bundle does not emit.
setWorkerUrl(workerUrl);

const MISSING_LAYER_ERROR =
  /^The layer '.*' does not exist in the map's style and cannot be queried for features\.$/;
const POINT_RADIUS: ExpressionSpecification = [
  'interpolate',
  ['exponential', 1.75],
  ['zoom'],
  2,
  3,
  7,
  12,
  14,
  14,
  22,
  20,
];
const isHovered: ExpressionSpecification = [
  'boolean',
  ['feature-state', 'hover'],
  false,
];
const isSelected: ExpressionSpecification = [
  'boolean',
  ['feature-state', 'selected'],
  false,
];

const viewOf = (map: MapLibre): MapView => ({
  latitude: map.getCenter().lat,
  longitude: map.getCenter().lng,
  zoom: map.getZoom(),
});
const boundsOf = (map: MapLibre): MapBounds => ({
  northEast: map.getBounds().getNorthEast(),
  southWest: map.getBounds().getSouthWest(),
});

function toPoint(feature: GeoJSON.Feature): MapPoint {
  const [longitude, latitude] = (feature.geometry as GeoJSON.Point).coordinates;
  const properties = feature.properties ?? {};
  return {
    id: Number(feature.id),
    latitude,
    longitude,
    colour: properties.colour,
    properties,
  };
}

function areaFeatures({ latitude, longitude }: MapView) {
  const radius = AREA_RADIUS_METRES / 111320;
  const ring = Array.from({ length: 65 }, (_, step) => {
    const angle = (step / 32) * Math.PI;
    return [
      longitude +
        (radius * Math.cos(angle)) / Math.cos((latitude * Math.PI) / 180),
      latitude + radius * Math.sin(angle),
    ];
  });
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Polygon' as const, coordinates: [ring] },
      },
      {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Point' as const,
          coordinates: [longitude, latitude],
        },
      },
    ],
  };
}

export default function MapLibreMap(props: MapProps) {
  const { view, layers = [], scrollZoom = true } = props;
  const mapRef = useRef<MapRef>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [settled, setSettled] = useState(view);
  const appliedView = useRef(view);
  const dragged = useRef(false);
  const hovered = useRef<MapGeoJSONFeature | null>(null);
  usePageWheel(surfaceRef, true);
  const map = () => mapRef.current?.getMap();

  useEffect(() => {
    if (view !== appliedView.current) {
      appliedView.current = view;
      map()?.jumpTo({
        center: [view.longitude, view.latitude],
        zoom: view.zoom,
      });
    }
  }, [view]);

  useEffect(() => {
    const surface = surfaceRef.current!;
    // Firefox sends trackpad pinches as Ctrl+wheel; zoom the map, not the page.
    const pinch = (event: WheelEvent) => {
      const current = map();
      if (!event.ctrlKey || !scrollZoom || !current) return;
      event.preventDefault();
      event.stopPropagation();
      const deltaY = event.deltaMode === 1 ? event.deltaY * 40 : event.deltaY;
      current.setZoom(
        Math.max(0, Math.min(20, current.getZoom() - deltaY * 0.01)),
      );
    };
    surface.addEventListener('wheel', pinch, { capture: true, passive: false });
    return () => surface.removeEventListener('wheel', pinch, true);
  }, [scrollZoom]);

  useImperativeHandle(props.ref, () => ({
    fitBounds: ({ northEast, southWest }, options) =>
      map()?.fitBounds(
        [
          [southWest.lng, southWest.lat],
          [northEast.lng, northEast.lat],
        ],
        options,
      ),
    flyTo: ({ latitude, longitude, zoom }, animate = true) =>
      map()?.flyTo({ center: [longitude, latitude], zoom, speed: 3, animate }),
    setPointState: (layerId, pointId, state) =>
      map()?.setFeatureState({ source: layerId, id: pointId }, state),
  }));

  const setHover = (feature: MapGeoJSONFeature | null) => {
    if (hovered.current) {
      map()?.setFeatureState(hovered.current, { hover: false });
    }
    hovered.current = feature;
    if (feature) map()?.setFeatureState(feature, { hover: true });
  };

  const onClick = (event: MapLayerMouseEvent) => {
    const features = event.features ?? [];
    // A point wins over a cluster from another layer drawn at the same place.
    const feature =
      features.find(({ layer }) => layer.id.endsWith('-points')) ?? features[0];
    if (!feature) {
      const target = event.originalEvent.target as Element;
      if (!target.closest('.maplibregl-marker, .maplibregl-popup')) {
        props.onClick?.([event.lngLat.lat, event.lngLat.lng]);
      }
      return;
    }
    const layerId = feature.source;
    if (!feature.properties.cluster) {
      props.onPointClick?.(layerId, toPoint(feature));
      return;
    }
    const source = map()!.getSource<GeoJSONSource>(layerId)!;
    const clusterId = feature.properties.cluster_id;
    const point = toPoint(feature);
    props.onClusterClick?.(layerId, {
      latitude: point.latitude,
      longitude: point.longitude,
      expansionZoom: () => source.getClusterExpansionZoom(clusterId),
      leaves: () =>
        source
          .getClusterLeaves(clusterId, feature.properties.point_count, 0)
          .then(leaves => leaves.map(toPoint)),
    });
  };

  return (
    <div
      ref={surfaceRef}
      className={cn(props.className, 'tw:map-scale')}
      aria-hidden={props['aria-hidden']}
      style={props.style}
      data-map-latitude={settled.latitude}
      data-map-longitude={settled.longitude}
      data-map-zoom={settled.zoom}
    >
      <ReactMapGL
        ref={mapRef}
        reuseMaps
        dragRotate={false}
        mapStyle={MAP_STYLE}
        initialViewState={view}
        minZoom={props.minZoom}
        maxBounds={props.worldBounds ? [-180, -85, 180, 85] : undefined}
        scrollZoom={scrollZoom}
        style={{ width: '100%', height: '100%' }}
        interactiveLayerIds={layers.flatMap(({ id }) => [
          `${id}-clusters`,
          `${id}-points`,
        ])}
        onLoad={({ target }) => {
          target.touchZoomRotate.disableRotation();
          target.scrollZoom.setWheelZoomRate(1 / 100);
          props.onLoad?.(viewOf(target), boundsOf(target));
        }}
        onError={event => {
          // Pointer events can race with style teardown; nothing is lost.
          if (!MISSING_LAYER_ERROR.test(event.error?.message ?? '')) {
            // eslint-disable-next-line no-console
            console.error(event.error);
          }
        }}
        onDragStart={() => {
          dragged.current = true;
        }}
        onMoveStart={() => props.onMoveStart?.()}
        onMove={({ target }) => {
          props.onMove?.(viewOf(target), boundsOf(target));
        }}
        onMoveEnd={({ target }) => {
          setSettled(viewOf(target));
          props.onMoveEnd?.(viewOf(target), boundsOf(target), dragged.current);
          dragged.current = false;
        }}
        onClick={onClick}
        onMouseMove={({ features }) =>
          setHover(
            features?.find(({ layer }) => layer.id.endsWith('-points')) ?? null,
          )
        }
        onMouseLeave={() => setHover(null)}
      >
        <MapNavigationControl />
        <MapScaleControl />
        {layers.map(layer => (
          <Source
            key={layer.id}
            id={layer.id}
            type="geojson"
            buffer={512}
            cluster
            clusterMaxZoom={layer.clusterMaxZoom}
            clusterMinPoints={layer.clusterMinPoints}
            clusterRadius={50}
            data={{
              type: 'FeatureCollection',
              features: layer.points.map(point => ({
                type: 'Feature',
                id: point.id,
                geometry: {
                  type: 'Point',
                  coordinates: [point.longitude, point.latitude],
                },
                properties: { ...point.properties, colour: point.colour },
              })),
            }}
          >
            <Layer
              id={`${layer.id}-clusters`}
              type="circle"
              minzoom={layer.minZoom}
              filter={['has', 'point_count']}
              paint={{
                'circle-color': layer.clusterColour,
                'circle-radius': [
                  'step',
                  ['get', 'point_count'],
                  25,
                  100,
                  30,
                  750,
                  40,
                ],
              }}
            />
            <Layer
              id={`${layer.id}-count`}
              type="symbol"
              minzoom={layer.minZoom}
              filter={['has', 'point_count']}
              layout={{
                'text-field': '{point_count_abbreviated}',
                // The font has to exist at the glyphs URL of MAP_STYLE.
                'text-font': ['Noto Sans Bold'],
                'text-size': 15,
              }}
              paint={{ 'text-color': layer.clusterTextColour }}
            />
            <Layer
              id={`${layer.id}-points`}
              type="circle"
              minzoom={layer.minZoom}
              filter={['!', ['has', 'point_count']]}
              paint={{
                'circle-color': ['case', isSelected, '#000', ['get', 'colour']],
                'circle-radius': POINT_RADIUS,
                'circle-stroke-width': 3,
                'circle-stroke-color': '#fff',
                'circle-stroke-opacity': ['case', isHovered, 1, 0],
                'circle-opacity': [
                  'case',
                  ['any', isHovered, isSelected],
                  1,
                  ['boolean', ['feature-state', 'viewed'], false],
                  0.7,
                  1,
                ],
              }}
            />
          </Source>
        ))}
        {props.area && (
          <Source
            id="area"
            type="geojson"
            data={areaFeatures({ ...props.area, zoom: 0 })}
          >
            <Layer
              id="area-circle"
              type="fill"
              minzoom={MIN_AREA_CIRCLE_ZOOM}
              filter={['==', '$type', 'Polygon']}
              paint={{
                'fill-color': '#b1b1b1',
                'fill-opacity': 0.5,
                'fill-outline-color': '#989898',
              }}
            />
            <Layer
              id="area-dot"
              type="circle"
              maxzoom={MIN_AREA_CIRCLE_ZOOM}
              filter={['==', '$type', 'Point']}
              paint={{ 'circle-color': props.area.colour, 'circle-radius': 12 }}
            />
          </Source>
        )}
        {props.pins?.map(pin => (
          <Marker
            key={pin.key}
            latitude={pin.latitude}
            longitude={pin.longitude}
            anchor="center"
          >
            {pin.children}
          </Marker>
        ))}
        {props.popup && (
          <Popup
            key={props.popup.key}
            latitude={props.popup.latitude}
            longitude={props.popup.longitude}
            anchor="bottom"
            offset={10}
            maxWidth="none"
            closeButton={false}
            closeOnClick={false}
          >
            {props.popup.children}
          </Popup>
        )}
        {props.children}
      </ReactMapGL>
    </div>
  );
}
