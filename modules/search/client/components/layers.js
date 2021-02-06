import { MIN_ZOOM, SOURCE_OFFERS } from './constants';

const clusterOptions = {
  source: SOURCE_OFFERS,
  filter: ['has', 'point_count'],
  minzoom: MIN_ZOOM,
};

export const clusterLayer = {
  ...clusterOptions,
  id: 'clusters',
  type: 'circle',
  paint: {
    'circle-color': 'rgba(18, 181, 145, 0.7)',
    // First circle size, then point count in a group
    'circle-radius': ['step', ['get', 'point_count'], 25, 100, 30, 750, 40],
  },
};

export const clusterCountLayerMapbox = {
  ...clusterOptions,
  id: 'cluster-count',
  type: 'symbol',
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 17,
  },
  paint: {
    'text-color': '#111',
  },
};

// OSM layer doesn't pull fonts from Mapbox and hence we override them
// This font has to exist at glyphs URL defined at modules/core/client/components/Map/osm.json
// See https://openmaptiles.org/docs/style/mapbox-gl-style-spec/
// See https://github.com/openmaptiles/fonts
export const clusterCountLayerOSM = {
  ...clusterCountLayerMapbox,
  layout: {
    ...clusterCountLayerMapbox.layout,
    // Has to be something available at https://github.com/openmaptiles/fonts/tree/gh-pages
    'text-font': ['Open Sans Bold'],
  },
};

// @TODO: https://docs.mapbox.com/mapbox-gl-js/example/hover-styles/
export const unclusteredPointLayer = {
  id: 'unclustered-point',
  type: 'circle',
  source: SOURCE_OFFERS,
  filter: ['!', ['has', 'point_count']],
  minzoom: MIN_ZOOM,
  // Data driven dot visual customizations
  // https://docs.mapbox.com/mapbox-gl-js/example/data-driven-circle-colors/
  paint: {
    'circle-color': [
      'case',
      ['boolean', ['feature-state', 'selected'], false],
      '#000', // On select
      // By default:
      [
        'match',
        ['get', 'offer'],

        // Meet
        'meet-yes',
        '#11b4da',

        // Host yes
        'host-yes',
        '#58ba58',

        // Host no
        'host-maybe',
        '#f2ae43',

        // Other:
        '#ccc',
      ],
    ],
    // Make circles larger as the user zooms from z6 to z22
    'circle-radius': {
      base: 1.75,
      stops: [
        // Zoom level, size
        [2, 3],
        [7, 12],
        [14, 14],
        [22, 20],
      ],
    },
    'circle-stroke-width': 3,
    'circle-stroke-opacity': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      1, // On hover
      0, // By default
    ],
    'circle-stroke-color': '#fff',
    'circle-opacity': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      1, // When hovered
      ['boolean', ['feature-state', 'selected'], false],
      1, // When selected
      ['boolean', ['feature-state', 'viewed'], false],
      0.7, // When viewed already previously
      1, // By default
    ],
  },
};
