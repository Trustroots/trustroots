export const getMapBoxToken = () =>
  typeof window !== 'undefined' && window.settings?.mapbox?.publicKey;

const getBrowserDocument = () => {
  /* istanbul ignore next -- the server-side path has no DOM to exercise */
  return typeof document === 'undefined' ? null : document;
};

/** MapLibre GL needs WebGL2; callers show a notice instead of the map without it. */
export const isWebGLSupported = (browserDocument = getBrowserDocument()) => {
  if (!browserDocument) {
    return false;
  }

  try {
    const canvas = browserDocument.createElement('canvas');
    return Boolean(canvas.getContext?.('webgl2'));
  } catch {
    return false;
  }
};

/** Great-circle distance in metres between two `[latitude, longitude]` points. */
export const distanceInMetres = (
  [lat1, lng1]: readonly [number, number],
  [lat2, lng2]: readonly [number, number],
) => {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) *
      Math.cos(lat2 * rad) *
      Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
};
