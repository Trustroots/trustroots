import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

// MapLibre resolves its worker next to its own module at runtime, which the
// bundle does not emit; every map imports this file, so point it here.
setWorkerUrl(workerUrl);

export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
