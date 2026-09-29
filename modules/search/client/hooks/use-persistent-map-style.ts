import useLocalStorageState from 'use-local-storage-state';
import { MAP_STYLE_OSM } from '@/modules/core/client/components/Map/constants';

type MapStyle = string | typeof MAP_STYLE_OSM;

const useMapStyle = (initialMapStyle: MapStyle) => {
  const [mapStyle, setMapStyle] = useLocalStorageState<MapStyle>('search-map-style', {
    defaultValue: initialMapStyle,
  });
  return [mapStyle, (newStyle: MapStyle) => setMapStyle(newStyle)] as const;
};

export default useMapStyle;
