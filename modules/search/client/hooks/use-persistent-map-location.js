import useLocalStorageState from 'use-local-storage-state';

const usePersistentMapLocation = initialMapLocation => {
  const [mapLocation, setMapLocation] = useLocalStorageState(
    'search-map-location',
    { defaultValue: initialMapLocation },
  );

  return [mapLocation, newLocation => setMapLocation(newLocation)];
};

export default usePersistentMapLocation;
