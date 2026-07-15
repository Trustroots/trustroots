export const getMapBoxToken = () =>
  typeof window !== 'undefined' && window.settings?.mapbox?.publicKey;

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
