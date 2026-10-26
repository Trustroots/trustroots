import ipaddr from 'ipaddr.js';
import type { CityResponse } from 'maxmind';

export interface ApproximateViewport {
  latitude: number;
  longitude: number;
  zoom: number;
}

interface DatabaseReader {
  get(address: string): CityResponse | null;
}
type OpenDatabase = (path: string) => Promise<DatabaseReader>;

async function openDatabase(path: string): Promise<DatabaseReader> {
  const { open } = await import('maxmind');
  return open<CityResponse>(path, { cache: { max: 1000 } });
}

export function approximateViewport(
  record: CityResponse | null,
): ApproximateViewport | null {
  const location = record?.location;
  if (
    !location ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude) ||
    !Number.isFinite(location.accuracy_radius) ||
    Math.abs(location.latitude!) > 90 ||
    Math.abs(location.longitude!) > 180 ||
    location.accuracy_radius! <= 0 ||
    location.accuracy_radius! > 20040
  )
    return null;

  const latitude = Math.max(-85, Math.min(85, Math.round(location.latitude!)));
  const longitude = Math.round(location.longitude!);
  // Include rounding error and allow a small (256px) map to show the area.
  const diameter = 2 * (location.accuracy_radius! + 160);
  const circumference = 40075 * Math.cos((latitude * Math.PI) / 180);
  const zoom = Math.max(
    0,
    Math.min(6, Math.floor(Math.log2(circumference / diameter))),
  );
  return { latitude, longitude, zoom };
}

export function createGeoipLookup(
  databasePath: string,
  open: OpenDatabase = openDatabase,
) {
  // Start once when the web routes load, never open files in the request path.
  const ready = databasePath
    ? Promise.resolve()
        .then(() => open(databasePath))
        .catch(() => null)
    : Promise.resolve(null);
  return async (
    address: string | undefined,
  ): Promise<ApproximateViewport | null> => {
    if (!address || !ipaddr.isValid(address)) return null;
    const parsed = ipaddr.process(address);
    if (parsed.range() !== 'unicast') return null;
    const reader = await ready;
    if (!reader) return null;
    try {
      return approximateViewport(reader.get(parsed.toString()));
    } catch {
      return null;
    }
  };
}
