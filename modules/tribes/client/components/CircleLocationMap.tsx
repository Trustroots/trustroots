import L from 'leaflet';
import React, { useEffect, useRef, type ReactNode } from 'react';
import { getRasterMapTiles } from '@/modules/core/client/utils/map';
import './circle-location-map.less';

export interface CircleLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  details: string[];
  facts?: { label: string; value: string }[];
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
      definition.textContent = value;
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
}

export default function CircleLocationMap(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
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
    map.on('resize', () => map.setMinZoom(minimumZoom()));
    const tiles = getRasterMapTiles();
    L.tileLayer(tiles.url, tiles.options).addTo(map);
    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);
  useEffect(() => {
    const markers = markersRef.current!;
    markers.clearLayers();
    props.locations.forEach(location => {
      L.circleMarker([location.latitude, location.longitude], {
        radius: 8,
        color: '#fff',
        weight: 2,
        fillColor: '#488261',
        fillOpacity: 1,
      })
        .bindPopup(locationPopup(location))
        .addTo(markers);
    });
    if (props.locations.length)
      mapRef.current!.fitBounds(
        L.latLngBounds(
          props.locations.map(
            location =>
              [location.latitude, location.longitude] as [number, number],
          ),
        ),
        { padding: [24, 24], maxZoom: 8 },
      );
  }, [props.locations]);
  return (
    <section className="circle-location-map-panel" aria-label={props.title}>
      <div className="circle-location-map-heading">
        <h3>{props.title}</h3>
        <p>{props.description}</p>
      </div>
      <div
        className="circle-location-map"
        ref={container}
        role="application"
        aria-label={props.mapLabel}
      />
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
