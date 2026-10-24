import { useEffect, useState } from 'react';
import useLocalStorageState from 'use-local-storage-state';

interface MapLocation {
  latitude: number;
  longitude: number;
  zoom: number;
}
interface SavedMapLocation extends MapLocation {
  version: 1;
  savedAt: number;
}
export const MAP_LOCATION_MAX_AGE = 48 * 60 * 60 * 1000;

export function isRecentMapLocation(
  value: unknown,
  now: number,
): value is SavedMapLocation {
  if (!value || typeof value !== 'object') return false;
  const saved = value as SavedMapLocation;
  return (
    saved.version === 1 &&
    Number.isFinite(saved.latitude) &&
    Math.abs(saved.latitude) <= 85 &&
    Number.isFinite(saved.longitude) &&
    Math.abs(saved.longitude) <= 180 &&
    Number.isFinite(saved.zoom) &&
    saved.zoom >= 0 &&
    saved.zoom <= 22 &&
    Number.isFinite(saved.savedAt) &&
    saved.savedAt <= now &&
    now - saved.savedAt < MAP_LOCATION_MAX_AGE
  );
}

const usePersistentMapLocation = (initialMapLocation: MapLocation) => {
  const [stored, setStored, { removeItem }] = useLocalStorageState<unknown>(
    'search-map-location',
    { defaultValue: undefined },
  );
  // Evaluate freshness once on entry; an active map does not expire underneath a member.
  const [initialSaved] = useState(() =>
    isRecentMapLocation(stored, Date.now()) ? stored : null,
  );
  const [mapLocation, setMapLocation] = useState<MapLocation>(
    initialSaved || initialMapLocation,
  );
  useEffect(() => {
    if (!initialSaved) removeItem();
  }, []);

  return [
    mapLocation,
    (newLocation: MapLocation) => {
      setMapLocation(newLocation);
      setStored({ ...newLocation, version: 1, savedAt: Date.now() });
    },
    Boolean(initialSaved),
  ] as const;
};

export default usePersistentMapLocation;
