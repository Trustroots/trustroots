export const getMapBoxToken = () =>
  typeof window !== 'undefined' && window.settings?.mapbox?.publicKey;
