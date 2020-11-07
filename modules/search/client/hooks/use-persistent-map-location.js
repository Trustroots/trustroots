import createPersistedState from 'use-persisted-state';

// Module name + hook name as a key
const useMapLocationState = createPersistedState('search-map-location');

const usePersistentMapLocation = initialMapLocation => {
  const [mapLocation, setMapLocation] = useMapLocationState(initialMapLocation);

  return [mapLocation, newLocation => setMapLocation(newLocation)];
};

export default usePersistentMapLocation;
