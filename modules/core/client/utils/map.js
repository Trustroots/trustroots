export const getMapBoxToken = () =>
  typeof window !== 'undefined' && window.settings?.mapbox?.publicKey;

const MAPBOX_STREETS_TILE_URL =
  'https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/{z}/{x}/{y}?access_token={accessToken}';
const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAPBOX_ATTRIBUTION =
  '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Return the raster tiles for Leaflet fallbacks. Mapbox Streets mirrors the
 * normal WebGL map when a public token is available; OSM remains available
 * for installations that do not configure Mapbox.
 */
export const getRasterMapTiles = (mapboxToken = getMapBoxToken()) =>
  mapboxToken
    ? {
        options: {
          accessToken: mapboxToken,
          attribution: MAPBOX_ATTRIBUTION,
          maxZoom: 19,
        },
        url: MAPBOX_STREETS_TILE_URL,
      }
    : {
        options: {
          attribution: OSM_ATTRIBUTION,
          maxZoom: 19,
        },
        url: OSM_TILE_URL,
      };

export const addRasterMapTiles = ({
  map,
  mapboxToken = getMapBoxToken(),
  tileLayer,
}) => {
  const primaryTiles = getRasterMapTiles(mapboxToken);
  const primaryLayer = tileLayer(primaryTiles.url, primaryTiles.options);
  let fallbackStarted = false;

  if (mapboxToken) {
    primaryLayer.once('tileerror', () => {
      if (fallbackStarted) {
        return;
      }
      fallbackStarted = true;
      primaryLayer.remove();
      const fallbackTiles = getRasterMapTiles(null);
      tileLayer(fallbackTiles.url, fallbackTiles.options).addTo(map);
    });
  }

  primaryLayer.addTo(map);
  return primaryLayer;
};

/**
 * Mapbox GL needs a WebGL context, so callers choose a raster renderer before
 * mounting it when the browser cannot create one.
 */
const getBrowserDocument = () => {
  /* istanbul ignore next -- the server-side path has no DOM to exercise */
  return typeof document === 'undefined' ? null : document;
};

export const isWebGLSupported = (browserDocument = getBrowserDocument()) => {
  if (!browserDocument) {
    return false;
  }

  try {
    const canvas = browserDocument.createElement('canvas');
    return Boolean(
      canvas.getContext?.('webgl') || canvas.getContext?.('experimental-webgl'),
    );
  } catch {
    return false;
  }
};
