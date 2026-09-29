import useLocalStorageState from 'use-local-storage-state';

interface MapLocation {
  latitude: number;
  longitude: number;
  zoom: number;
}

const usePersistentMapLocation = (initialMapLocation: MapLocation) => {
  const [mapLocation, setMapLocation] = useLocalStorageState(
    'search-map-location',
    { defaultValue: initialMapLocation },
  );

  return [
    mapLocation,
    (newLocation: MapLocation) => setMapLocation(newLocation),
  ] as const;
};

export default usePersistentMapLocation;
