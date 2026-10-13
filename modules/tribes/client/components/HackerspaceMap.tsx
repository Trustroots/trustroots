import React, { useEffect, useMemo, useState } from 'react';
import type { Event } from 'nostr-tools';
import { nostrService } from '@/modules/search/client/services/nostr.client.service';
import CircleLocationMap, { type CircleLocation } from './CircleLocationMap';
import { currentPlaceEvents } from '../hooks/useCircleMapEvents';

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
  pubkey?: string;
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
    id: event.pubkey
      ? `${event.pubkey}:${tag(event.tags, 'd') || event.id}`
      : tag(event.tags, 'd') || event.id,
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

export default function HackerspaceMap() {
  const [events, setEvents] = useState<Event[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    nostrService
      .subscribeHackerPlaces(
        event => {
          if (!active) return;
          setEvents(current => [
            ...current.filter(value => value.id !== event.id),
            event,
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
  const locations = useMemo<CircleLocation[]>(
    () =>
      currentPlaceEvents(events)
        .map(parseHackerPlace)
        .filter((place): place is HackerPlace => !!place && !place.inactive)
        .map(place => ({
          ...place,
          details: [
            place.address,
            place.description,
            place.open && `SpaceAPI-reported snapshot: ${place.open}`,
            place.fetchedAt && `Trustroots fetched: ${place.fetchedAt}`,
          ].filter((value): value is string => !!value),
          link: place.website
            ? { url: place.website, label: 'Visit website' }
            : undefined,
        })),
    [events],
  );
  return (
    <CircleLocationMap
      title="Hackerspaces around the world"
      description="SpaceAPI-reported locations. Listings have not been independently verified."
      mapLabel="Map of SpaceAPI-reported hackerspaces"
      locations={locations}
      state={state}
      loadingText="Loading places from Trustroots and Nomadwiki relays…"
      errorText="Places could not be loaded from the relay."
      emptyText="No place events are available yet."
      countLabel="SpaceAPI-reported places"
      markerColor="#12b591"
      className="circle-location-map-panel--brand"
    />
  );
}
