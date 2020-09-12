import {
  HEATMAP_MAX_ZOOM,
  HEATMAP_MIN_ZOOM,
  HEATMAP_OPACITY_BUFFER,
  SOURCE_OFFERS,
  SOURCE_HEATMAP,
} from './constants';

// Transition from heatmap to circle layer by zoom level
const offersOpacityTransition = [
  'interpolate',
  ['linear'],
  ['zoom'],
  // From heatmap to circle layer (opacity from 0 to 1)
  HEATMAP_MAX_ZOOM - HEATMAP_OPACITY_BUFFER,
  0,
  HEATMAP_MAX_ZOOM,
  1,
];

// Transition from nothing to heatmap, and from heatmap to circle layer by zoom level
const heatmapOpacityTransition = [
  'interpolate',
  ['linear'],
  ['zoom'],
  // From nothing to heatmap (opacity from 0 to 1)
  HEATMAP_MIN_ZOOM,
  0,
  HEATMAP_MIN_ZOOM + HEATMAP_OPACITY_BUFFER,
  1,
  // From heatmap to circle layer (opacity from 1 to 0)
  HEATMAP_MAX_ZOOM - HEATMAP_OPACITY_BUFFER,
  1,
  HEATMAP_MAX_ZOOM,
  0,
];

export const clusterLayer = {
  id: 'clusters',
  type: 'circle',
  source: SOURCE_OFFERS,
  filter: ['has', 'point_count'],
  minzoom: HEATMAP_MAX_ZOOM - HEATMAP_OPACITY_BUFFER,
  paint: {
    'circle-color': 'rgba(18, 181, 145, 0.7)',
    /* [
      'step',
      ['get', 'point_count'],
      '#51bbd6',
      100,
      '#f1f075',
      750,
      '#f28cb1',
    ],*/
    // 'fill-opacity': 0.9,
    'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
    'circle-stroke-width': 5,
    'circle-stroke-color': 'rgba(18, 181, 145, 0.3)',
    'circle-opacity': offersOpacityTransition,
    'circle-stroke-opacity': offersOpacityTransition,
  },
};

export const clusterCountLayerMapbox = {
  id: 'cluster-count',
  type: 'symbol',
  source: SOURCE_OFFERS,
  filter: ['has', 'point_count'],
  minzoom: HEATMAP_MAX_ZOOM,
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 17,
    // 'color': '#555',
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
  minzoom: HEATMAP_MAX_ZOOM - HEATMAP_OPACITY_BUFFER,
  // Data driven dot visual customizations
  // https://docs.mapbox.com/mapbox-gl-js/example/data-driven-circle-colors/
  paint: {
    // color circles by offer type, using a match expression
    // https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-match
    'circle-color': [
      'match',
      // @TODO: ideally we'd pull both `type` and `status` properties and combine
      // those here, and we wouldn't need to send `offer` property via API.
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
    // make circles larger as the user zooms from z6 to z22
    'circle-radius': {
      base: 1.75,
      stops: [
        // Zoom level, size
        [2, 2],
        [7, 10],
        [10, 12],
        [22, 80],
      ],
    },
    /*
    // @TODO: visual and performance difference between this and above? test with many dots.
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      // [Zoom level, size]
      [2, 2],
      [6, 4],
      [10, 10],
      [22, 80],
    ],
    */
    // @TODO: remove stroke in higher zoom levels?
    // @TODO: show stroke only on hover, otherwise none?
    'circle-stroke-width': 1,
    'circle-stroke-color': '#fff',
    'circle-opacity': offersOpacityTransition,
  },
};

export const heatMapLayer = {
  id: 'heatmap',
  type: 'heatmap',
  source: SOURCE_HEATMAP,
  maxzoom: HEATMAP_MAX_ZOOM + HEATMAP_OPACITY_BUFFER,
  minzoom: HEATMAP_MIN_ZOOM,
  paint: {
    // Increase the heatmap weight based on frequency and property magnitude
    // 'heatmap-weight': ['interpolate', ['linear'], ['get', 'mag'], 0, 0, 6, 1],
    // Increase the heatmap color weight weight by zoom level
    // heatmap-intensity is a multiplier on top of heatmap-weight
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
    // Color ramp for heatmap.  Domain is 0 (low) to 1 (high).
    // Begin color ramp at 0-stop with a 0-transparancy color
    // to create a blur-like effect.
    'heatmap-color': [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0,
      'rgba(18, 181, 145, 0)',
      0.2,
      'rgba(18, 181, 145, 0.2)',
      0.6,
      'rgba(18, 181, 145, 0.5)',
      1,
      'rgba(18, 181, 145, 0.8)',
    ],
    // Adjust the heatmap radius by zoom level
    // 'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 20],
    // Transition from heatmap to circle layer by zoom level
    'heatmap-opacity': heatmapOpacityTransition,
  },
};
