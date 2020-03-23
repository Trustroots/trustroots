import osmStyle from './osm.json';

export const MAPBOX_TOKEN = window.settings?.mapbox?.publicKey;
export const MAP_STYLE_MAPBOX_OUTDOORS = 'mapbox://styles/mapbox/outdoors-v11';
export const MAP_STYLE_MAPBOX_SATELLITE =
  'mapbox://styles/mapbox/satellite-streets-v11';
export const MAP_STYLE_MAPBOX_STREETS = 'mapbox://styles/mapbox/streets-v11';
export const MAP_STYLE_OSM = osmStyle;
export const MAP_STYLE_DEFAULT = MAPBOX_TOKEN
  ? MAP_STYLE_MAPBOX_STREETS
  : MAP_STYLE_OSM;
