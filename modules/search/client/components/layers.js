export const clusterLayer = {
  id: 'clusters',
  type: 'circle',
  source: 'offers',
  filter: ['has', 'point_count'],
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
  },
};

export const clusterCountLayer = {
  id: 'cluster-count',
  type: 'symbol',
  source: 'offers',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 17,
    // 'color': '#555',
  },
};

// @TODO: https://docs.mapbox.com/mapbox-gl-js/example/hover-styles/
export const unclusteredPointLayer = {
  id: 'unclustered-point',
  type: 'circle',
  source: 'offers',
  filter: ['!', ['has', 'point_count']],
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
  },
};
