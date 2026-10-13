import type { Event } from 'nostr-tools';
import { latLng } from 'leaflet';
import type { CircleLocation } from '../components/CircleLocationMap';

export const HITCHWIKI_RELAY = 'wss://relay.maps.hitchwiki.org';
// Publisher documented by Hitchwiki/hitchhiking-data-standard/nostr/README.md.
export const HITCHWIKI_AUTHOR =
  '6623bb9cbae2220e94d5f7581e0fd926db5d67538a08a7f306768e978d4d142e';
export const HITCHHIKING_KIND = 36820;
export const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

function displayTime(time: number): string {
  return `${new Date(time * 1000)
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ')} UTC`;
}

function waitingTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match =
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
      value,
    );
  if (!match || !match.slice(1).some(part => part !== undefined)) return null;
  const [, days = 0, hours = 0, minutes = 0, seconds = 0] = match;
  return `${Math.round(
    Number(days) * 1440 +
      Number(hours) * 60 +
      Number(minutes) +
      Number(seconds) / 60,
  )} min`;
}

function labels(values: unknown): string | null {
  if (!Array.isArray(values)) return null;
  const items = [
    ...new Set(
      values.filter(
        (value): value is string => typeof value === 'string' && !!value.trim(),
      ),
    ),
  ];
  return items.length
    ? items
        .map(value =>
          value.replace(/_/g, ' ').replace(/^./, char => char.toUpperCase()),
        )
        .join(', ')
    : null;
}

interface RideStop {
  location?: { latitude?: unknown; longitude?: unknown };
  waiting_duration?: unknown;
}

interface RideData {
  stops?: RideStop[];
  signals?: { methods?: unknown }[];
  hitchhikers?: { reasons_to_hitchhike?: unknown }[];
  submission_time?: unknown;
}

function rideFacts(
  data: RideData,
  origin: RideStop,
): NonNullable<CircleLocation['facts']> {
  const facts: NonNullable<CircleLocation['facts']> = [];
  const add = (label: string, value: string | null) => {
    if (value !== null) facts.push({ label, value });
  };
  add('Waiting time', waitingTime(origin.waiting_duration));
  const stops = data.stops;
  if (
    Array.isArray(stops) &&
    stops.length > 1 &&
    stops.every(
      (
        stop,
      ): stop is RideStop & {
        location: { latitude: number; longitude: number };
      } =>
        typeof stop?.location?.latitude === 'number' &&
        Number.isFinite(stop.location.latitude) &&
        Math.abs(stop.location.latitude) <= 90 &&
        typeof stop?.location?.longitude === 'number' &&
        Number.isFinite(stop.location.longitude) &&
        Math.abs(stop.location.longitude) <= 180,
    )
  ) {
    const distance = stops
      .slice(1)
      .reduce(
        (total, stop, index) =>
          total +
          latLng(
            stops[index].location.latitude,
            stops[index].location.longitude,
          ).distanceTo(latLng(stop.location.latitude, stop.location.longitude)),
        0,
      );
    add('Distance (straight line)', `${Math.round(distance / 1000)} km`);
  }
  add(
    'Signal',
    labels(
      Array.isArray(data.signals)
        ? data.signals.flatMap(signal =>
            Array.isArray(signal?.methods) ? signal.methods : [],
          )
        : null,
    ),
  );
  const submitted = parseTime(data.submission_time);
  if (Number.isFinite(submitted)) add('Submitted', displayTime(submitted));
  add(
    'Why hitchhiking',
    labels(
      Array.isArray(data.hitchhikers)
        ? data.hitchhikers.flatMap(person =>
            Array.isArray(person?.reasons_to_hitchhike)
              ? person.reasons_to_hitchhike
              : [],
          )
        : null,
    ),
  );
  return facts;
}

function parseTime(value: unknown): number {
  // RFC 9557 can add a named timezone after the RFC 3339 offset.
  return typeof value === 'string'
    ? Date.parse(value.replace(/\[[^\]]*\]$/u, '')) / 1000
    : NaN;
}

export function parseHitchhikingLocation(
  event: Event,
  now: number,
): CircleLocation | null {
  if (event.kind !== HITCHHIKING_KIND || event.pubkey !== HITCHWIKI_AUTHOR)
    return null;
  try {
    const data = JSON.parse(event.content);
    const source =
      typeof data.source === 'string'
        ? data.source.replace(/^https?:\/\//, '').replace(/\/$/, '')
        : '';
    const origin = data.stops?.[0];
    const latitude = origin?.location?.latitude;
    const longitude = origin?.location?.longitude;
    const d = event.tags.find(tag => tag[0] === 'd')?.[1];
    if (
      source !== 'maps.hitchwiki.org' ||
      !d ||
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    )
      return null;
    const recorded = parseTime(origin.arrival_time || origin.departure_time);
    const time = Number.isFinite(recorded)
      ? recorded
      : parseTime(data.submission_time);
    if (!Number.isFinite(time) || time < now - SEVEN_DAYS_SECONDS || time > now)
      return null;
    return {
      id: `${event.pubkey}:${d}`,
      name: 'Hitchhiking origin',
      latitude,
      longitude,
      facts: rideFacts(data, origin),
      details: [
        `${
          Number.isFinite(recorded)
            ? 'Recorded'
            : 'Submitted (ride date unknown)'
        }: ${displayTime(time)}`,
        ...(origin.location.is_exact === false
          ? ['Approximate reported location.']
          : []),
        `Source: ${source}`,
      ],
      link: {
        url: `https://maps.hitchwiki.org/ride/${encodeURIComponent(d)}`,
        label: 'View ride on Hitchwiki Maps',
      },
    };
  } catch {
    return null;
  }
}
