import type { Event } from 'nostr-tools';
import type { CircleLocation } from '../components/CircleLocationMap';

export const HITCHWIKI_RELAY = 'wss://relay.maps.hitchwiki.org';
// Publisher documented by Hitchwiki/hitchhiking-data-standard/nostr/README.md.
export const HITCHWIKI_AUTHOR =
  '6623bb9cbae2220e94d5f7581e0fd926db5d67538a08a7f306768e978d4d142e';
export const HITCHHIKING_KIND = 36820;
export const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;
const sources = new Set([
  'maps.hitchwiki.org',
  'hitchwiki.org',
  'hitchmap.com',
  'liftershalte.info',
]);

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
      !sources.has(source) ||
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
      details: [
        `${
          Number.isFinite(recorded)
            ? 'Recorded'
            : 'Submitted (ride date unknown)'
        }: ${new Date(time * 1000).toISOString()}`,
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
