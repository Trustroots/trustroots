export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

/** Raster tiles for browsers without WebGL2; OpenFreeMap serves vector tiles only. */
export const RASTER_TILES = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};
