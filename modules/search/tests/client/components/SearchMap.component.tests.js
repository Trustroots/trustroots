import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import { MAP_STYLE_OSM } from '@/modules/core/client/components/Map/constants';
import { DEFAULT_LOCATION } from '@/modules/core/client/utils/constants';
import SearchMap from '@/modules/search/client/components/SearchMap.component';

const mockIsWebGLSupported = jest.fn();
jest.mock('@/modules/core/client/utils/map', () => ({
  ...jest.requireActual('@/modules/core/client/utils/map'),
  isWebGLSupported: () => mockIsWebGLSupported(),
}));

const mockGetNostrEventAuthorPubkey = jest.fn(
  event => event.authorPubkey || event.pubkey,
);
const mockSubscribeMapNotes = jest.fn();
const mockUnsubscribeMapNotes = jest.fn();
jest.mock('@/modules/search/client/services/nostr.client.service', () => ({
  getNostrEventAuthorPubkey: event => mockGetNostrEventAuthorPubkey(event),
  nostrService: {
    subscribeMapNotes: (...args) => mockSubscribeMapNotes(...args),
    unsubscribeMapNotes: (...args) => mockUnsubscribeMapNotes(...args),
  },
}));

const mockGetOffer = jest.fn();
const mockQueryOffers = jest.fn();
jest.mock('@/modules/offers/client/api/offers.api', () => ({
  getOffer: (...args) => mockGetOffer(...args),
  queryOffers: (...args) => mockQueryOffers(...args),
}));

jest.mock('use-debounce', () => ({
  useDebouncedCallback: callback => [callback],
}));

let mockPersistentMapLocation = {
  latitude: 48.6908333333,
  longitude: 9.14055555556,
  zoom: 2,
};
const mockSetPersistentMapLocation = jest.fn();
jest.mock('@/modules/search/client/hooks/use-persistent-map-location', () => ({
  __esModule: true,
  default: () => [mockPersistentMapLocation, mockSetPersistentMapLocation],
}));

let mockMapStyle = 'mock-map-style';
const mockSetMapStyle = jest.fn();
jest.mock('@/modules/search/client/hooks/use-persistent-map-style', () => ({
  __esModule: true,
  default: () => [mockMapStyle, mockSetMapStyle],
}));

jest.mock('@/modules/core/client/components/Map/MapNavigationControl', () => {
  return function MockMapNavigationControl() {
    return <div data-testid="map-navigation-control" />;
  };
});

jest.mock('@/modules/core/client/components/Map/MapScaleControl', () => {
  return function MockMapScaleControl() {
    return <div data-testid="map-scale-control" />;
  };
});

jest.mock('@/modules/core/client/components/Map/MapStyleControl', () => {
  return function MockMapStyleControl() {
    return <button type="button">Map style</button>;
  };
});

jest.mock('@/modules/search/client/components/SearchMapNoContent', () => {
  return function MockSearchMapNoContent() {
    return <div>Zoom closer to find members.</div>;
  };
});

const mockLeafletSearchMap = jest.fn();
jest.mock('@/modules/search/client/components/LeafletSearchMap', () =>
  jest.fn(props => {
    mockLeafletSearchMap(props);
    return <div data-testid="leaflet-search-map" />;
  }),
);

const mockFitBounds = jest.fn();
const mockMap = {
  getBounds: jest.fn(),
  getFeatureState: jest.fn(),
  getSource: jest.fn(),
  getZoom: jest.fn(),
  setFeatureState: jest.fn(),
};
let mockMapInstance = mockMap;
let mockMapProps;
let mockSourceProps;
let mockSourcePropsById;
const mockSource = {
  getClusterExpansionZoom: jest.fn(),
};
let mockSourceInstance = mockSource;
jest.mock('react-map-gl', () => {
  const React = require('react');

  const MockReactMapGL = React.forwardRef(function MockReactMapGL(
    { children, ...props },
    ref,
  ) {
    mockMapProps = props;
    React.useImperativeHandle(ref, () => ({
      getMap: () => mockMapInstance,
    }));
    return React.createElement(
      'div',
      { 'data-testid': 'react-map-gl' },
      children,
    );
  });
  MockReactMapGL.propTypes = {
    children: () => null,
  };

  const Source = React.forwardRef(function MockSource(
    { children, ...props },
    ref,
  ) {
    mockSourceProps = props;
    mockSourcePropsById[props.id] = props;
    React.useImperativeHandle(ref, () => ({
      getSource: () => mockSourceInstance,
    }));
    return React.createElement(
      'div',
      { 'data-testid': 'map-source' },
      children,
    );
  });
  Source.propTypes = {
    children: () => null,
    id: () => null,
  };

  function Layer(props) {
    return React.createElement('div', {
      'data-testid': `map-layer-${props.id}`,
    });
  }
  Layer.propTypes = {
    id: () => null,
  };

  return {
    __esModule: true,
    default: MockReactMapGL,
    FlyToInterpolator: jest.fn(function FlyToInterpolator(options) {
      this.options = options;
    }),
    Layer,
    Source,
    WebMercatorViewport: jest.fn(function WebMercatorViewport() {
      return {
        fitBounds: (...args) => mockFitBounds(...args),
      };
    }),
  };
});

function renderSearchMap(props = {}) {
  return render(
    <SearchMap
      filters="{}"
      isUserPublic={true}
      onOfferClose={jest.fn()}
      onOfferOpen={jest.fn()}
      {...props}
    />,
  );
}

beforeEach(() => {
  mockIsWebGLSupported.mockReturnValue(true);
  mockLeafletSearchMap.mockClear();
  mockSourcePropsById = {};
  mockPersistentMapLocation = {
    latitude: 48.6908333333,
    longitude: 9.14055555556,
    zoom: 2,
  };
  mockMapStyle = 'mock-map-style';
  mockFitBounds.mockReturnValue({
    latitude: 52,
    longitude: 13,
    zoom: 8,
  });
  mockMap.getBounds.mockReturnValue({
    getNorthEast: () => ({ lat: 89.5, lng: 179.5 }),
    getSouthWest: () => ({ lat: -89.5, lng: -179.5 }),
  });
  mockMap.getFeatureState.mockReturnValue({ existing: true });
  mockMap.getZoom.mockReturnValue(8);
  mockMapInstance = mockMap;
  mockSource.getClusterExpansionZoom.mockImplementation((clusterId, done) =>
    done(null, 18),
  );
  mockSourceInstance = mockSource;
  mockMap.getSource.mockImplementation(() => mockSourceInstance);
  mockGetOffer.mockResolvedValue({ _id: 'offer-1' });
  mockQueryOffers.mockResolvedValue({
    features: [],
    type: 'FeatureCollection',
  });
  mockGetNostrEventAuthorPubkey.mockImplementation(
    event => event.authorPubkey || event.pubkey,
  );
  mockSubscribeMapNotes.mockResolvedValue({ close: jest.fn() });
  jest.clearAllMocks();
});

describe('Search', () => {
  it('Map loads', async () => {
    render(
      <SearchMap
        filters="{}"
        isUserPublic={true}
        onOfferClose={() => {}}
        onOfferOpen={() => {}}
      />,
    );
  });

  it('uses the Leaflet renderer when WebGL is unavailable', async () => {
    mockIsWebGLSupported.mockReturnValue(false);

    renderSearchMap();

    expect(screen.getByTestId('leaflet-search-map')).toBeInTheDocument();
    expect(screen.queryByTestId('react-map-gl')).not.toBeInTheDocument();
    expect(mockLeafletSearchMap).toHaveBeenCalledWith(
      expect.objectContaining({
        communityNotes: expect.objectContaining({ features: [] }),
        offers: expect.objectContaining({ features: [] }),
        onCommunityNoteClick: expect.any(Function),
        onMapChange: expect.any(Function),
        onOfferClick: expect.any(Function),
      }),
    );

    const mapState = {
      bounds: {
        northEast: { lat: 53, lng: 14 },
        southWest: { lat: 51, lng: 12 },
      },
      latitude: 52,
      longitude: 13,
      zoom: 6,
    };

    act(() => {
      mockLeafletSearchMap.mock.calls[0][0].onMapChange(mapState);
    });

    expect(mockSetPersistentMapLocation).toHaveBeenCalledWith({
      latitude: 52,
      longitude: 13,
      zoom: 6,
    });
    await waitFor(() =>
      expect(mockQueryOffers).toHaveBeenCalledWith({
        filters: '{}',
        northEastLat: 54.666666666666664,
        northEastLng: 15.666666666666666,
        southWestLat: 49.333333333333336,
        southWestLng: 10.333333333333334,
      }),
    );
  });

  it('passes selected location bounds directly to the Leaflet renderer', () => {
    const locationBounds = {
      northEast: { lat: 52.6755, lng: 13.7611 },
      southWest: { lat: 52.3383, lng: 13.0884 },
    };
    mockIsWebGLSupported.mockReturnValue(false);

    renderSearchMap({ locationBounds });

    expect(mockLeafletSearchMap).toHaveBeenCalledWith(
      expect.objectContaining({ bounds: locationBounds }),
    );
    expect(mockFitBounds).not.toHaveBeenCalled();
  });

  it('stores viewport changes without persisting map dimensions', () => {
    renderSearchMap();

    act(() => {
      mockMapProps.onViewportChange({
        height: 400,
        latitude: 51,
        longitude: 12,
        width: 700,
        zoom: 9,
      });
    });

    expect(mockSetPersistentMapLocation).toHaveBeenCalledWith({
      latitude: 51,
      longitude: 12,
      zoom: 9,
    });
    expect(mockMapProps.latitude).toBe(51);
    expect(mockMapProps.longitude).toBe(12);
    expect(mockMapProps.zoom).toBe(9);
    expect(mockMapProps.width).toBe('100%');
  });

  it('uses the default map location when persisted coordinates are missing', () => {
    mockPersistentMapLocation = {
      zoom: 2,
    };

    renderSearchMap();

    expect(mockMapProps.location).toEqual([
      DEFAULT_LOCATION.lat,
      DEFAULT_LOCATION.lng,
    ]);
    expect(mockMapProps.zoom).toBe(2);
  });

  it('accepts missing filters as an empty filter set', () => {
    renderSearchMap({
      filters: undefined,
    });

    expect(mockMapProps.interactiveLayerIds).toEqual([
      'clusters',
      'unclustered-point',
    ]);
  });

  it('falls back to OSM when a mapbox style is persisted without a token', () => {
    mockMapStyle = 'mapbox://styles/trustroots/custom';

    renderSearchMap();

    expect(mockMapProps.mapStyle).toBe(MAP_STYLE_OSM);
  });

  it('queries public offers inside the visible map bounds', async () => {
    mockPersistentMapLocation = {
      ...mockPersistentMapLocation,
      zoom: 6,
    };

    renderSearchMap({
      filters: '{"hosting":"yes"}',
    });

    await waitFor(() => expect(mockQueryOffers).toHaveBeenCalledTimes(1));
    expect(mockQueryOffers).toHaveBeenLastCalledWith({
      filters: '{"hosting":"yes"}',
      northEastLat: 90,
      northEastLng: 180,
      southWestLat: -90,
      southWestLng: -180,
    });

    mockQueryOffers.mockClear();
    act(() => {
      mockMapProps.onInteractionStateChange();
    });

    await waitFor(() => expect(mockQueryOffers).toHaveBeenCalledTimes(1));
    expect(mockSourceProps.data).toEqual({
      features: [],
      type: 'FeatureCollection',
    });
  });

  it('does not query private member map offers', async () => {
    const onOfferClose = jest.fn();
    mockPersistentMapLocation = {
      ...mockPersistentMapLocation,
      zoom: 6,
    };

    renderSearchMap({
      isUserPublic: false,
      onOfferClose,
    });

    await waitFor(() => expect(onOfferClose).toHaveBeenCalledTimes(1));
    expect(mockQueryOffers).not.toHaveBeenCalled();
  });

  it('does not query offers when the map ref is not available yet', async () => {
    mockPersistentMapLocation = {
      ...mockPersistentMapLocation,
      zoom: 6,
    };
    mockMapInstance = null;

    renderSearchMap();

    await waitFor(() => expect(mockMapProps.zoom).toBe(6));
    expect(mockQueryOffers).not.toHaveBeenCalled();
  });

  it('closes any open offer when the map canvas is clicked', async () => {
    const onOfferClose = jest.fn();
    renderSearchMap({ onOfferClose });

    await waitFor(() => expect(onOfferClose).toHaveBeenCalledTimes(1));
    onOfferClose.mockClear();

    act(() => {
      mockMapProps.onClick({ features: [] });
    });

    expect(onOfferClose).toHaveBeenCalledTimes(1);
  });

  it('ignores hover events that do not identify a new offer point', () => {
    renderSearchMap();

    act(() => {
      mockMapProps.onHover({ features: [] });
      mockMapProps.onHover({
        features: [
          {
            id: 'cluster-1',
            layer: { id: 'clusters' },
            source: 'offers',
          },
        ],
      });
      mockMapProps.onHover({
        features: [
          {
            layer: { id: 'unclustered-point' },
            source: 'offers',
          },
        ],
      });
    });

    expect(mockMap.setFeatureState).not.toHaveBeenCalled();
  });

  it('marks clicked offers selected and opens the offer details', async () => {
    const onOfferOpen = jest.fn();
    const offer = { _id: 'offer-1', offer: 'host-yes' };
    mockGetOffer.mockResolvedValueOnce(offer);

    renderSearchMap({ onOfferOpen });

    act(() => {
      mockMapProps.onClick({
        features: [
          {
            id: 'offer-1',
            layer: { id: 'unclustered-point' },
            source: 'offers',
          },
        ],
      });
    });

    expect(mockMap.setFeatureState).toHaveBeenCalledWith(
      { id: 'offer-1', source: 'offers' },
      {
        existing: true,
        selected: true,
        viewed: true,
      },
    );
    await waitFor(() => expect(onOfferOpen).toHaveBeenCalledWith(offer));
  });

  it('ignores unclustered offer clicks that do not include an offer id', () => {
    renderSearchMap();

    act(() => {
      mockMapProps.onClick({
        features: [
          {
            layer: { id: 'unclustered-point' },
            source: 'offers',
          },
        ],
      });
    });

    expect(mockGetOffer).not.toHaveBeenCalled();
  });

  it('clears the previous selected offer when selecting another one', () => {
    renderSearchMap();

    act(() => {
      mockMapProps.onClick({
        features: [
          {
            id: 'offer-1',
            layer: { id: 'unclustered-point' },
            source: 'offers',
          },
        ],
      });
    });
    act(() => {
      mockMapProps.onClick({
        features: [
          {
            id: 'offer-2',
            layer: { id: 'unclustered-point' },
            source: 'offers',
          },
        ],
      });
    });

    expect(mockMap.setFeatureState).toHaveBeenCalledWith(
      { id: 'offer-1', source: 'offers' },
      {
        existing: true,
        selected: false,
      },
    );
  });

  it('does not open the sidebar when clicked offer details are unavailable', async () => {
    const onOfferOpen = jest.fn();
    mockGetOffer.mockResolvedValueOnce(null);

    renderSearchMap({ onOfferOpen });

    act(() => {
      mockMapProps.onClick({
        features: [
          {
            id: 'missing-offer',
            layer: { id: 'unclustered-point' },
            source: 'offers',
          },
        ],
      });
    });

    await waitFor(() =>
      expect(mockGetOffer).toHaveBeenCalledWith('missing-offer'),
    );
    expect(onOfferOpen).not.toHaveBeenCalled();
  });

  it('updates offer hover state and clears it when leaving the map', () => {
    renderSearchMap();
    const hoverEvent = {
      features: [
        {
          id: 'offer-1',
          layer: { id: 'unclustered-point' },
          source: 'offers',
        },
      ],
    };

    act(() => {
      mockMapProps.onHover(hoverEvent);
    });

    expect(mockMap.setFeatureState).toHaveBeenLastCalledWith(
      { id: 'offer-1', source: 'offers' },
      {
        existing: true,
        hover: true,
      },
    );
    const callsAfterFirstHover = mockMap.setFeatureState.mock.calls.length;

    act(() => {
      mockMapProps.onHover(hoverEvent);
    });

    expect(mockMap.setFeatureState).toHaveBeenCalledTimes(callsAfterFirstHover);

    act(() => {
      mockMapProps.onMouseLeave();
    });

    expect(mockMap.setFeatureState).toHaveBeenLastCalledWith(
      { id: 'offer-1', source: 'offers' },
      {
        existing: true,
        hover: false,
      },
    );
  });

  it('updates hover state for community note points', () => {
    renderSearchMap({
      filters: '{"communityNotes":true}',
    });

    act(() => {
      mockMapProps.onHover({
        features: [
          {
            id: 'note-1',
            layer: { id: 'community-notes-points' },
            source: 'community-notes',
          },
        ],
      });
    });

    expect(mockMap.setFeatureState).toHaveBeenLastCalledWith(
      { id: 'note-1', source: 'community-notes' },
      {
        existing: true,
        hover: true,
      },
    );
  });

  it('clears the previous hover state before hovering a different offer', () => {
    renderSearchMap();

    act(() => {
      mockMapProps.onHover({
        features: [
          {
            id: 'offer-1',
            layer: { id: 'unclustered-point' },
            source: 'offers',
          },
        ],
      });
    });

    act(() => {
      mockMapProps.onHover({
        features: [
          {
            id: 'offer-2',
            layer: { id: 'unclustered-point' },
            source: 'offers',
          },
        ],
      });
    });

    expect(mockMap.setFeatureState).toHaveBeenCalledWith(
      { id: 'offer-1', source: 'offers' },
      {
        existing: true,
        hover: false,
      },
    );
    expect(mockMap.setFeatureState).toHaveBeenLastCalledWith(
      { id: 'offer-2', source: 'offers' },
      {
        existing: true,
        hover: true,
      },
    );
  });

  it('zooms to clusters using the cluster expansion zoom', () => {
    renderSearchMap();

    act(() => {
      mockMapProps.onClick({
        features: [
          {
            geometry: { coordinates: [24, 60] },
            layer: { id: 'clusters' },
            properties: { cluster_id: 123 },
          },
        ],
      });
    });

    expect(mockSource.getClusterExpansionZoom).toHaveBeenCalledWith(
      123,
      expect.any(Function),
    );
    expect(mockMapProps.latitude).toBe(60);
    expect(mockMapProps.longitude).toBe(24);
    expect(mockMapProps.zoom).toBe(12);
  });

  it('centers on a cluster when the source is unavailable', () => {
    mockSourceInstance = null;

    renderSearchMap();

    act(() => {
      mockMapProps.onClick({
        features: [
          {
            geometry: { coordinates: [24, 60] },
            layer: { id: 'clusters' },
            properties: { cluster_id: 123 },
          },
        ],
      });
    });

    expect(mockSource.getClusterExpansionZoom).not.toHaveBeenCalled();
    expect(mockMapProps.latitude).toBe(60);
    expect(mockMapProps.longitude).toBe(24);
  });

  it('ignores clusters without an expansion id or expansion zoom', () => {
    renderSearchMap();

    act(() => {
      mockMapProps.onClick({
        features: [
          {
            geometry: { coordinates: [24, 60] },
            layer: { id: 'clusters' },
            properties: {},
          },
        ],
      });
    });

    expect(mockSource.getClusterExpansionZoom).not.toHaveBeenCalled();

    mockSource.getClusterExpansionZoom.mockImplementationOnce(
      (clusterId, done) => done(new Error('missing zoom')),
    );

    act(() => {
      mockMapProps.onClick({
        features: [
          {
            geometry: { coordinates: [24, 60] },
            layer: { id: 'clusters' },
            properties: { cluster_id: 123 },
          },
        ],
      });
    });

    expect(mockMapProps.zoom).toBe(2);
  });

  it('applies external location bounds and selected location updates', async () => {
    renderSearchMap({
      location: { lat: 10, lng: 20 },
      locationBounds: {
        northEast: { lat: 54, lng: 25 },
        southWest: { lat: 50, lng: 20 },
      },
    });

    await waitFor(() =>
      expect(mockFitBounds).toHaveBeenCalledWith(
        [
          [25, 54],
          [20, 50],
        ],
        { padding: 40 },
      ),
    );
    await waitFor(() => expect(mockMapProps.latitude).toBe(10));
    expect(mockMapProps.longitude).toBe(20);
    expect(mockMapProps.zoom).toBe(6);
  });

  it('subscribes to community notes and converts valid location events to geojson', async () => {
    jest.useFakeTimers();
    mockSubscribeMapNotes.mockImplementationOnce(onEvent => {
      onEvent({
        id: 'note-valid',
        content: 'A valid map note',
        pubkey: 'validation-pubkey',
        authorPubkey: 'author-pubkey',
        created_at: 1700000000,
        kind: 30398,
        tags: [['l', '8FVC9G8F+5W', 'open-location-code']],
      });
      onEvent({
        id: 'note-without-location',
        tags: [],
      });
      onEvent({
        id: 'note-with-invalid-location',
        tags: [['l', 'not-a-plus-code', 'open-location-code']],
      });
      return Promise.resolve();
    });

    renderSearchMap({
      filters: '{"communityNotes":true}',
    });

    expect(mockSubscribeMapNotes).toHaveBeenCalledWith(expect.any(Function));

    act(() => {
      jest.advanceTimersByTime(200);
    });

    await waitFor(() =>
      expect(mockSourcePropsById['community-notes'].data.features).toHaveLength(
        1,
      ),
    );
    expect(mockSourcePropsById['community-notes'].data.features[0]).toEqual(
      expect.objectContaining({
        id: 'note-valid',
        properties: expect.objectContaining({
          authorPubkey: 'author-pubkey',
          content: 'A valid map note',
          verified: true,
        }),
      }),
    );

    jest.useRealTimers();
  });

  it('opens community note threads from stored map note events', () => {
    const onCommunityNoteOpen = jest.fn();
    mockSubscribeMapNotes.mockImplementationOnce(onEvent => {
      onEvent({
        id: 'note-1',
        content: 'Stored map note',
        pubkey: 'validation-pubkey',
        created_at: 1700000000,
        kind: 30398,
        tags: [['l', '8FVC9G8F+5W', 'open-location-code']],
      });
      onEvent({
        id: 'note-elsewhere',
        content: 'Different location',
        pubkey: 'validation-pubkey',
        created_at: 1700000100,
        kind: 30398,
        tags: [['l', '7FG49Q00+', 'open-location-code']],
      });
      onEvent({
        id: 'note-without-location',
        content: 'No location tag',
        pubkey: 'validation-pubkey',
        created_at: 1700000200,
        kind: 30398,
        tags: [],
      });
      return Promise.resolve();
    });

    renderSearchMap({
      filters: '{"communityNotes":true}',
      onCommunityNoteOpen,
    });

    act(() => {
      mockMapProps.onClick({
        features: [
          {
            id: 'note-1',
            layer: { id: 'community-notes-points' },
            properties: {
              id: 'note-1',
              content: 'Stored map note',
              pubkey: 'validation-pubkey',
              created_at: 1700000000,
              kind: 30398,
              tags: JSON.stringify([
                ['l', '8FVC9G8F+5W', 'open-location-code'],
              ]),
            },
          },
        ],
      });
    });

    expect(onCommunityNoteOpen).toHaveBeenCalledWith({
      notes: [
        expect.objectContaining({
          authorPubkey: 'validation-pubkey',
          content: 'Stored map note',
          id: 'note-1',
        }),
      ],
      plusCode: '8FVC9G8F+5W',
    });
  });

  it('reconstructs a clicked community note when no stored thread is available', () => {
    const onCommunityNoteOpen = jest.fn();

    renderSearchMap({
      filters: '{"communityNotes":true}',
      onCommunityNoteOpen,
    });

    act(() => {
      mockMapProps.onClick({
        features: [
          {
            id: 'note-from-feature',
            layer: { id: 'community-notes-points' },
            properties: {
              id: 'note-from-feature',
              content: 'Feature-only note',
              pubkey: 'author-pubkey',
              authorPubkey: 'author-pubkey',
              created_at: 1700000000,
              kind: 30397,
              tags: JSON.stringify([
                ['l', '8FVC9G8F+5W', 'open-location-code'],
              ]),
            },
          },
        ],
      });
    });

    expect(onCommunityNoteOpen).toHaveBeenCalledWith({
      notes: [
        {
          id: 'note-from-feature',
          content: 'Feature-only note',
          pubkey: 'author-pubkey',
          authorPubkey: 'author-pubkey',
          created_at: 1700000000,
          kind: 30397,
          tags: [['l', '8FVC9G8F+5W', 'open-location-code']],
        },
      ],
      plusCode: '8FVC9G8F+5W',
    });
  });

  it('handles clicked community notes without plus-code tags', () => {
    const onCommunityNoteOpen = jest.fn();

    renderSearchMap({
      filters: '{"communityNotes":true}',
      onCommunityNoteOpen,
    });

    act(() => {
      mockMapProps.onClick({
        features: [
          {
            id: 'note-without-code',
            layer: { id: 'community-notes-points' },
            properties: {
              id: 'note-without-code',
              content: 'No code here',
              pubkey: 'author-pubkey',
              created_at: 1700000000,
              kind: 30397,
              tags: [],
            },
          },
        ],
      });
    });

    expect(onCommunityNoteOpen).toHaveBeenCalledWith({
      notes: [
        {
          id: 'note-without-code',
          content: 'No code here',
          pubkey: 'author-pubkey',
          authorPubkey: undefined,
          created_at: 1700000000,
          kind: 30397,
          tags: [],
        },
      ],
      plusCode: null,
    });
  });

  it('does not require a community note open handler for note clicks', () => {
    renderSearchMap({
      filters: '{"communityNotes":true}',
    });

    expect(() => {
      act(() => {
        mockMapProps.onClick({
          features: [
            {
              id: 'note-1',
              layer: { id: 'community-notes-points' },
              properties: {
                tags: [['l', '8FVC9G8F+5W', 'open-location-code']],
              },
            },
          ],
        });
      });
    }).not.toThrow();
  });

  it('zooms in when a community note cluster is clicked', () => {
    renderSearchMap({
      filters: '{"communityNotes":true}',
    });

    act(() => {
      mockMapProps.onClick({
        features: [
          {
            geometry: { coordinates: [13, 52] },
            layer: { id: 'community-notes-clusters' },
          },
        ],
      });
    });

    expect(mockMapProps.latitude).toBe(52);
    expect(mockMapProps.longitude).toBe(13);
    expect(mockMapProps.zoom).toBe(5);
  });

  it('uses the default community-note cluster zoom step when viewport zoom is missing', () => {
    mockPersistentMapLocation = {
      latitude: 48.6908333333,
      longitude: 9.14055555556,
    };

    renderSearchMap({
      filters: '{"communityNotes":true}',
    });

    act(() => {
      mockMapProps.onClick({
        features: [
          {
            geometry: { coordinates: [13, 52] },
            layer: { id: 'community-notes-clusters' },
          },
        ],
      });
    });

    expect(mockMapProps.zoom).toBe(5);
  });

  it('ignores community note clusters without coordinates', () => {
    renderSearchMap({
      filters: '{"communityNotes":true}',
    });

    act(() => {
      mockMapProps.onClick({
        features: [
          {
            layer: { id: 'community-notes-clusters' },
          },
        ],
      });
    });

    expect(mockMapProps.zoom).toBe(2);
  });

  it('clears community notes when the subscription fails and unsubscribes on unmount', async () => {
    mockSubscribeMapNotes.mockRejectedValueOnce(new Error('relay unavailable'));

    const { unmount } = renderSearchMap({
      filters: '{"communityNotes":true}',
    });

    await waitFor(() =>
      expect(mockSourcePropsById['community-notes'].data).toEqual({
        features: [],
        type: 'FeatureCollection',
      }),
    );

    unmount();

    expect(mockUnsubscribeMapNotes).toHaveBeenCalledTimes(1);
  });

  it('logs offer query failures in development without replacing current offers', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    process.env.NODE_ENV = 'development';
    mockPersistentMapLocation = {
      ...mockPersistentMapLocation,
      zoom: 6,
    };
    mockQueryOffers.mockRejectedValueOnce(new Error('network failed'));

    renderSearchMap();

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('Could not load offers.'),
    );
    expect(mockSourceProps.data).toEqual({
      features: [],
      type: 'FeatureCollection',
    });

    process.env.NODE_ENV = originalNodeEnv;
    consoleError.mockRestore();
  });

  it('uses the OSM cluster count layer when the persisted map style is OSM', () => {
    mockMapStyle = MAP_STYLE_OSM;

    renderSearchMap();

    expect(mockMapProps.mapStyle).toBe(MAP_STYLE_OSM);
  });
});
