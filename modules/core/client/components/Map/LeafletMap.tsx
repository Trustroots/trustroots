import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import Supercluster, { type ClusterProperties } from 'supercluster';
import { cn } from '@trustroots/ui/cn';

import { RASTER_TILES } from './constants';
import {
  AREA_RADIUS_METRES,
  MIN_AREA_CIRCLE_ZOOM,
  type MapBounds,
  type MapPin,
  type MapPoint,
  type MapProps,
  type MapView,
} from './types';

// Raster tiles are 256 pixels, half of MapLibre's, so Leaflet zooms one level deeper.
const ZOOM_OFFSET = 1;
type PointState = { selected?: boolean; viewed?: boolean };

const viewOf = (map: L.Map): MapView => ({
  latitude: map.getCenter().lat,
  longitude: map.getCenter().lng,
  zoom: map.getZoom() - ZOOM_OFFSET,
});
const boundsOf = (map: L.Map): MapBounds => ({
  northEast: map.getBounds().getNorthEast(),
  southWest: map.getBounds().getSouthWest(),
});
const pointStyle = (colour: string, state: PointState = {}) => ({
  fillColor: state.selected ? '#000' : colour,
  fillOpacity: state.viewed && !state.selected ? 0.7 : 1,
});

/** Keeps one Leaflet marker per pin key so its React content stays mounted. */
function usePinElements(
  map: L.Map | undefined,
  pins: MapPin[],
  create: (pin: MapPin, element: HTMLElement) => L.Layer,
) {
  const layers = useRef(
    new globalThis.Map<string, { layer: L.Layer; element: HTMLElement }>(),
  );
  const [elements, setElements] = useState<Record<string, HTMLElement>>({});
  const signature = pins
    .map(({ key, latitude, longitude }) => `${key}@${latitude},${longitude}`)
    .join('|');
  useEffect(() => {
    if (!map) return;
    const current = layers.current;
    const keys = new Set(pins.map(({ key }) => key));
    current.forEach(({ layer }, key) => {
      if (!keys.has(key)) {
        layer.remove();
        current.delete(key);
      }
    });
    pins.forEach(pin => {
      const existing = current.get(pin.key);
      if (existing) {
        (existing.layer as L.Marker).setLatLng([pin.latitude, pin.longitude]);
        return;
      }
      const element = document.createElement('div');
      current.set(pin.key, { layer: create(pin, element).addTo(map), element });
    });
    setElements(
      Object.fromEntries(
        [...current].map(([key, { element }]) => [key, element]),
      ),
    );
  }, [map, signature]);
  useEffect(
    () => () => layers.current.forEach(({ layer }) => layer.remove()),
    [],
  );
  return elements;
}

export default function LeafletMap(props: MapProps) {
  const { view, layers = [], scrollZoom = true } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map>();
  const [settled, setSettled] = useState(view);
  const appliedView = useRef(view);
  const latest = useRef(props);
  latest.current = props;
  const pointState = useRef(new globalThis.Map<string, PointState>());
  const pointMarkers = useRef(
    new globalThis.Map<string, { marker: L.CircleMarker; colour: string }>(),
  );

  useEffect(() => {
    const created = L.map(containerRef.current!, {
      zoomControl: false,
      scrollWheelZoom: scrollZoom,
      minZoom:
        props.minZoom === undefined ? undefined : props.minZoom + ZOOM_OFFSET,
      maxBounds: props.worldBounds
        ? [
            [-85, -180],
            [85, 180],
          ]
        : undefined,
      maxBoundsViscosity: 1,
    }).setView([view.latitude, view.longitude], view.zoom + ZOOM_OFFSET);
    L.control.zoom({ position: 'topright' }).addTo(created);
    L.control.scale({ imperial: false }).addTo(created);
    L.tileLayer(RASTER_TILES.url, {
      attribution: RASTER_TILES.attribution,
      maxZoom: 19,
    }).addTo(created);
    let dragged = false;
    created.on('dragstart', () => {
      dragged = true;
    });
    created.on('movestart', () => latest.current.onMoveStart?.());
    created.on('move', () => {
      latest.current.onMove?.(viewOf(created), boundsOf(created));
    });
    created.on('moveend', () => {
      setSettled(viewOf(created));
      latest.current.onMoveEnd?.(viewOf(created), boundsOf(created), dragged);
      dragged = false;
    });
    created.on('click', event => {
      const target = event.originalEvent.target as Element;
      if (!target.closest('.leaflet-marker-icon, .leaflet-popup')) {
        latest.current.onClick?.([event.latlng.lat, event.latlng.lng]);
      }
    });
    // Tabs and responsive panels can resize the map after it is created.
    const resize = new ResizeObserver(() =>
      created.invalidateSize({ pan: false }),
    );
    resize.observe(containerRef.current!);
    setMap(created);
    latest.current.onLoad?.(viewOf(created), boundsOf(created));
    return () => {
      resize.disconnect();
      created.remove();
    };
  }, []);

  useEffect(() => {
    if (map && view !== appliedView.current) {
      appliedView.current = view;
      map.setView([view.latitude, view.longitude], view.zoom + ZOOM_OFFSET);
    }
  }, [map, view]);

  useImperativeHandle(
    props.ref,
    () => ({
      fitBounds: ({ northEast, southWest }, { padding, maxZoom, animate }) =>
        map?.fitBounds(
          [
            [southWest.lat, southWest.lng],
            [northEast.lat, northEast.lng],
          ],
          {
            padding: [padding, padding],
            maxZoom: maxZoom === undefined ? undefined : maxZoom + ZOOM_OFFSET,
            animate,
          },
        ),
      flyTo: ({ latitude, longitude, zoom }, animate = true) =>
        map?.setView([latitude, longitude], zoom + ZOOM_OFFSET, { animate }),
      setPointState: (layerId, pointId, state) => {
        const key = `${layerId}:${pointId}`;
        const next = { ...pointState.current.get(key), ...state };
        pointState.current.set(key, next);
        const point = pointMarkers.current.get(key);
        point?.marker.setStyle(pointStyle(point.colour, next));
      },
    }),
    [map],
  );

  const indexes = useMemo(
    () =>
      layers.map(layer => ({
        layer,
        index: new Supercluster<MapPoint>({
          maxZoom: layer.clusterMaxZoom + ZOOM_OFFSET,
          minPoints: layer.clusterMinPoints ?? 2,
          radius: 50,
        }).load(
          layer.points.map(point => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [point.longitude, point.latitude],
            },
            properties: point,
          })),
        ),
      })),
    [layers],
  );

  useEffect(() => {
    if (!map) return undefined;
    const group = L.layerGroup().addTo(map);
    const bounds = map.getBounds();
    pointMarkers.current.clear();
    indexes.forEach(({ layer, index }) => {
      if (settled.zoom < layer.minZoom) return;
      index
        .getClusters(
          [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth(),
          ],
          Math.floor(map.getZoom()),
        )
        .forEach(feature => {
          const [longitude, latitude] = feature.geometry.coordinates;
          const properties = feature.properties as MapPoint | ClusterProperties;
          if ('cluster_id' in properties) {
            const clusterId = properties.cluster_id;
            L.marker([latitude, longitude], {
              title: `${properties.point_count}`,
              keyboard: true,
              icon: L.divIcon({
                className: '',
                iconSize: [50, 50],
                html: `<span class="tw:flex tw:size-full tw:items-center tw:justify-center tw:rounded-full tw:font-bold" style="background:${layer.clusterColour};color:${layer.clusterTextColour}">${properties.point_count_abbreviated}</span>`,
              }),
            })
              .on('click', () =>
                latest.current.onClusterClick?.(layer.id, {
                  latitude,
                  longitude,
                  expansionZoom: async () =>
                    index.getClusterExpansionZoom(clusterId) - ZOOM_OFFSET,
                  leaves: async () =>
                    index
                      .getLeaves(clusterId, Infinity)
                      .map(leaf => leaf.properties),
                }),
              )
              .addTo(group);
            return;
          }
          const key = `${layer.id}:${properties.id}`;
          const marker = L.circleMarker([latitude, longitude], {
            radius: 10,
            weight: 2,
            color: '#fff',
            bubblingMouseEvents: false,
            ...pointStyle(properties.colour, pointState.current.get(key)),
          })
            .on('click', () =>
              latest.current.onPointClick?.(layer.id, properties),
            )
            .addTo(group);
          pointMarkers.current.set(key, { marker, colour: properties.colour });
        });
    });
    return () => {
      group.remove();
    };
  }, [map, indexes, settled]);

  useEffect(() => {
    if (!map || !props.area) return undefined;
    const centre: L.LatLngTuple = [props.area.latitude, props.area.longitude];
    const shape =
      settled.zoom >= MIN_AREA_CIRCLE_ZOOM
        ? L.circle(centre, {
            radius: AREA_RADIUS_METRES,
            color: '#989898',
            weight: 2,
            fillColor: '#b1b1b1',
            fillOpacity: 0.5,
            interactive: false,
          })
        : L.circleMarker(centre, {
            radius: 12,
            stroke: false,
            fillColor: props.area.colour,
            fillOpacity: 1,
            interactive: false,
          });
    shape.addTo(map);
    return () => {
      shape.remove();
    };
  }, [
    map,
    props.area?.latitude,
    props.area?.longitude,
    props.area?.colour,
    settled.zoom >= MIN_AREA_CIRCLE_ZOOM,
  ]);

  const pinElements = usePinElements(map, props.pins ?? [], (pin, element) =>
    L.marker([pin.latitude, pin.longitude], {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({ className: '', html: element, iconSize: undefined }),
    }),
  );
  const popupElements = usePinElements(
    map,
    props.popup ? [props.popup] : [],
    (pin, element) =>
      L.popup({
        autoClose: false,
        closeButton: false,
        closeOnClick: false,
        closeOnEscapeKey: false,
        maxWidth: 400,
      })
        .setLatLng([pin.latitude, pin.longitude])
        .setContent(element),
  );
  useLayoutEffect(() => {
    // Position the popup again once React has rendered its content.
    map?.eachLayer(layer => {
      if (layer instanceof L.Popup) layer.update();
    });
  }, [map, popupElements, props.popup]);

  const portals = [
    ...(props.pins ?? []).map(
      pin =>
        pinElements[pin.key] &&
        createPortal(
          <div className="tw:pointer-events-auto tw:w-max tw:-translate-1/2">
            {pin.children}
          </div>,
          pinElements[pin.key],
          pin.key,
        ),
    ),
    props.popup &&
      popupElements[props.popup.key] &&
      createPortal(props.popup.children, popupElements[props.popup.key]),
  ];

  return (
    <div
      className={cn(props.className, 'tw:relative tw:map-scale')}
      aria-hidden={props['aria-hidden']}
      style={props.style}
      data-map-latitude={settled.latitude}
      data-map-longitude={settled.longitude}
      data-map-zoom={settled.zoom}
    >
      <div ref={containerRef} className="tw:absolute tw:inset-0 tw:z-0" />
      {portals}
      {props.children}
    </div>
  );
}
