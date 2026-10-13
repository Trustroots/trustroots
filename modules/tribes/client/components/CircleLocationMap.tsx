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
  link?: { url: string; label: string };
}

export function locationPopup(location: CircleLocation): HTMLElement {
  const root = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = location.name;
  root.append(title);
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
  useEffect(() => {
    const map = L.map(container.current!, { scrollWheelZoom: false }).setView(
      [20, 0],
      2,
    );
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
        fillColor: props.markerColor || '#488261',
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
  }, [props.locations, props.markerColor]);
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
      <div
        className="circle-location-map"
        ref={container}
        role="application"
        aria-label={props.mapLabel}
      />
      <p className="circle-location-map-status" aria-live="polite">
        {props.state === 'loading'
          ? props.loadingText
          : props.state === 'error'
            ? props.errorText
            : props.locations.length
              ? `${props.locations.length} ${props.countLabel}`
              : props.emptyText}
      </p>
      {props.attribution && (
        <p className="circle-location-map-attribution">{props.attribution}</p>
      )}
    </section>
  );
}
