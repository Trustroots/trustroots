import React from 'react';
import { getMapBoxToken } from '@/modules/core/client/utils/map';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import { OpenLocationCode } from 'open-location-code';
import type { Event as NostrEvent } from 'nostr-tools';
import { MAP_STYLE_OSM } from '@/modules/core/client/components/Map/constants';
import { DEFAULT_LOCATION } from '@/modules/core/client/utils/constants';
import SearchMap from '@/modules/search/client/components/SearchMap.component';
import type { MapDefaultLocation } from '@/modules/core/client/utils/use-map-default-location';
import type {
  getOffer,
  queryOffers,
} from '@/modules/offers/client/api/offers.api';
import type {
  OfferReadPayload,
  OfferSearchFeature,
  OfferSearchFeatureCollection,
} from '@/modules/offers/shared/offer';
import { resolveMalformed } from '@/testutils/client/malformed-fixtures';

let mockApproximateLocation: MapDefaultLocation | null = null;
let mockHasSavedLocation = true;
const mockStopDefaultLocation = jest.fn();
const mockDefaultLocation = jest.fn();
jest.mock('@/modules/core/client/utils/use-map-default-location', () => ({
  __esModule: true,
  default: (enabled: boolean) => {
    mockDefaultLocation(enabled);
    return [enabled ? mockApproximateLocation : null, mockStopDefaultLocation];
  },
}));

function readOffer(
  overrides: Partial<OfferReadPayload> = {},
): OfferReadPayload {
  return {
    _id: 'offer-1',
    type: 'host',
    location: [12, 34],
    user: { _id: 'member-1', username: 'fictional-host' },
    ...overrides,
  };
}

type OpenLocationCodeRuntime = OpenLocationCode & {
  encode(latitude: number, longitude: number, codeLength?: number): string;
};

type SearchMapProps = React.ComponentProps<typeof SearchMap>;
type SearchMapRenderProps = Partial<SearchMapProps> & {
  onCommunityNoteOpen?: SearchMapProps['onCommunityNoteOpen'] | undefined;
};
type MockMapFeature = {
  id?: string | number;
  geometry?: { coordinates?: number[] };
  layer?: { id?: string };
  source?: string;
  properties?: Record<string, unknown>;
};
type MockFeatureProperties = Record<string, unknown> & {
  id?: string | number;
};
type MockMapProps = {
  latitude: number;
  longitude: number;
  zoom: number;
  width: string;
  height: string;
  location?: [number, number];
  mapStyle?: string;
  mapboxAccessToken?: string;
  interactiveLayerIds?: string[];
  onClick: (event: { features?: MockMapFeature[] }) => void;
  onMouseMove: (event: { features?: MockMapFeature[] }) => void;
  onMouseLeave: () => void;
  onMove: (event: { viewState: Record<string, number> }) => void;
  onLoad: () => void;
  style: { width: string; height: string };
  onMoveEnd: () => void;
  onError: (event: unknown) => void;
};
type OfferSearchResponse = OfferSearchFeatureCollection;
type MockSourceProps = {
  id: string;
  data: { type: string; features: MockMapFeature[] };
};

const mockIsWebGLSupported = jest.fn();
const mockGetMapBoxToken = jest.mocked(getMapBoxToken);
jest.mock('@/modules/core/client/utils/map', () => ({
  ...jest.requireActual('@/modules/core/client/utils/map'),
  isWebGLSupported: () => mockIsWebGLSupported(),
  getMapBoxToken: jest.fn(() => 'test-token'),
}));

type MockNostrEvent = Partial<NostrEvent> & { authorPubkey?: string };
type MockSubscriptionCallbacks = {
  onClose: () => void;
  onEose: () => void;
};
type MockNoteListener = (event: MockNostrEvent) => void;
type MockSubscribeMapNotes = (
  onEvent: MockNoteListener,
  limit?: number,
  callbacks?: MockSubscriptionCallbacks,
) => Promise<unknown>;
const mockGetNostrEventAuthorPubkey = jest.fn(
  (event: MockNostrEvent) => event.authorPubkey || event.pubkey,
);
const mockSubscribeMapNotes = jest.fn<
  ReturnType<MockSubscribeMapNotes>,
  Parameters<MockSubscribeMapNotes>
>();
const mockUnsubscribeMapNotes = jest.fn<void, []>();
const mockFilterCommunityNotesByAuthorVisibility = jest.fn<
  Promise<MockNostrEvent[]>,
  [notes: MockNostrEvent[]]
>(notes => Promise.resolve(notes));
jest.mock('@/modules/search/client/services/nostr.client.service', () => ({
  getNostrEventAuthorPubkey: (event: MockNostrEvent) =>
    mockGetNostrEventAuthorPubkey(event),
  nostrService: {
    subscribeMapNotes: (...args: Parameters<MockSubscribeMapNotes>) =>
      mockSubscribeMapNotes(...args),
    unsubscribeMapNotes: () => mockUnsubscribeMapNotes(),
    filterCommunityNotesByAuthorVisibility: (
      ...args: [notes: MockNostrEvent[]]
    ) => mockFilterCommunityNotesByAuthorVisibility(...args),
  },
}));

type MockGetOffer = typeof getOffer;
type MockQueryOffers = typeof queryOffers;
const mockGetOffer = jest.fn<
  ReturnType<MockGetOffer>,
  Parameters<MockGetOffer>
>();
const mockQueryOffers = jest.fn<
  ReturnType<MockQueryOffers>,
  Parameters<MockQueryOffers>
>();
jest.mock('@/modules/offers/client/api/offers.api', () => ({
  getOffer: (offerId: string) => mockGetOffer(offerId),
  queryOffers: (query?: Parameters<MockQueryOffers>[0]) =>
    mockQueryOffers(query),
}));

jest.mock('@/modules/search/client/hooks/use-debounced-callback', () => ({
  __esModule: true,
  default: <Callback extends (...args: never[]) => unknown>(
    callback: Callback,
  ) => callback,
}));

// Partial coordinates are intentional regression inputs for fallback behaviour.
let mockPersistentMapLocation: {
  latitude?: number;
  longitude?: number;
  zoom?: number;
} = {
  latitude: 48.6908333333,
  longitude: 9.14055555556,
  zoom: 2,
};
const mockSetPersistentMapLocation = jest.fn();
jest.mock('@/modules/search/client/hooks/use-persistent-map-location', () => ({
  __esModule: true,
  default: () => [
    mockPersistentMapLocation,
    mockSetPersistentMapLocation,
    mockHasSavedLocation,
  ],
}));

let mockMapStyle: string | typeof MAP_STYLE_OSM = 'mock-map-style';
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
  cameraForBounds: mockFitBounds,
  flyTo: jest.fn(),
  touchZoomRotate: { disableRotation: jest.fn() },
  scrollZoom: { setWheelZoomRate: jest.fn() },
  getFeatureState: jest.fn(),
  getSource: jest.fn(),
  getZoom: jest.fn(),
  setFeatureState: jest.fn(),
};
let mockMapInstance: typeof mockMap | null = mockMap;
let mockMapProps!: MockMapProps;
let mockSourceProps!: MockSourceProps;
let mockSourcePropsById: Record<string, MockSourceProps> = {};
let mockLayerPropsById: Record<string, { layout: Record<string, unknown> }> =
  {};
const mockSource = {
  getClusterExpansionZoom: jest.fn(),
  getClusterLeaves: jest.fn(),
};
let mockSourceInstance: typeof mockSource | null = mockSource;
jest.mock('react-map-gl/mapbox', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  type MockReactMapGLProps = MockMapProps & {
    children?: React.ReactNode;
  };
  const MockReactMapGL = React.forwardRef<unknown, MockReactMapGLProps>(
    function MockReactMapGL({ children, ...props }, ref) {
      mockMapProps = props;
      React.useImperativeHandle(ref, () => ({
        getMap: () => mockMapInstance,
      }));
      return React.createElement(
        'div',
        { 'data-testid': 'react-map-gl/mapbox' },
        children,
      );
    },
  );

  type MockSourceComponentProps = MockSourceProps & {
    children?: React.ReactNode;
  };
  const Source = React.forwardRef<unknown, MockSourceComponentProps>(
    function MockSource({ children, ...props }, ref) {
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
    },
  );

  function Layer(props: {
    id: string;
    layout?: Record<string, unknown>;
    [key: string]: unknown;
  }) {
    mockLayerPropsById[props.id] = { ...props, layout: props.layout ?? {} };
    return React.createElement('div', {
      'data-testid': `map-layer-${props.id}`,
    });
  }
  return {
    __esModule: true,
    default: MockReactMapGL,
    Layer,
    Source,
  };
});

function renderSearchMap(props: SearchMapRenderProps = {}) {
  const defaultProps: SearchMapProps = {
    filters: '{}',
    isUserPublic: true,
    onCommunityNoteOpen: jest.fn(),
    onOfferClose: jest.fn(),
    onOfferOpen: jest.fn(),
  };
  return render(<SearchMap {...{ ...defaultProps, ...props }} />);
}

function renderCommunityNotesMap(props: SearchMapRenderProps = {}) {
  return renderSearchMap({ filters: '{"communityNotes":true}', ...props });
}

// Explicitly omit this callback to exercise the runtime's optional-handler guards.
function renderCommunityNotesMapWithoutOpenHandler() {
  return renderCommunityNotesMap({ onCommunityNoteOpen: undefined });
}

function requireSubscriptionCallbacks(
  callbacks: MockSubscriptionCallbacks | undefined,
): MockSubscriptionCallbacks {
  if (!callbacks) {
    throw new Error('Expected map-note subscription callbacks');
  }
  return callbacks;
}

function clickMapFeatures(features: MockMapFeature[]) {
  act(() => {
    mockMapProps.onClick({ features });
  });
}

function clickOfferPin(id: string) {
  clickMapFeatures([
    { id, layer: { id: 'unclustered-point' }, source: 'offers' },
  ]);
}

function clickOfferCluster(
  clusterId: number,
  coordinates: number[] = [24, 60],
  properties: Record<string, unknown> = {},
) {
  clickMapFeatures([
    {
      geometry: { coordinates },
      layer: { id: 'clusters' },
      properties: { cluster_id: clusterId, ...properties },
    },
  ]);
}

function clickCommunityNoteCluster({
  clusterId,
  pointCount,
  coordinates = [3.5, 51.5],
  id,
  properties = {},
}: {
  clusterId?: number;
  pointCount?: number;
  coordinates?: number[];
  id?: string | number;
  properties?: Record<string, unknown>;
} = {}) {
  clickMapFeatures([
    {
      ...(id !== undefined ? { id } : {}),
      geometry: { coordinates },
      layer: { id: 'community-notes-clusters' },
      properties: {
        ...(clusterId !== undefined ? { cluster_id: clusterId } : {}),
        ...(pointCount !== undefined ? { point_count: pointCount } : {}),
        ...properties,
      },
    },
  ]);
}

function clickCommunityNotePoint(
  properties: MockFeatureProperties,
  id: string | number | undefined = properties.id,
) {
  clickMapFeatures([
    {
      id,
      layer: { id: 'community-notes-points' },
      properties,
    },
  ]);
}

const DATELINE_BOUNDS = {
  getNorthEast: () => ({ lat: 10, lng: -170 }),
  getSouthWest: () => ({ lat: -10, lng: 170 }),
};

const WORLD_BOUNDS = {
  getNorthEast: () => ({ lat: 90, lng: 180 }),
  getSouthWest: () => ({ lat: -90, lng: -180 }),
};

const DATELINE_OFFER_FEATURES: OfferSearchFeature[] = [
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [179, 0] },
    properties: { id: 'east' },
  },
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-179, 0] },
    properties: { id: 'west' },
  },
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: { id: 'middle' },
  },
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [179, 20] },
    properties: { id: 'north' },
  },
];

function moveMap(viewState: Record<string, number>) {
  fireEvent.pointerDown(screen.getByTestId('react-map-gl/mapbox'));
  mockMapProps.onMove({ viewState });
}

function flushMapViewport(viewport: Record<string, number>) {
  act(() => {
    moveMap(viewport);
  });
  act(() => {
    mockMapProps.onMoveEnd();
  });
}

async function flushCommunityNotesTimers() {
  await act(async () => {
    jest.advanceTimersByTime(200);
    await Promise.resolve();
  });
}

async function flushCommunityNotesViewport(viewport: Record<string, number>) {
  act(() => {
    moveMap(viewport);
  });
  await flushCommunityNotesTimers();
}

beforeEach(() => {
  mockStopDefaultLocation.mockClear();
  mockDefaultLocation.mockClear();
  mockSetPersistentMapLocation.mockClear();
  mockApproximateLocation = null;
  mockHasSavedLocation = true;
  mockGetMapBoxToken.mockReturnValue('test-token');
  mockIsWebGLSupported.mockReturnValue(true);
  mockLeafletSearchMap.mockClear();
  mockSourcePropsById = {};
  mockLayerPropsById = {};
  mockPersistentMapLocation = {
    latitude: 48.6908333333,
    longitude: 9.14055555556,
    zoom: 2,
  };
  mockMapStyle = 'mock-map-style';
  mockFitBounds.mockReturnValue({
    center: { lat: 52, lng: 13 },
    zoom: 8,
  });
  mockMap.getBounds.mockReturnValue({
    getNorthEast: () => ({ lat: 89.5, lng: 179.5 }),
    getSouthWest: () => ({ lat: -89.5, lng: -179.5 }),
  });
  mockMap.getFeatureState.mockReturnValue({ existing: true });
  mockMap.getZoom.mockReturnValue(8);
  mockMap.flyTo.mockImplementation(({ center, zoom }) => {
    moveMap({ latitude: center[1], longitude: center[0], zoom });
  });
  mockMapInstance = mockMap;
  mockSource.getClusterExpansionZoom.mockImplementation((clusterId, done) =>
    done(null, 18),
  );
  mockSource.getClusterLeaves.mockReset();
  mockSourceInstance = mockSource;
  mockMap.getSource.mockImplementation(() => mockSourceInstance);
  mockGetOffer.mockResolvedValue(readOffer());
  mockQueryOffers.mockResolvedValue({
    features: [],
    type: 'FeatureCollection',
  });
  mockGetNostrEventAuthorPubkey.mockImplementation(
    event => event.authorPubkey || event.pubkey,
  );
  mockSubscribeMapNotes.mockResolvedValue({ close: jest.fn() });
  mockFilterCommunityNotesByAuthorVisibility.mockImplementation(notes =>
    Promise.resolve(notes),
  );
  jest.clearAllMocks();
});

describe('Search', () => {
  it.each([true, false])(
    'uses an approximate initial viewport without persisting it (WebGL: %s)',
    webgl => {
      mockHasSavedLocation = false;
      mockApproximateLocation = { latitude: 34, longitude: -17, zoom: 6 };
      mockIsWebGLSupported.mockReturnValue(webgl);
      renderSearchMap({ location: {} });
      if (webgl) {
        expect(mockMapProps.latitude).toBe(34);
        expect(mockMapProps.longitude).toBe(-17);
      } else {
        expect(
          mockLeafletSearchMap.mock.calls.slice(-1)[0][0].viewport,
        ).toEqual(mockApproximateLocation);
      }
      expect(
        screen.getByRole('link', { name: 'Data credits' }),
      ).toBeInTheDocument();
      expect(mockSetPersistentMapLocation).not.toHaveBeenCalled();
    },
  );

  it('keeps recent saved positions ahead of approximate locations', () => {
    mockApproximateLocation = { latitude: 34, longitude: -17, zoom: 6 };
    renderSearchMap();
    expect(mockDefaultLocation).toHaveBeenCalledWith(false);
    expect(mockMapProps.latitude).toBe(mockPersistentMapLocation.latitude);
  });

  it('stops an approximate default lookup when device location is requested', () => {
    mockHasSavedLocation = false;
    renderSearchMap({ deviceLocationRequestId: 1 });

    expect(mockDefaultLocation).toHaveBeenCalledWith(true);
    expect(mockStopDefaultLocation).toHaveBeenCalled();
  });

  it('does not reapply GeoIP after a member clears a later explicit destination', () => {
    mockHasSavedLocation = false;
    mockApproximateLocation = { latitude: 34, longitude: -17, zoom: 6 };
    const props = {
      filters: '{}',
      isUserPublic: true,
      onCommunityNoteOpen: jest.fn(),
      onOfferClose: jest.fn(),
      onOfferOpen: jest.fn(),
    };
    const { rerender } = render(<SearchMap {...props} location={{}} />);
    expect(mockMapProps.latitude).toBe(34);
    rerender(<SearchMap {...props} location={{ lat: 12, lng: 23 }} />);
    expect(mockMapProps.latitude).toBe(12);
    rerender(<SearchMap {...props} location={{}} />);
    expect(mockMapProps.latitude).toBe(12);
  });

  it.each([undefined, {}, { northEast: { lat: 35, lng: -16 } }])(
    'does not persist initial raster map notifications with incomplete bounds %j',
    locationBounds => {
      mockIsWebGLSupported.mockReturnValue(false);
      mockHasSavedLocation = false;
      renderSearchMap({ locationBounds });
      const props = mockLeafletSearchMap.mock.calls.slice(-1)[0][0];
      act(() =>
        props.onMapChange({
          latitude: 34,
          longitude: -17,
          zoom: 6,
          bounds: {
            northEast: { lat: 35, lng: -16 },
            southWest: { lat: 33, lng: -18 },
          },
        }),
      );
      expect(mockSetPersistentMapLocation).not.toHaveBeenCalled();
      act(() => props.onInteraction?.());
      expect(mockStopDefaultLocation).toHaveBeenCalled();
    },
  );

  it('persists the viewport fitted to an explicit raster place search', () => {
    mockIsWebGLSupported.mockReturnValue(false);
    const bounds = {
      northEast: { lat: 35, lng: -16 },
      southWest: { lat: 33, lng: -18 },
    };
    renderSearchMap({ locationBounds: bounds });
    act(() =>
      mockLeafletSearchMap.mock.calls
        .slice(-1)[0][0]
        .onMapChange({ latitude: 34, longitude: -17, zoom: 6, bounds }, true),
    );
    expect(mockSetPersistentMapLocation).toHaveBeenCalledWith({
      latitude: 34,
      longitude: -17,
      zoom: 6,
    });
    mockSetPersistentMapLocation.mockClear();
    act(() =>
      mockLeafletSearchMap.mock.calls
        .slice(-1)[0][0]
        .onMapChange({ latitude: 34, longitude: -17, zoom: 6, bounds }, false),
    );
    expect(mockSetPersistentMapLocation).not.toHaveBeenCalled();
  });
  it('initialises the loaded map without touch rotation and fetches visible offers', async () => {
    mockPersistentMapLocation.zoom = 8;
    renderSearchMap();
    expect(mockMapProps.mapboxAccessToken).toBe('test-token');
    await act(async () => mockMapProps.onLoad());
    expect(mockMap.touchZoomRotate.disableRotation).toHaveBeenCalled();
    expect(mockQueryOffers).toHaveBeenCalled();
  });

  it('waits for a camera when fitting externally supplied bounds', () => {
    mockFitBounds.mockReturnValueOnce(undefined);
    renderSearchMap({
      locationBounds: {
        northEast: { lat: 54, lng: 25 },
        southWest: { lat: 50, lng: 20 },
      },
    });
    expect(mockMapProps.zoom).toBe(8);
  });

  it('retains the current zoom when the fitted camera does not specify one', () => {
    mockFitBounds.mockReturnValue({ center: { lat: 50, lng: 20 } });
    renderSearchMap({
      locationBounds: {
        northEast: { lat: 54, lng: 25 },
        southWest: { lat: 50, lng: 20 },
      },
    });
    expect(mockMapProps.zoom).toBe(2);
  });

  it('ignores hover features without a source during map teardown', () => {
    renderSearchMap();
    act(() =>
      mockMapProps.onMouseMove({
        features: [{ id: 'offer-1', layer: { id: 'unclustered-point' } }],
      }),
    );
    expect(mockMap.setFeatureState).not.toHaveBeenCalled();
  });

  it('ignores feature and cluster updates before a map is available', () => {
    mockMapInstance = null;
    renderSearchMap({
      locationBounds: {
        northEast: { lat: 54, lng: 25 },
        southWest: { lat: 50, lng: 20 },
      },
    });
    act(() =>
      mockMapProps.onMouseMove({
        features: [
          {
            id: 'offer-1',
            source: 'offers',
            layer: { id: 'unclustered-point' },
          },
        ],
      }),
    );
    clickCommunityNoteCluster({ coordinates: [13, 52] });
    expect(mockMap.flyTo).not.toHaveBeenCalled();
    expect(mockMap.setFeatureState).not.toHaveBeenCalled();
  });
  it('Map loads', async () => {
    render(
      <SearchMap
        filters="{}"
        isUserPublic={true}
        onCommunityNoteOpen={() => {}}
        onOfferClose={() => {}}
        onOfferOpen={() => {}}
      />,
    );
  });

  it.each([
    'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36',
    'Mozilla/5.0 Chromium/140.0.0.0',
    'Mozilla/5.0 HeadlessChrome/140.0.0.0 Safari/537.36',
    'Mozilla/5.0 Chrome/140.0.0.0 Edg/140.0.0.0',
    'Mozilla/5.0 OPR/120.0.0.0',
    'Mozilla/5.0 Firefox/143.0',
    'Mozilla/5.0 Version/18.0 Safari/605.1.15',
    'Mozilla/5.0 CriOS/140.0.0.0 Mobile Safari/604.1',
    '',
  ])(
    'selects Mapbox by WebGL2 support regardless of user agent %s',
    userAgent => {
      const currentUserAgent = jest
        .spyOn(navigator, 'userAgent', 'get')
        .mockReturnValue(userAgent);
      renderSearchMap();
      expect(screen.getByTestId('react-map-gl/mapbox')).toBeInTheDocument();
      expect(
        screen.queryByTestId('leaflet-search-map'),
      ).not.toBeInTheDocument();
      expect(mockIsWebGLSupported).toHaveBeenCalled();
      currentUserAgent.mockRestore();
    },
  );

  it('uses the Leaflet renderer when WebGL is unavailable', async () => {
    mockIsWebGLSupported.mockReturnValue(false);
    const feature: OfferSearchFeature = {
      type: 'Feature',
      properties: { id: 'fallback-offer', offer: null },
      geometry: { type: 'Point', coordinates: [13, 52] },
    };
    mockQueryOffers.mockResolvedValue({
      type: 'FeatureCollection',
      features: [feature],
    });

    renderSearchMap();

    expect(screen.getByTestId('leaflet-search-map')).toBeInTheDocument();
    expect(screen.queryByTestId('react-map-gl/mapbox')).not.toBeInTheDocument();
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
      mockLeafletSearchMap.mock.calls[0][0].onInteraction?.();
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
    await waitFor(() =>
      expect(mockLeafletSearchMap).toHaveBeenLastCalledWith(
        expect.objectContaining({ offers: { features: [feature] } }),
      ),
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
      moveMap({
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
    expect(mockMapProps.style).toEqual({ width: '100%', height: '100%' });
  });

  it('zooms the map on a Firefox trackpad pinch without zooming the page', () => {
    renderSearchMap();
    const pinch = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -50,
    });

    act(() => screen.getByTestId('react-map-gl/mapbox').dispatchEvent(pinch));

    expect(pinch.defaultPrevented).toBe(true);
    expect(mockMapProps.zoom).toBe(2.5);
    expect(mockSetPersistentMapLocation).toHaveBeenCalledWith(
      expect.objectContaining({ zoom: 2.5 }),
    );

    act(() =>
      screen.getByTestId('react-map-gl/mapbox').dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaMode: 1,
          deltaY: -1,
        }),
      ),
    );
    expect(mockMapProps.zoom).toBe(2.9);
  });

  it('pinches from the viewport selected by a place search', () => {
    renderSearchMap({
      locationBounds: {
        northEast: { lat: 20.2, lng: -59.8 },
        southWest: { lat: 19.8, lng: -60.2 },
      },
    });
    const { latitude, longitude, zoom } = mockMapProps;
    expect(mockFitBounds).toHaveBeenCalled();

    act(() =>
      screen.getByTestId('react-map-gl/mapbox').dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: 100,
        }),
      ),
    );

    expect(mockMapProps.latitude).toBe(latitude);
    expect(mockMapProps.longitude).toBe(longitude);
    expect(mockMapProps.zoom).toBe(zoom - 1);
  });

  it('leaves ordinary wheel input to the map and clamps pinch zoom', () => {
    renderSearchMap();
    const map = screen.getByTestId('react-map-gl/mapbox');
    const wheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: -50,
    });

    act(() => map.dispatchEvent(wheel));
    expect(wheel.defaultPrevented).toBe(false);
    expect(mockMapProps.zoom).toBe(2);

    act(() =>
      map.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: -5000,
        }),
      ),
    );
    expect(mockMapProps.zoom).toBe(20);

    mockSetPersistentMapLocation.mockClear();
    act(() =>
      map.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: -5000,
        }),
      ),
    );
    expect(mockSetPersistentMapLocation).not.toHaveBeenCalled();

    act(() =>
      map.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: 5000,
        }),
      ),
    );
    expect(mockMapProps.zoom).toBe(0);
  });

  it('uses the default map location when persisted coordinates are missing', () => {
    mockPersistentMapLocation = {
      zoom: 2,
    };

    renderSearchMap();

    expect(mockMapProps.latitude).toBe(48.6908333333);
    expect(mockMapProps.longitude).toBe(9.14055555556);
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

  it('ignores missing-layer errors caused by map style teardown', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    renderSearchMap();

    mockMapProps.onError({
      error: new Error(
        "The layer 'clusters' does not exist in the map's style and cannot be queried for features.",
      ),
    });
    expect(consoleError).not.toHaveBeenCalled();

    const otherError = new Error('Map source failed');
    mockMapProps.onError({ error: otherError });
    expect(consoleError).toHaveBeenCalledWith(otherError);
    mockMapProps.onError({});
    expect(consoleError).toHaveBeenCalledWith({});
    consoleError.mockRestore();
  });

  it.each([MAP_STYLE_OSM, 'mapbox://styles/trustroots/custom'])(
    'uses Leaflet without a token even when WebGL is supported (style %p)',
    style => {
      mockGetMapBoxToken.mockReturnValue(undefined);
      mockMapStyle = style;
      renderSearchMap();
      expect(screen.getByTestId('leaflet-search-map')).toBeInTheDocument();
      expect(
        screen.queryByTestId('react-map-gl/mapbox'),
      ).not.toBeInTheDocument();
    },
  );

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
      mockMapProps.onMoveEnd();
    });

    await waitFor(() => expect(mockQueryOffers).toHaveBeenCalledTimes(1));
    expect(mockSourceProps.data).toEqual({
      features: [],
      type: 'FeatureCollection',
    });
  });

  it('skips offer queries when map bounds lack north-east and south-west corners', async () => {
    mockMap.getBounds.mockReturnValue({});
    mockPersistentMapLocation = {
      ...mockPersistentMapLocation,
      zoom: 6,
    };

    renderSearchMap();
    act(() => {
      mockMapProps.onMoveEnd();
    });

    await waitFor(() => expect(mockQueryOffers).not.toHaveBeenCalled());
  });

  it('keeps a newer offer response when an older viewport request finishes last', async () => {
    const onVisibleOffersChange = jest.fn();
    const requests: Array<(response: OfferSearchResponse) => void> = [];
    mockQueryOffers.mockImplementation(
      () => new Promise<OfferSearchResponse>(resolve => requests.push(resolve)),
    );

    renderSearchMap({ onVisibleOffersChange });
    act(() => moveMap({ latitude: 0, longitude: 0, zoom: 8 }));
    act(() => mockMapProps.onMoveEnd());
    await waitFor(() => expect(requests).toHaveLength(1));

    act(() => moveMap({ latitude: 1, longitude: 1, zoom: 9 }));
    act(() => mockMapProps.onMoveEnd());
    await waitFor(() => expect(requests).toHaveLength(2));

    await act(async () => {
      requests[1]!({
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [13, 52] },
            properties: { id: 'new' },
          },
        ],
        type: 'FeatureCollection',
      });
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(onVisibleOffersChange).toHaveBeenLastCalledWith(['new']),
    );

    await act(async () => {
      requests[0]!({
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [12, 51] },
            properties: { id: 'old' },
          },
        ],
        type: 'FeatureCollection',
      });
      await Promise.resolve();
    });

    expect(mockSourceProps.data.features).toEqual([
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [13, 52] },
        properties: { id: 'new' },
      },
    ]);
    expect(onVisibleOffersChange).toHaveBeenLastCalledWith(['new']);
  });

  it('reports only offer pins inside a viewport crossing the dateline', async () => {
    const onVisibleOffersChange = jest.fn();
    mockMap.getBounds.mockReturnValue(DATELINE_BOUNDS);
    mockQueryOffers.mockResolvedValue({
      features: DATELINE_OFFER_FEATURES,
      type: 'FeatureCollection',
    });

    renderSearchMap({ onVisibleOffersChange });
    flushMapViewport({ latitude: 0, longitude: 180, zoom: 8 });

    await waitFor(() =>
      expect(onVisibleOffersChange).toHaveBeenLastCalledWith(['east', 'west']),
    );

    mockMap.getBounds.mockReturnValue(WORLD_BOUNDS);
    mockQueryOffers.mockResolvedValue({
      features: DATELINE_OFFER_FEATURES,
      type: 'FeatureCollection',
    });
    act(() => mockMapProps.onMoveEnd());

    await waitFor(() =>
      expect(onVisibleOffersChange).toHaveBeenLastCalledWith([
        'east',
        'west',
        'middle',
        'north',
      ]),
    );
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

    await waitFor(() => expect(mockMapProps.zoom).toBe(6));
    expect(onOfferClose).not.toHaveBeenCalled();
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

    expect(onOfferClose).not.toHaveBeenCalled();

    clickMapFeatures([]);

    expect(onOfferClose).toHaveBeenCalledTimes(1);
  });

  it('closes an open offer when search filters change', async () => {
    const onOfferClose = jest.fn();
    const { rerender } = renderSearchMap({ onOfferClose });

    expect(onOfferClose).not.toHaveBeenCalled();

    rerender(
      <SearchMap
        filters='{"hosting":"yes"}'
        isUserPublic={true}
        onCommunityNoteOpen={() => {}}
        onOfferClose={onOfferClose}
        onOfferOpen={jest.fn()}
      />,
    );

    await waitFor(() => expect(onOfferClose).toHaveBeenCalledTimes(1));
  });

  it('ignores hover events that do not identify a new offer point', () => {
    renderSearchMap();

    act(() => {
      mockMapProps.onMouseMove({ features: [] });
      mockMapProps.onMouseMove({
        features: [
          {
            id: 'cluster-1',
            layer: { id: 'clusters' },
            source: 'offers',
          },
        ],
      });
      mockMapProps.onMouseMove({
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
    const offer = readOffer();
    mockGetOffer.mockResolvedValueOnce(offer);

    renderSearchMap({ onOfferOpen });

    clickOfferPin('offer-1');

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

  it('clears the selected pin and ignores its pending details after device navigation', async () => {
    let resolveOffer!: (offer: Awaited<ReturnType<MockGetOffer>>) => void;
    mockGetOffer.mockReturnValueOnce(
      new Promise(resolve => {
        resolveOffer = resolve;
      }),
    );
    const props = {
      filters: '{}',
      isUserPublic: true,
      onCommunityNoteOpen: jest.fn(),
      onOfferClose: jest.fn(),
      onOfferOpen: jest.fn(),
    };
    const { rerender } = renderSearchMap(props);
    clickOfferPin('offer-1');

    rerender(
      <SearchMap
        {...props}
        location={{ lat: 0, lng: 0, zoom: 13, clearSelection: true }}
      />,
    );

    expect(mockMap.setFeatureState).toHaveBeenCalledWith(
      { id: 'offer-1', source: 'offers' },
      { existing: true, selected: false },
    );
    await act(async () => resolveOffer(readOffer()));
    expect(props.onOfferOpen).not.toHaveBeenCalled();

    const nextOffer = readOffer();
    mockGetOffer.mockResolvedValueOnce(nextOffer);
    clickOfferPin('offer-2');
    await waitFor(() =>
      expect(props.onOfferOpen).toHaveBeenCalledWith(nextOffer),
    );
  });

  it('ignores unclustered offer clicks that do not include an offer id', () => {
    renderSearchMap();

    clickMapFeatures([
      { layer: { id: 'unclustered-point' }, source: 'offers' },
    ]);

    expect(mockGetOffer).not.toHaveBeenCalled();
  });

  it('clears the previous selected offer when selecting another one', () => {
    renderSearchMap();

    clickOfferPin('offer-1');
    clickOfferPin('offer-2');

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
    resolveMalformed(mockGetOffer, null);

    renderSearchMap({ onOfferOpen });

    clickOfferPin('missing-offer');

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
      mockMapProps.onMouseMove(hoverEvent);
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
      mockMapProps.onMouseMove(hoverEvent);
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
    renderCommunityNotesMap();

    act(() => {
      mockMapProps.onMouseMove({
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
      mockMapProps.onMouseMove({
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
      mockMapProps.onMouseMove({
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

    clickOfferCluster(123);

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

    clickOfferCluster(123);

    expect(mockSource.getClusterExpansionZoom).not.toHaveBeenCalled();
    expect(mockMapProps.latitude).toBe(60);
    expect(mockMapProps.longitude).toBe(24);
  });

  it('ignores clusters without an expansion id or expansion zoom', () => {
    renderSearchMap();

    clickMapFeatures([
      {
        geometry: { coordinates: [24, 60] },
        layer: { id: 'clusters' },
        properties: {},
      },
    ]);

    expect(mockSource.getClusterExpansionZoom).not.toHaveBeenCalled();

    mockSource.getClusterExpansionZoom.mockImplementationOnce(
      (clusterId, done) => done(new Error('missing zoom')),
    );

    clickOfferCluster(123);

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
          [20, 50],
          [25, 54],
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
        pubkey: 'author-pubkey',
        authorPubkey: 'author-pubkey',
        created_at: 1700000000,
        kind: 30397,
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

    renderCommunityNotesMap();

    expect(mockSubscribeMapNotes).toHaveBeenCalledWith(
      expect.any(Function),
      undefined,
      expect.objectContaining({
        onClose: expect.any(Function),
        onEose: expect.any(Function),
      }),
    );

    await flushCommunityNotesTimers();

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
          kind: 30397,
        }),
      }),
    );

    jest.useRealTimers();
  });

  it('hides community notes blocked by the Nostr visibility check', async () => {
    jest.useFakeTimers();
    mockSubscribeMapNotes.mockImplementationOnce(onEvent => {
      onEvent({
        id: 'note-visible',
        content: 'Visible note',
        authorPubkey: 'author-visible',
        tags: [['l', '8FVC9G8F+5W', 'open-location-code']],
      });
      onEvent({
        id: 'note-hidden',
        content: 'Hidden note',
        authorPubkey: 'author-hidden',
        tags: [['l', '8FVC9G8F+5W', 'open-location-code']],
      });
      return Promise.resolve();
    });
    mockFilterCommunityNotesByAuthorVisibility.mockImplementationOnce(
      async notes => [notes[0]],
    );

    renderCommunityNotesMap();

    expect(mockSubscribeMapNotes).toHaveBeenCalledWith(
      expect.any(Function),
      undefined,
      expect.objectContaining({
        onClose: expect.any(Function),
        onEose: expect.any(Function),
      }),
    );

    await flushCommunityNotesTimers();

    await waitFor(() =>
      expect(mockSourcePropsById['community-notes'].data.features).toHaveLength(
        1,
      ),
    );
    expect(
      mockSourcePropsById['community-notes'].data.features[0]!.properties!
        .content,
    ).toBe('Visible note');
    expect(mockSourcePropsById['community-notes'].data.features[0].id).toBe(
      'note-visible',
    );
    expect(mockFilterCommunityNotesByAuthorVisibility).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'note-visible' }),
        expect.objectContaining({ id: 'note-hidden' }),
      ]),
    );

    jest.useRealTimers();
  });

  it('reconnects after an interrupted relay load and deduplicates replayed notes', async () => {
    jest.useFakeTimers();
    let firstCallbacks: MockSubscriptionCallbacks | undefined;
    let secondCallbacks: MockSubscriptionCallbacks | undefined;
    mockSubscribeMapNotes
      .mockImplementationOnce((onEvent, limit, callbacks) => {
        firstCallbacks = callbacks;
        onEvent({
          id: 'note-first',
          authorPubkey: 'author-first',
          tags: [['l', '8FVC9G8F+5W', 'open-location-code']],
        });
        return Promise.resolve();
      })
      .mockImplementationOnce((onEvent, limit, callbacks) => {
        secondCallbacks = callbacks;
        onEvent({
          id: 'note-first',
          authorPubkey: 'author-first',
          tags: [['l', '8FVC9G8F+5W', 'open-location-code']],
        });
        onEvent({
          id: 'note-second',
          authorPubkey: 'author-second',
          tags: [['l', '7FG49Q00+', 'open-location-code']],
        });
        return Promise.resolve();
      });

    const { unmount } = renderCommunityNotesMap();
    await waitFor(() => expect(firstCallbacks).toBeDefined());
    const first = requireSubscriptionCallbacks(firstCallbacks);

    act(() => {
      first.onClose();
      first.onClose();
      jest.advanceTimersByTime(1000);
    });
    await waitFor(() => expect(secondCallbacks).toBeDefined());
    const second = requireSubscriptionCallbacks(secondCallbacks);

    await act(async () => {
      second.onEose();
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(mockSourcePropsById['community-notes'].data.features).toHaveLength(
        2,
      ),
    );

    unmount();
    act(() => {
      second.onClose();
      jest.advanceTimersByTime(1000);
    });
    expect(mockSubscribeMapNotes).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('does not replace newer community notes with a stale visibility result', async () => {
    jest.useFakeTimers();
    let onEvent!: MockNoteListener;
    let resolveFirstVisibilityCheck!: (notes: MockNostrEvent[]) => void;
    const firstVisibilityCheck = new Promise<MockNostrEvent[]>(resolve => {
      resolveFirstVisibilityCheck = resolve;
    });
    mockSubscribeMapNotes.mockImplementationOnce(callback => {
      onEvent = callback;
      onEvent({
        id: 'note-first',
        content: 'First note',
        authorPubkey: 'author-first',
        tags: [['l', '8FVC9G8F+5W', 'open-location-code']],
      });
      return Promise.resolve();
    });
    mockFilterCommunityNotesByAuthorVisibility
      .mockImplementationOnce(() => firstVisibilityCheck)
      .mockImplementationOnce(notes => Promise.resolve(notes));

    renderCommunityNotesMap();

    await flushCommunityNotesTimers();

    onEvent({
      id: 'note-second',
      content: 'Second note',
      authorPubkey: 'author-second',
      tags: [['l', '8FVC9G8F+5W', 'open-location-code']],
    });
    await flushCommunityNotesTimers();

    await waitFor(() =>
      expect(mockSourcePropsById['community-notes'].data.features).toHaveLength(
        2,
      ),
    );

    await act(async () => {
      resolveFirstVisibilityCheck([
        {
          id: 'note-first',
          content: 'First note',
          authorPubkey: 'author-first',
          tags: [['l', '8FVC9G8F+5W', 'open-location-code']],
        },
      ]);
    });

    expect(mockSourcePropsById['community-notes'].data.features).toHaveLength(
      2,
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

    renderCommunityNotesMap({
      onCommunityNoteOpen,
    });

    clickCommunityNotePoint(
      {
        id: 'note-1',
        content: 'Stored map note',
        pubkey: 'validation-pubkey',
        created_at: 1700000000,
        kind: 30398,
        tags: JSON.stringify([['l', '8FVC9G8F+5W', 'open-location-code']]),
      },
      'note-1',
    );

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

  it('selects an individual offer when a community note cluster overlaps it', async () => {
    const onOfferOpen = jest.fn();
    renderCommunityNotesMap({
      onOfferOpen,
    });

    await act(async () => {
      // Mapbox reports features in rendered layer order. Community note
      // layers are drawn above offers, so their cluster can be first here.
      mockMapProps.onClick({
        features: [
          {
            id: 12,
            geometry: { coordinates: [9.14, 48.69] },
            layer: { id: 'community-notes-clusters' },
            properties: { cluster_id: 12, point_count: 3 },
          },
          {
            id: 'offer-1',
            source: 'offers',
            layer: { id: 'unclustered-point' },
            properties: { id: 'offer-1' },
          },
        ],
      });
      await Promise.resolve();
    });

    await waitFor(() => expect(onOfferOpen).toHaveBeenCalledWith(readOffer()));
    expect(mockSource.getClusterLeaves).not.toHaveBeenCalled();
  });

  it('reports visible community note threads from visibility-filtered map features', async () => {
    jest.useFakeTimers();
    const onVisibleCommunityNoteThreadsChange = jest.fn();
    const visiblePlusCode = '8FVC9G8F+5W';
    const outsidePlusCode = '7FG49Q00+';
    const visibleArea = new OpenLocationCode().decode(visiblePlusCode);
    mockMap.getBounds.mockReturnValue({
      getNorthEast: () => ({
        lat: visibleArea.latitudeCenter + 0.01,
        lng: visibleArea.longitudeCenter + 0.01,
      }),
      getSouthWest: () => ({
        lat: visibleArea.latitudeCenter - 0.01,
        lng: visibleArea.longitudeCenter - 0.01,
      }),
    });
    mockFilterCommunityNotesByAuthorVisibility.mockImplementationOnce(notes =>
      Promise.resolve(notes.filter(note => note.id !== 'hidden-note')),
    );
    mockSubscribeMapNotes.mockImplementationOnce(onEvent => {
      onEvent({
        id: 'visible-note-one',
        content: 'First visible note',
        pubkey: 'fictional-author',
        created_at: 1700000000,
        kind: 30398,
        tags: [['l', visiblePlusCode, 'open-location-code']],
      });
      onEvent({
        id: 'visible-note-two',
        content: 'Second visible note',
        pubkey: 'fictional-author',
        created_at: 1700000100,
        kind: 30398,
        tags: [['l', visiblePlusCode, 'open-location-code']],
      });
      onEvent({
        id: 'outside-note',
        content: 'Outside the viewport',
        pubkey: 'fictional-author',
        created_at: 1700000200,
        kind: 30398,
        tags: [['l', outsidePlusCode, 'open-location-code']],
      });
      onEvent({
        id: 'hidden-note',
        content: 'Filtered by author visibility',
        pubkey: 'fictional-author',
        created_at: 1700000300,
        kind: 30398,
        tags: [['l', visiblePlusCode, 'open-location-code']],
      });
      return Promise.resolve();
    });

    renderCommunityNotesMap({
      onVisibleCommunityNoteThreadsChange,
    });

    await flushCommunityNotesViewport({
      latitude: visibleArea.latitudeCenter,
      longitude: visibleArea.longitudeCenter,
      zoom: 8,
    });

    await waitFor(() =>
      expect(onVisibleCommunityNoteThreadsChange).toHaveBeenLastCalledWith([
        {
          notes: [
            expect.objectContaining({ id: 'visible-note-one' }),
            expect.objectContaining({ id: 'visible-note-two' }),
          ],
          plusCode: visiblePlusCode,
        },
      ]),
    );
    expect(mockSourcePropsById['community-notes'].data.features).toHaveLength(
      3,
    );
    jest.useRealTimers();
  });

  it('excludes community notes outside a viewport that crosses the dateline', async () => {
    jest.useFakeTimers();
    const onVisibleCommunityNoteThreadsChange = jest.fn();
    const olc = new OpenLocationCode() as OpenLocationCodeRuntime;
    const eastPlusCode = olc.encode(0, 179, 10);
    const westPlusCode = olc.encode(0, -179, 10);
    const middlePlusCode = olc.encode(0, 0, 10);
    mockMap.getBounds.mockReturnValue(DATELINE_BOUNDS);
    mockSubscribeMapNotes.mockImplementationOnce(onEvent => {
      [eastPlusCode, westPlusCode, middlePlusCode].forEach((plusCode, index) =>
        onEvent({
          id: `note-${index}`,
          content: `Note ${index}`,
          pubkey: 'fictional-author',
          created_at: 1700000000 + index,
          kind: 30398,
          tags: [['l', plusCode, 'open-location-code']],
        }),
      );
      return Promise.resolve();
    });

    renderCommunityNotesMap({
      onVisibleCommunityNoteThreadsChange,
    });
    await flushCommunityNotesViewport({
      latitude: 0,
      longitude: 180,
      zoom: 8,
    });

    await waitFor(() =>
      expect(onVisibleCommunityNoteThreadsChange).toHaveBeenLastCalledWith([
        {
          notes: [expect.objectContaining({ id: 'note-0' })],
          plusCode: eastPlusCode,
        },
        {
          notes: [expect.objectContaining({ id: 'note-1' })],
          plusCode: westPlusCode,
        },
      ]),
    );
    jest.useRealTimers();
  });

  it('reconstructs a clicked community note when no stored thread is available', () => {
    const onCommunityNoteOpen = jest.fn();

    renderCommunityNotesMap({
      onCommunityNoteOpen,
    });

    clickCommunityNotePoint(
      {
        id: 'note-from-feature',
        content: 'Feature-only note',
        pubkey: 'author-pubkey',
        authorPubkey: 'author-pubkey',
        created_at: 1700000000,
        kind: 30397,
        tags: JSON.stringify([['l', '8FVC9G8F+5W', 'open-location-code']]),
      },
      'note-from-feature',
    );

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

    renderCommunityNotesMap({
      onCommunityNoteOpen,
    });

    clickCommunityNotePoint(
      {
        id: 'note-without-code',
        content: 'No code here',
        pubkey: 'author-pubkey',
        created_at: 1700000000,
        kind: 30397,
        tags: [],
      },
      'note-without-code',
    );

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
    renderCommunityNotesMapWithoutOpenHandler();

    expect(() => {
      clickCommunityNotePoint(
        {
          tags: [['l', '8FVC9G8F+5W', 'open-location-code']],
        },
        'note-1',
      );
    }).not.toThrow();
  });

  it('zooms in when a community note cluster is clicked', () => {
    renderCommunityNotesMap();

    clickCommunityNoteCluster({ coordinates: [13, 52] });

    expect(mockMapProps.latitude).toBe(52);
    expect(mockMapProps.longitude).toBe(13);
    expect(mockMapProps.zoom).toBe(5);
  });

  it('opens overlapping Community Notes instead of repeatedly zooming', () => {
    const onCommunityNoteOpen = jest.fn();
    const makeLeaf = (id: string, content: string, createdAt: number) => ({
      properties: {
        id,
        content,
        pubkey: `${id}-author`,
        authorPubkey: `${id}-author`,
        created_at: createdAt,
        kind: 30397,
        tags: JSON.stringify([['l', '9F350000+', 'open-location-code']]),
      },
    });
    mockSource.getClusterLeaves.mockImplementation(
      (clusterId, limit, offset, done) => {
        done(null, [
          makeLeaf('note-older', 'Older note', 1700000000),
          makeLeaf('note-newer', 'Newer note', 1700000100),
        ]);
      },
    );

    renderCommunityNotesMap({
      onCommunityNoteOpen,
    });

    clickCommunityNoteCluster({ clusterId: 7, pointCount: 2 });

    expect(mockSource.getClusterLeaves).toHaveBeenCalledWith(
      7,
      2,
      0,
      expect.any(Function),
    );
    expect(onCommunityNoteOpen).toHaveBeenCalledWith({
      notes: [
        expect.objectContaining({ id: 'note-older', content: 'Older note' }),
        expect.objectContaining({ id: 'note-newer', content: 'Newer note' }),
      ],
      plusCode: '9F350000+',
    });
    expect(mockMapProps.zoom).toBe(2);
  });

  it('uses zero leaves when a community cluster omits its point count', () => {
    mockSource.getClusterLeaves.mockImplementation(
      (clusterId, limit, offset, done) =>
        done(null, [
          {
            properties: {
              tags: JSON.stringify([['l', '9F350000+', 'open-location-code']]),
            },
          },
        ]),
    );
    renderCommunityNotesMap();

    clickCommunityNoteCluster({ clusterId: 12 });

    expect(mockSource.getClusterLeaves).toHaveBeenCalledWith(
      12,
      0,
      0,
      expect.any(Function),
    );
  });

  it('zooms Community Note clusters whose leaves have different locations', () => {
    mockSource.getClusterLeaves.mockImplementation(
      (clusterId, limit, offset, done) => {
        done(null, [
          {
            properties: {
              tags: JSON.stringify([['l', '9F350000+', 'open-location-code']]),
            },
          },
          {
            properties: {
              tags: JSON.stringify([
                ['l', '8FVC9G8F+5W', 'open-location-code'],
              ]),
            },
          },
        ]);
      },
    );

    renderCommunityNotesMap();

    clickCommunityNoteCluster({ clusterId: 8, pointCount: 2 });

    expect(mockMapProps.zoom).toBe(5);
  });

  it('falls back to zooming when cluster leaves cannot be read', () => {
    mockSource.getClusterLeaves.mockImplementation(
      (clusterId, limit, offset, done) => done(new Error('source unavailable')),
    );

    renderCommunityNotesMap();

    clickCommunityNoteCluster({ clusterId: 9, pointCount: 2 });

    expect(mockMapProps.zoom).toBe(5);
  });

  it('falls back to zooming when the Community Notes source is unavailable', () => {
    mockSourceInstance = null;
    renderCommunityNotesMap();

    clickCommunityNoteCluster({ clusterId: 10, pointCount: 2 });

    expect(mockMapProps.zoom).toBe(5);
  });

  it('does not require a note handler for overlapping Community Notes', () => {
    mockSource.getClusterLeaves.mockImplementation(
      (clusterId, limit, offset, done) => {
        done(null, [
          {
            properties: {
              tags: JSON.stringify([['l', '9F350000+', 'open-location-code']]),
            },
          },
        ]);
      },
    );
    renderCommunityNotesMapWithoutOpenHandler();

    expect(() => {
      clickCommunityNoteCluster({ clusterId: 11, pointCount: 1 });
    }).not.toThrow();
  });

  it('starts from the default location zoom when the persisted zoom is missing', () => {
    mockPersistentMapLocation = {
      latitude: 48.6908333333,
      longitude: 9.14055555556,
    };

    renderCommunityNotesMap();

    clickCommunityNoteCluster({ coordinates: [13, 52] });

    expect(mockMapProps.zoom).toBe(DEFAULT_LOCATION.zoom + 3);
  });

  it('expands a community-note cluster when viewing the whole world', () => {
    mockPersistentMapLocation.zoom = 0;
    renderCommunityNotesMap();
    clickCommunityNoteCluster({ coordinates: [13, 52] });
    expect(mockMapProps.zoom).toBe(5);
  });

  it('ignores community note clusters without coordinates', () => {
    renderCommunityNotesMap();

    clickMapFeatures([{ layer: { id: 'community-notes-clusters' } }]);

    expect(mockMapProps.zoom).toBe(2);
  });

  it('retries failed subscriptions and unsubscribes on unmount', async () => {
    jest.useFakeTimers();
    mockSubscribeMapNotes.mockRejectedValueOnce(new Error('relay unavailable'));

    const { unmount } = renderCommunityNotesMap();

    await waitFor(() => expect(mockSubscribeMapNotes).toHaveBeenCalledTimes(1));

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    await waitFor(() => expect(mockSubscribeMapNotes).toHaveBeenCalledTimes(2));

    unmount();

    expect(mockUnsubscribeMapNotes).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('flushes notes on relay EOSE and cancels a pending reconnect', async () => {
    jest.useFakeTimers();
    const { unmount } = renderCommunityNotesMap();
    await act(async () => {
      await Promise.resolve();
    });

    const subscribeCall = mockSubscribeMapNotes.mock.calls[0];
    if (!subscribeCall) {
      throw new Error('Expected a map-note subscription');
    }
    const [receiveNote, , subscriptionCallbacks] = subscribeCall;
    const handlers = requireSubscriptionCallbacks(subscriptionCallbacks);
    act(() => handlers.onEose());
    act(() =>
      receiveNote({
        id: 'note-1',
        tags: [['l', '9F350000+', 'open-location-code']],
      }),
    );
    act(() => handlers.onEose());
    expect(mockFilterCommunityNotesByAuthorVisibility).toHaveBeenCalled();

    act(() => handlers.onClose());
    unmount();

    expect(mockUnsubscribeMapNotes).toHaveBeenCalled();
    jest.useRealTimers();
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

  it('does not log offer query failures outside development', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockPersistentMapLocation = {
      ...mockPersistentMapLocation,
      zoom: 6,
    };
    mockQueryOffers.mockRejectedValueOnce(new Error('network failed'));

    renderSearchMap();

    await waitFor(() => expect(mockQueryOffers).toHaveBeenCalled());
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('uses the OSM cluster count layer when the persisted map style is OSM', () => {
    mockMapStyle = JSON.parse(JSON.stringify(MAP_STYLE_OSM));

    renderCommunityNotesMap();

    expect(mockMapProps.mapStyle).toEqual(MAP_STYLE_OSM);
    expect(mockLayerPropsById['cluster-count'].layout['text-font']).toEqual([
      'Open Sans Bold',
    ]);
    expect(
      mockLayerPropsById['community-notes-cluster-count'].layout['text-font'],
    ).toEqual(['Open Sans Semibold']);
  });
});
