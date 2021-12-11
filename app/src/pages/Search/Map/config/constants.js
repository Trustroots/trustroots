import { getMapBoxToken } from './getMapBoxToken';
import osmStyle from './osm.json';

export const MAP_STYLE_MAPBOX_OUTDOORS = 'mapbox://styles/mapbox/outdoors-v11';
export const MAP_STYLE_MAPBOX_SATELLITE =
  'mapbox://styles/mapbox/satellite-streets-v11';
export const MAP_STYLE_MAPBOX_STREETS = 'mapbox://styles/mapbox/streets-v11';
export const MAP_STYLE_OSM = osmStyle;
export const MAP_STYLE_DEFAULT = getMapBoxToken()
  ? MAP_STYLE_MAPBOX_STREETS
  : MAP_STYLE_OSM;


  export const DEFAULT_LOCATION = {
    lat: 48.6908333333,
    lng: 9.14055555556,
    zoom: 6,
  };
  

export const SOURCE_OFFERS = 'offers';

// Minimum zoom level when offers are shown
export const MIN_ZOOM = 2;

export const CLUSTER_MAX_ZOOM = 12;
