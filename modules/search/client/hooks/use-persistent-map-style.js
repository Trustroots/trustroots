import useLocalStorageState from 'use-local-storage-state';

const useMapStyle = initialMapStyle => {
  const [mapStyle, setMapStyle] = useLocalStorageState('search-map-style', {
    defaultValue: initialMapStyle,
  });
  return [mapStyle, newStyle => setMapStyle(newStyle)];
};

export default useMapStyle;
