import L from 'leaflet';
import React, { useEffect, useRef, useState } from 'react';

import { getRasterMapTiles } from '@/modules/core/client/utils/map';
import { nostrService } from '@/modules/search/client/services/nostr.client.service';
import './hackerspace-map.less';

export interface HackerPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  website?: string;
  description?: string;
  open?: string;
  fetchedAt?: string;
  inactive: boolean;
}

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
export function decodeGeohash(hash: string): [number, number] | null {
  if (!hash || !/^[0-9bcdefghjkmnpqrstuvwxyz]+$/i.test(hash)) return null;
  const lat = [-90, 90];
  const lon = [-180, 180];
  let even = true;
  for (const char of hash.toLowerCase()) {
    const value = BASE32.indexOf(char);
    for (let mask = 16; mask; mask >>= 1) {
      const range = even ? lon : lat;
      const middle = (range[0] + range[1]) / 2;
      if (value & mask) range[0] = middle;
      else range[1] = middle;
      even = !even;
    }
  }
  return [(lat[0] + lat[1]) / 2, (lon[0] + lon[1]) / 2];
}
const tag = (tags: string[][], name: string) =>
  tags.find(value => value[0] === name)?.[1];
const metadata = (tags: string[][], key: string) => {
  const value = tags.find(
    item =>
      (item[0] === 'meta' && item[1] === key) || item[0] === `meta:${key}`,
  );
  return value?.[value?.[0] === 'meta' ? 2 : 1];
};
export function parseHackerPlace(event: {
  id: string;
  tags: string[][];
  content: string;
}): HackerPlace | null {
  const geohashes = event.tags
    .filter(value => value[0] === 'g')
    .map(value => value[1])
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const point = decodeGeohash(geohashes[0] || '');
  const name = tag(event.tags, 'name');
  const website = tag(event.tags, 'website');
  if (!metadata(event.tags, 'source')?.includes('spaceapi.io')) return null;
  if (!point || !name) return null;
  return {
    id: tag(event.tags, 'd') || event.id,
    name,
    latitude: point[0],
    longitude: point[1],
    address: tag(event.tags, 'address'),
    website: website && /^https?:\/\//i.test(website) ? website : undefined,
    description: event.content,
    open: metadata(event.tags, 'open'),
    fetchedAt: metadata(event.tags, 'fetched_at'),
    inactive:
      tag(event.tags, 'status') === 'inactive' ||
      metadata(event.tags, 'status') === 'inactive',
  };
}

function popupContent(place: HackerPlace): HTMLElement {
  const root = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = place.name;
  root.append(title);
  if (place.address) {
    const address = document.createElement('p');
    address.textContent = place.address;
    root.append(address);
  }
  if (place.description) {
    const description = document.createElement('p');
    description.textContent = place.description;
    root.append(description);
  }
  if (place.open) {
    const state = document.createElement('p');
    state.textContent = `SpaceAPI-reported snapshot: ${place.open}`;
    root.append(state);
  }
  if (place.fetchedAt) {
    const fetched = document.createElement('p');
    fetched.textContent = `Trustroots fetched: ${place.fetchedAt}`;
    root.append(fetched);
  }
  if (place.website) {
    const link = document.createElement('a');
    link.href = place.website;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Visit website';
    root.append(link);
  }
  return root;
}

export default function HackerspaceMap() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [places, setPlaces] = useState<HackerPlace[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    nostrService
      .subscribeHackerPlaces(
        event => {
          const place = parseHackerPlace(event);
          if (place)
            setPlaces(current => [
              ...current.filter(value => value.id !== place.id),
              place,
            ]);
        },
        {
          onEose: () => {
            if (active) setState('ready');
          },
          onClose: () => {
            if (active) setState('error');
          },
        },
      )
      .catch(() => {
        if (active) setState('error');
      });
    return () => {
      active = false;
      nostrService.unsubscribeHackerPlaces();
    };
  }, []);
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { scrollWheelZoom: false }).setView(
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
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers) return;
    markers.clearLayers();
    const visible = places.filter(place => !place.inactive);
    visible.forEach(place => {
      L.circleMarker([place.latitude, place.longitude], {
        radius: 8,
        color: '#fff',
        weight: 2,
        fillColor: '#488261',
        fillOpacity: 1,
      })
        .bindPopup(popupContent(place))
        .addTo(markers);
    });
    if (visible.length)
      map.fitBounds(
        L.latLngBounds(
          visible.map(
            place => [place.latitude, place.longitude] as [number, number],
          ),
        ),
        { padding: [24, 24], maxZoom: 8 },
      );
  }, [places]);
  return (
    <section className="hackerspace-map-panel" aria-label="Hackerspace map">
      <div className="hackerspace-map-heading">
        <h3>Hackerspaces around the world</h3>
        <p>
          SpaceAPI-reported locations. Listings have not been independently
          verified.
        </p>
      </div>
      <div
        className="hackerspace-map"
        ref={container}
        role="application"
        aria-label="Map of SpaceAPI-reported hackerspaces"
      />
      <p className="hackerspace-map-status" aria-live="polite">
        {state === 'loading'
          ? 'Loading places from Trustroots relay…'
          : state === 'error'
          ? 'Places could not be loaded from the relay.'
          : places.length
          ? `${places.length} SpaceAPI-reported places`
          : 'No place events are available yet.'}
      </p>
    </section>
  );
}
