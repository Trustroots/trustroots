import { MIN_ZOOM } from './constants';

export const SOURCE_COMMUNITY_NOTES = 'community-notes';

const communityNotesClusterOptions = {
  source: SOURCE_COMMUNITY_NOTES,
  filter: ['has', 'point_count'],
  minzoom: MIN_ZOOM,
};

export const communityNotesClusterLayer = {
  ...communityNotesClusterOptions,
  id: 'community-notes-clusters',
  type: 'circle',
  paint: {
    'circle-color': 'rgba(25, 118, 210, 0.7)',
    'circle-radius': ['step', ['get', 'point_count'], 25, 100, 30, 750, 40],
  },
};

export const communityNotesClusterCountLayer = {
  ...communityNotesClusterOptions,
  id: 'community-notes-cluster-count',
  type: 'symbol',
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 12,
  },
  paint: {
    'text-color': '#ffffff',
  },
};

export const communityNotesLayer = {
  id: 'community-notes-points',
  type: 'circle',
  source: SOURCE_COMMUNITY_NOTES,
  filter: ['!', ['has', 'point_count']],
  minzoom: MIN_ZOOM,
  paint: {
    'circle-color': '#1565C0',
    // Make circles larger as the user zooms from z2 to z22
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
    'circle-stroke-width': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      3, // On hover
      1, // By default
    ],
    'circle-stroke-color': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      '#ffffff', // On hover
      '#1565C0', // By default
    ],
  },
};
