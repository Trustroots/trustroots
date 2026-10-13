import { OpenLocationCode } from 'open-location-code';

export interface SpaceApiPlace {
  endpoint: string;
  name: string;
  website: string;
  latitude: number;
  longitude: number;
  address: string;
  addressParts?: [string, string, string, string, string];
  description: string;
  open: string;
  fetchedAt: string;
  spaceType: string;
}

export interface AddressablePlaceEvent {
  id: string;
  pubkey: string;
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  sig: string;
}

const GEOHASH_ALPHABET = '0123456789bcdefghjkmnpqrstuvwxyz';
export function geohash(
  latitude: number,
  longitude: number,
  precision: number,
) {
  const latitudeRange = [-90, 90];
  const longitudeRange = [-180, 180];
  let even = true;
  let bit = 0;
  let value = 0;
  let result = '';
  while (result.length < precision) {
    const range = even ? longitudeRange : latitudeRange;
    const coordinate = even ? longitude : latitude;
    const middle = (range[0] + range[1]) / 2;
    value = (value << 1) | (coordinate >= middle ? 1 : 0);
    if (coordinate >= middle) range[0] = middle;
    else range[1] = middle;
    even = !even;
    if (++bit === 5) {
      result += GEOHASH_ALPHABET[value];
      bit = 0;
      value = 0;
    }
  }
  return result;
}

export function getSpaceApiIdentifier(endpoint: string) {
  return `spaceapi:${endpoint}`;
}

export function buildSpaceApiPlaceEvent(space: SpaceApiPlace) {
  if (space.open === 'closed')
    throw new Error(
      'Closed hackerspaces cannot be published as active places.',
    );
  const tags: string[][] = [
    ['d', getSpaceApiIdentifier(space.endpoint)],
    ['L', 'physical-location'],
    ['l', space.spaceType || 'hackerspace', 'physical-location'],
    ['name', space.name],
    ['website', space.website],
    ['address', ...(space.addressParts || [space.address, '', '', '', ''])],
    ['meta', 'source', 'https://api.spaceapi.io/'],
    ['meta', 'fetched_at', space.fetchedAt],
    ['meta', 'verification', 'spaceapi-reported; not-human-verified'],
    ['meta', 'status', 'active'],
    ['meta', 'open', space.open],
  ];
  for (let precision = 1; precision <= 12; precision += 1) {
    tags.push(['g', geohash(space.latitude, space.longitude, precision)]);
  }
  try {
    tags.push([
      'l',
      new OpenLocationCode().encode(space.latitude, space.longitude, 10),
      'open-location-code',
    ]);
  } catch {
    // Plus Codes are optional display metadata.
  }
  return {
    kind: 33000,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content:
      space.description ||
      'SpaceAPI-reported place. Location has not been independently verified.',
  };
}

export function buildInactiveSpaceApiPlaceEvent(event: AddressablePlaceEvent) {
  const tags = event.tags.filter(
    tag => !(tag[0] === 'meta' && tag[1] === 'status'),
  );
  tags.push(['meta', 'status', 'inactive']);
  return {
    kind: 33000,
    created_at: Math.max(Math.floor(Date.now() / 1000), event.created_at + 1),
    tags,
    content: event.content,
  };
}
