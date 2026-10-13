export const SPACEAPI_COLLECTOR_URL = 'https://api.spaceapi.io/';

function safeHttpUrl(value) {
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

function publicEndpoint(value) {
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

export function normaliseCollectorEntry(entry, fetchedAt) {
  const data = entry?.data;
  const location = data?.location;
  const latitude = Number(location?.lat);
  const longitude = Number(location?.lon);
  const eligible = Boolean(
    entry?.valid &&
      data?.state?.open !== false &&
      data &&
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180 &&
      data.space,
  );
  return {
    endpoint: publicEndpoint(entry?.url),
    valid: Boolean(entry?.valid),
    lastSeen: entry?.lastSeen || null,
    eligible,
    fetchedAt,
    name: data?.space || '',
    website: safeHttpUrl(data?.url),
    latitude: eligible ? latitude : null,
    longitude: eligible ? longitude : null,
    address: [
      location?.address,
      location?.city,
      location?.state,
      location?.zip,
      location?.country || location?.country_code,
    ]
      .filter(Boolean)
      .join(', '),
    addressParts: [
      location?.address || '',
      location?.city || '',
      location?.state || '',
      location?.zip || '',
      location?.country || location?.country_code || '',
    ],
    description: data?.description || '',
    open:
      typeof data?.state?.open === 'boolean'
        ? String(data.state.open ? 'open' : 'closed')
        : '',
    spaceType: data?.space_type || 'hackerspace',
  };
}

export async function fetchSpaceApiCollector(fetcher = fetch) {
  const response = await fetcher(SPACEAPI_COLLECTOR_URL, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(`SpaceAPI Collector returned ${response.status}`);
  const payload = await response.json();
  const entries = Array.isArray(payload)
    ? payload
    : payload?.spaces || payload?.data;
  if (!Array.isArray(entries))
    throw new Error('SpaceAPI Collector response was not a list');
  const fetchedAt = new Date().toISOString();
  return entries.map(entry => normaliseCollectorEntry(entry, fetchedAt));
}
