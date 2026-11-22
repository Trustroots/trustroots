import { useState } from 'react';
import { getMapBoxToken, isWebGLSupported } from '../../utils/map';

export default function useMapRenderer() {
  const [renderer] = useState(() => {
    const mapboxToken = getMapBoxToken() || undefined;

    return {
      mapboxToken,
      useWebGL: isWebGLSupported() && Boolean(mapboxToken),
    };
  });
  return renderer;
}
