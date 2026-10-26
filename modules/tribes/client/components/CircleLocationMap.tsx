import L from 'leaflet';
import React, { useEffect, useRef, type ReactNode } from 'react';
import { getRasterMapTiles } from '@/modules/core/client/utils/map';
import DeviceLocationButton from '@/modules/core/client/components/DeviceLocationButton';
import './circle-location-map.less';

export interface CircleLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  details: string[];
  facts?: {
    label: string;
    value: string | { label: string; url?: string }[];
  }[];
  link?: { url: string; label: string };
}

export function locationPopup(location: CircleLocation): HTMLElement {
  const root = document.createElement('div');
  root.className = 'circle-location-popup';
  const title = document.createElement('strong');
  title.textContent = location.name;
  root.append(title);
  if (location.facts?.length) {
    const facts = document.createElement('dl');
    location.facts.forEach(({ label, value }) => {
      const term = document.createElement('dt');
      const definition = document.createElement('dd');
      term.textContent = label;
      if (typeof value === 'string') {
        definition.textContent = value;
      } else {
        value.forEach((item, index) => {
          if (index) definition.append(', ');
          if (item.url && /^https?:\/\//i.test(item.url)) {
            const link = document.createElement('a');
            link.href = item.url;
            link.textContent = item.label;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            definition.append(link);
          } else {
            definition.append(item.label);
          }
        });
      }
      facts.append(term, definition);
    });
    root.append(facts);
  }
  location.details.forEach(detail => {
    const paragraph = document.createElement('p');
    paragraph.textContent = detail;
    root.append(paragraph);
  });
  if (location.link && /^https?:\/\//i.test(location.link.url)) {
    const link = document.createElement('a');
    link.href = location.link.url;
    link.textContent = location.link.label;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    root.append(link);
  }
  return root;
}

interface Props {
  title: string;
  description: string;
  mapLabel: string;
  locations: CircleLocation[];
  state: 'loading' | 'ready' | 'error';
  loadingText: string;
  emptyText: string;
  errorText: string;
  countLabel: string;
  attribution?: ReactNode;
  markerColor?: string;
  className?: string;
}

export default function CircleLocationMap(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const openLocation = useRef<string | null>(null);
  const initialViewSet = useRef(false);
  useEffect(() => {
    const element = container.current!;
    const minimumZoom = () =>
      Math.max(
        3,
        Math.ceil(
          Math.log2(
            Math.max(element.clientWidth, element.clientHeight, 1) / 256,
          ),
        ),
      );
    const map = L.map(element, {
      scrollWheelZoom: true,
      touchZoom: true,
      bounceAtZoomLimits: false,
      minZoom: minimumZoom(),
      maxBounds: [
        [-85, -180],
        [85, 180],
      ],
      maxBoundsViscosity: 1,
    }).setView([20, 0], minimumZoom());
    // Preserve any view chosen while the initial relay results are loading.
    map.on('movestart', () => {
      initialViewSet.current = true;
    });
    map.on('resize', () => map.setMinZoom(minimumZoom()));
    const tiles = getRasterMapTiles();
    L.tileLayer(tiles.url, tiles.options).addTo(map);
    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
      initialViewSet.current = false;
    };
  }, []);
  useEffect(() => {
    const markers = markersRef.current!;
    const selected = openLocation.current;
    markers.clearLayers();
    props.locations.forEach(location => {
      const marker = L.circleMarker([location.latitude, location.longitude], {
        radius: 8,
        color: '#fff',
        weight: 2,
        fillColor: props.markerColor || '#488261',
        fillOpacity: 1,
      })
        .bindPopup(locationPopup(location))
        .on('popupopen', () => {
          openLocation.current = location.id;
        })
        .on('popupclose', () => {
          openLocation.current = null;
        })
        .addTo(markers);
      if (selected === location.id) {
        const popup = marker.getPopup()!;
        // Refresh the selected popup without undoing the visitor's map position.
        popup.options.autoPan = false;
        marker.openPopup();
        popup.options.autoPan = true;
      }
    });
  }, [props.locations, props.markerColor]);
  useEffect(() => {
    // Fit the initial batch once. Streaming updates must not keep panning the
    // map or interrupt someone exploring it.
    if (
      props.state !== 'loading' &&
      props.locations.length &&
      !initialViewSet.current
    ) {
      initialViewSet.current = true;
      mapRef.current!.fitBounds(
        L.latLngBounds(
          props.locations.map(
            location =>
              [location.latitude, location.longitude] as [number, number],
          ),
        ),
        { padding: [24, 24], maxZoom: 8, animate: false },
      );
    }
  }, [props.locations, props.state]);
  return (
    <section
      className={`circle-location-map-panel${
        props.className ? ` ${props.className}` : ''
      }`}
      aria-label={props.title}
    >
      <div className="circle-location-map-heading">
        <h3>{props.title}</h3>
        <p>{props.description}</p>
      </div>
      <div className="circle-location-map-frame">
        <div
          className="circle-location-map"
          ref={container}
          role="application"
          aria-label={props.mapLabel}
        />
        <DeviceLocationButton
          onRequest={() => {
            initialViewSet.current = true;
          }}
          onLocation={({ lat, lng }) => {
            initialViewSet.current = true;
            mapRef.current?.setView([lat, lng], 13, { animate: false });
          }}
          onApproximateLocation={({ latitude, longitude, zoom }) => {
            initialViewSet.current = true;
            mapRef.current?.setView([latitude, longitude], zoom, {
              animate: false,
            });
          }}
        />
      </div>
      <div className="circle-location-map-footer">
        <span className="circle-location-map-status" aria-live="polite">
          {props.state === 'loading'
            ? props.loadingText
            : props.state === 'error'
              ? props.errorText
              : props.locations.length
                ? `${props.locations.length} ${props.countLabel}`
                : props.emptyText}
        </span>
        {props.attribution && (
          <span className="circle-location-map-attribution">
            {' '}
            · {props.attribution}
          </span>
        )}
      </div>
    </section>
  );
}
