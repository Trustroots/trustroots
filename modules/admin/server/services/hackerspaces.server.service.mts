export const SPACEAPI_COLLECTOR_URL = 'https://api.spaceapi.io/';

export interface CollectorResponse {
  ok: boolean;
  status?: number;
  json?(): Promise<unknown>;
}

export interface CollectorOptions {
  headers: { accept: string };
  signal: AbortSignal;
}

export type CollectorFetcher = (
  url: string,
  options: CollectorOptions,
) => Promise<CollectorResponse>;

export interface CollectorSnapshot {
  endpoint: string;
  valid: boolean;
  lastSeen: unknown;
  eligible: boolean;
  fetchedAt: string;
  name: unknown;
  website: string;
  latitude: number | null;
  longitude: number | null;
  address: string;
  addressParts: unknown[];
  description: unknown;
  open: string;
  spaceType: unknown;
}

function get(value: unknown, key: string): unknown {
  return value === null || value === undefined
    ? undefined
    : (value as Record<string, unknown>)[key];
}

function safeHttpUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function publicEndpoint(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      return `invalid:${value.slice(0, 256)}`;
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return `invalid:${value.slice(0, 256)}`;
  }
}

export function normaliseCollectorEntry(
  entry: unknown,
  fetchedAt: string,
): CollectorSnapshot {
  const data = get(entry, 'data');
  const location = get(data, 'location');
  const state = get(data, 'state');
  const latitude = Number(get(location, 'lat'));
  const longitude = Number(get(location, 'lon'));
  const eligible = Boolean(
    get(entry, 'valid') &&
    get(state, 'open') !== false &&
    data &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    get(data, 'space'),
  );
  const country = get(location, 'country') || get(location, 'country_code');
  return {
    endpoint: publicEndpoint(get(entry, 'url')),
    valid: Boolean(get(entry, 'valid')),
    lastSeen: get(entry, 'lastSeen') || null,
    eligible,
    fetchedAt,
    name: get(data, 'space') || '',
    website: safeHttpUrl(get(data, 'url')),
    latitude: eligible ? latitude : null,
    longitude: eligible ? longitude : null,
    address: [
      get(location, 'address'),
      get(location, 'city'),
      get(location, 'state'),
      get(location, 'zip'),
      country,
    ]
      .filter(Boolean)
      .join(', '),
    addressParts: [
      get(location, 'address') || '',
      get(location, 'city') || '',
      get(location, 'state') || '',
      get(location, 'zip') || '',
      country || '',
    ],
    description: get(data, 'description') || '',
    open:
      typeof get(state, 'open') === 'boolean'
        ? String(get(state, 'open') ? 'open' : 'closed')
        : '',
    spaceType: get(data, 'space_type') || 'hackerspace',
  };
}

async function fetchCollectorResponse(
  fetcher: CollectorFetcher,
  retry = true,
): Promise<CollectorResponse> {
  try {
    return await fetcher(SPACEAPI_COLLECTOR_URL, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    const cause = get(error, 'cause');
    const code = get(cause, 'code');
    const timeout =
      get(error, 'name') === 'TimeoutError' ||
      code === 'UND_ERR_CONNECT_TIMEOUT' ||
      code === 'ETIMEDOUT';
    const transient = timeout || code === 'ECONNRESET' || code === 'EAI_AGAIN';
    if (!transient) throw error;
    // The Collector GET is read-only; allow one fresh, bounded attempt.
    if (retry) return fetchCollectorResponse(fetcher, false);
    throw new Error(
      timeout
        ? 'SpaceAPI Collector request timed out. Please retry.'
        : 'SpaceAPI Collector could not be reached. Please retry.',
      { cause: error },
    );
  }
}

export async function fetchSpaceApiCollector(
  fetcher: CollectorFetcher = globalThis.fetch,
): Promise<CollectorSnapshot[]> {
  const response = await fetchCollectorResponse(fetcher);
  if (!response.ok)
    throw new Error(`SpaceAPI Collector returned ${response.status}`);
  const payload = await response.json!();
  const entries = Array.isArray(payload)
    ? payload
    : get(payload, 'spaces') || get(payload, 'data');
  if (!Array.isArray(entries))
    throw new Error('SpaceAPI Collector response was not a list');
  const fetchedAt = new Date().toISOString();
  return entries.map(entry => normaliseCollectorEntry(entry, fetchedAt));
}

const api = { normaliseCollectorEntry, fetchSpaceApiCollector };
export default api;
export { api as 'module.exports' };
