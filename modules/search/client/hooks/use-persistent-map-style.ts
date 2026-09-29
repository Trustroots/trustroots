import useLocalStorageState from 'use-local-storage-state';

const useMapStyle = (initialMapStyle: string) => {
  const [mapStyle, setMapStyle] = useLocalStorageState('search-map-style', {
    defaultValue: initialMapStyle,
  });
  return [mapStyle, (newStyle: string) => setMapStyle(newStyle)] as const;
};

export default useMapStyle;
