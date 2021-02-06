import createPersistedState from 'use-persisted-state';

// Module name + hook name as a key
const useMapStyleState = createPersistedState('search-map-style');

const useMapStyle = initialMapStyle => {
  const [mapStyle, setMapStyle] = useMapStyleState(initialMapStyle);
  return [mapStyle, newStyle => setMapStyle(newStyle)];
};

export default useMapStyle;
