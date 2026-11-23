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
