import React from 'react';
import {
  act,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from '@testing-library/react';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';

import '@/config/client/i18n';
import { OpenLocationCode } from 'open-location-code';
import type { Event as NostrEvent } from 'nostr-tools';
import { DEFAULT_LOCATION } from '@/modules/core/client/utils/constants';
import type { MapDefaultLocation } from '@/modules/core/client/utils/use-map-default-location';
import SearchMap from '@/modules/search/client/components/SearchMap.component';
import { featureId } from '@/modules/search/client/utils/feature-id';
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

const analytics = fakeAnalytics();
const render = (...[ui, options]: Parameters<typeof rtlRender>) =>
  rtlRender(ui, { wrapper: analytics.wrapper, ...options });

let mockApproximateLocation: MapDefaultLocation | null = null;
let mockHasSavedLocation = true;
const mockStopDefaultLocation = vi.fn();
const mockDefaultLocation = vi.fn();
vi.mock('@/modules/core/client/utils/use-map-default-location', () => ({
  __esModule: true,
  default: (enabled: boolean) => {
    mockDefaultLocation(enabled);
    return [enabled ? mockApproximateLocation : null, mockStopDefaultLocation];
  },
}));
vi.mock('@/modules/core/client/components/DeviceLocationButton', () => ({
  __esModule: true,
  default: ({
    onRequest,
    onLocation,
    onApproximateLocation,
  }: {
    onRequest?: () => void;
    onLocation: (location: { lat: number; lng: number }) => void;
    onApproximateLocation?: (location: MapDefaultLocation) => void;
  }) => (
    <div>
      <button
        onClick={() => {
          onRequest?.();
          onLocation({ lat: 0, lng: 0 });
        }}
        type="button"
      >
        Mock precise location
      </button>
      <button
        onClick={() => {
          onRequest?.();
          onApproximateLocation?.({
            latitude: 12,
            longitude: 23,
            zoom: 5,
          });
        }}
        type="button"
      >
        Mock approximate location
      </button>
    </div>
  ),
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

const mockIsWebGLSupported = vi.fn();
vi.mock('@/modules/core/client/utils/map', () => ({
  isWebGLSupported: () => mockIsWebGLSupported(),
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
const mockGetNostrEventAuthorPubkey = vi.fn(
  (event: MockNostrEvent) => event.authorPubkey || event.pubkey,
);
const mockSubscribeMapNotes =
  vi.fn<
    (
      ...args: Parameters<MockSubscribeMapNotes>
    ) => ReturnType<MockSubscribeMapNotes>
  >();
const mockUnsubscribeMapNotes = vi.fn<(...args: []) => void>();
const mockFilterCommunityNotesByAuthorVisibility = vi.fn<
  (...args: [notes: MockNostrEvent[]]) => Promise<MockNostrEvent[]>
>(notes => Promise.resolve(notes));
vi.mock('@/modules/search/client/services/nostr.client.service', () => ({
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
const mockGetOffer =
  vi.fn<(...args: Parameters<MockGetOffer>) => ReturnType<MockGetOffer>>();
const mockQueryOffers =
  vi.fn<
    (...args: Parameters<MockQueryOffers>) => ReturnType<MockQueryOffers>
  >();
vi.mock('@/modules/offers/client/api/offers.api', () => ({
  getOffer: (offerId: string) => mockGetOffer(offerId),
  queryOffers: (query?: Parameters<MockQueryOffers>[0]) =>
    mockQueryOffers(query),
}));

vi.mock('@/modules/search/client/hooks/use-debounced-callback', () => ({
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
const mockSetPersistentMapLocation = vi.fn();
vi.mock('@/modules/search/client/hooks/use-persistent-map-location', () => ({
  __esModule: true,
  default: () => [
    mockPersistentMapLocation,
    mockSetPersistentMapLocation,
    mockHasSavedLocation,
  ],
}));

vi.mock('@/modules/core/client/components/Map/MapNavigationControl', () => {
  return {
    default: function MockMapNavigationControl() {
      return <div data-testid="map-navigation-control" />;
    },
  };
});

vi.mock('@/modules/core/client/components/Map/MapScaleControl', () => {
  return {
    default: function MockMapScaleControl() {
      return <div data-testid="map-scale-control" />;
    },
  };
});

vi.mock('@/modules/search/client/components/SearchMapNoContent', () => {
  return {
    default: function MockSearchMapNoContent() {
      return <div>Zoom closer to find members.</div>;
    },
  };
});

const mockFitBounds = vi.fn();
const mockMap = {
  getBounds: vi.fn(),
  cameraForBounds: mockFitBounds,
  flyTo: vi.fn(),
  touchZoomRotate: { disableRotation: vi.fn() },
  scrollZoom: { setWheelZoomRate: vi.fn() },
  getFeatureState: vi.fn(),
  getSource: vi.fn(),
  getZoom: vi.fn(),
  setFeatureState: vi.fn(),
};
let mockMapInstance: typeof mockMap | null = mockMap;
let mockMapProps!: MockMapProps;
let mockSourceProps!: MockSourceProps;
let mockSourcePropsById: Record<string, MockSourceProps> = {};
let mockLayerPropsById: Record<string, { layout: Record<string, unknown> }> =
  {};
const mockSource = {
  getClusterExpansionZoom: vi.fn(),
  getClusterLeaves: vi.fn(),
};
let mockSourceInstance: typeof mockSource | null = mockSource;
vi.mock('@vis.gl/react-maplibre', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

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
        { 'data-testid': '@vis.gl/react-maplibre' },
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

const flushPromises = () => act(async () => {});

function renderSearchMap(props: SearchMapRenderProps = {}) {
  const defaultProps: SearchMapProps = {
    filters: '{}',
    isUserPublic: true,
    onCommunityNoteOpen: vi.fn(),
    onOfferClose: vi.fn(),
    onOfferOpen: vi.fn(),
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
    {
      id,
      layer: { id: 'unclustered-point' },
      properties: { id },
      source: 'offers',
    },
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
  fireEvent.pointerDown(screen.getByTestId('@vis.gl/react-maplibre'));
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
    vi.advanceTimersByTime(200);
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
  mockIsWebGLSupported.mockReturnValue(true);
  mockSourcePropsById = {};
  mockLayerPropsById = {};
  mockPersistentMapLocation = {
    latitude: 48.6908333333,
    longitude: 9.14055555556,
    zoom: 2,
  };
  analytics.track.mockClear();
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
  mockSource.getClusterExpansionZoom.mockResolvedValue(18);
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
  mockSubscribeMapNotes.mockResolvedValue({ close: vi.fn() });
  mockFilterCommunityNotesByAuthorVisibility.mockImplementation(notes =>
    Promise.resolve(notes),
  );
  vi.clearAllMocks();
});

describe('Search', () => {
  it('uses an approximate initial viewport without persisting it', () => {
    mockHasSavedLocation = false;
    mockApproximateLocation = { latitude: 34, longitude: -17, zoom: 6 };
    renderSearchMap({ location: {} });
    expect(mockMapProps.latitude).toBe(34);
    expect(mockMapProps.longitude).toBe(-17);
    expect(
      screen.getByRole('link', { name: 'Data credits' }),
    ).toBeInTheDocument();
    expect(mockSetPersistentMapLocation).not.toHaveBeenCalled();
  });

  it('keeps recent saved positions ahead of approximate locations', () => {
    mockApproximateLocation = { latitude: 34, longitude: -17, zoom: 6 };
    renderSearchMap();
    expect(mockDefaultLocation).toHaveBeenCalledWith(false);
    expect(mockMapProps.latitude).toBe(mockPersistentMapLocation.latitude);
  });

  it('stops GeoIP and forwards precise and approximate device locations', () => {
    mockHasSavedLocation = false;
    const onDeviceLocationRequest = vi.fn();
    const onDeviceLocation = vi.fn();
    const onApproximateLocation = vi.fn();
    renderSearchMap({
      onDeviceLocationRequest,
      onDeviceLocation,
      onApproximateLocation,
    });
    mockStopDefaultLocation.mockClear();

    fireEvent.click(
      screen.getByRole('button', { name: 'Mock precise location' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Mock approximate location' }),
    );

    expect(mockDefaultLocation).toHaveBeenCalledWith(true);
    expect(mockStopDefaultLocation).toHaveBeenCalled();
    expect(onDeviceLocationRequest).toHaveBeenCalledTimes(2);
    expect(onDeviceLocation).toHaveBeenCalledWith({ lat: 0, lng: 0 });
    expect(onApproximateLocation).toHaveBeenCalledWith({
      latitude: 12,
      longitude: 23,
      zoom: 5,
    });
  });

  it('does not reapply GeoIP after a member clears a later explicit destination', () => {
    mockHasSavedLocation = false;
    mockApproximateLocation = { latitude: 34, longitude: -17, zoom: 6 };
    const props = {
      filters: '{}',
      isUserPublic: true,
      onCommunityNoteOpen: vi.fn(),
      onOfferClose: vi.fn(),
      onOfferOpen: vi.fn(),
    };
    const { rerender } = render(<SearchMap {...props} location={{}} />);
    expect(mockMapProps.latitude).toBe(34);
    rerender(<SearchMap {...props} location={{ lat: 12, lng: 23 }} />);
    expect(mockMapProps.latitude).toBe(12);
    rerender(<SearchMap {...props} location={{}} />);
    expect(mockMapProps.latitude).toBe(12);
  });

  it('does not persist camera changes the member did not make', () => {
    renderSearchMap();
    act(() =>
      mockMapProps.onMove({
        viewState: { latitude: 34, longitude: -17, zoom: 6 },
      }),
    );
    expect(mockMapProps.latitude).toBe(34);
    expect(mockSetPersistentMapLocation).not.toHaveBeenCalled();
    expect(mockStopDefaultLocation).not.toHaveBeenCalled();
  });

  it('initialises the loaded map without touch rotation and fetches visible offers', async () => {
    mockPersistentMapLocation.zoom = 8;
    renderSearchMap();
    expect(mockMapProps.mapStyle).toBe(
      'https://tiles.openfreemap.org/styles/liberty',
    );
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
    'selects MapLibre by WebGL2 support regardless of user agent %s',
    userAgent => {
      const currentUserAgent = vi
        .spyOn(navigator, 'userAgent', 'get')
        .mockReturnValue(userAgent);
      renderSearchMap();
      expect(screen.getByTestId('@vis.gl/react-maplibre')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(mockIsWebGLSupported).toHaveBeenCalled();
      currentUserAgent.mockRestore();
    },
  );

  it('shows a notice instead of the map when WebGL is unavailable', () => {
    mockIsWebGLSupported.mockReturnValue(false);

    renderSearchMap();

    expect(screen.getByRole('status')).toHaveTextContent(
      'This browser cannot show the map because WebGL is not available.',
    );
    expect(
      screen.queryByTestId('@vis.gl/react-maplibre'),
    ).not.toBeInTheDocument();
    expect(mockQueryOffers).not.toHaveBeenCalled();
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

    act(() =>
      screen.getByTestId('@vis.gl/react-maplibre').dispatchEvent(pinch),
    );

    expect(pinch.defaultPrevented).toBe(true);
    expect(mockMapProps.zoom).toBe(2.5);
    expect(mockSetPersistentMapLocation).toHaveBeenCalledWith(
      expect.objectContaining({ zoom: 2.5 }),
    );

    act(() =>
      screen.getByTestId('@vis.gl/react-maplibre').dispatchEvent(
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
      screen.getByTestId('@vis.gl/react-maplibre').dispatchEvent(
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
    const map = screen.getByTestId('@vis.gl/react-maplibre');
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
    const consoleError = vi
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

  it('counts each move into an area without offers once, without the place', async () => {
    mockPersistentMapLocation = {
      ...mockPersistentMapLocation,
      zoom: 6.4,
    };

    renderSearchMap({
      filters: '{"tribes":["circle-1"],"types":["meet"],"languages":[]}',
    });

    await waitFor(() =>
      expect(analytics.track).toHaveBeenCalledWith('search_no_results', {
        zoom: 6,
        filters: 2,
      }),
    );

    act(() => mockMapProps.onMoveEnd());
    await waitFor(() => expect(mockQueryOffers).toHaveBeenCalledTimes(2));

    mockQueryOffers.mockResolvedValueOnce({
      features: DATELINE_OFFER_FEATURES,
      type: 'FeatureCollection',
    });
    act(() => mockMapProps.onMoveEnd());
    await waitFor(() => expect(mockQueryOffers).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(mockSourceProps.data.features).toEqual(
        DATELINE_OFFER_FEATURES.map(feature =>
          expect.objectContaining(feature),
        ),
      ),
    );
    expect(analytics.track).toHaveBeenCalledTimes(1);

    act(() => mockMapProps.onMoveEnd());
    await waitFor(() => expect(analytics.track).toHaveBeenCalledTimes(2));
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
    const onVisibleOffersChange = vi.fn();
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
        id: featureId('new'),
        geometry: { type: 'Point', coordinates: [13, 52] },
        properties: { id: 'new' },
      },
    ]);
    expect(mockSourceProps).not.toHaveProperty('promoteId');
    expect(onVisibleOffersChange).toHaveBeenLastCalledWith(['new']);
  });

  it('reports only offer pins inside a viewport crossing the dateline', async () => {
    const onVisibleOffersChange = vi.fn();
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
    const onOfferClose = vi.fn();
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
    const onOfferClose = vi.fn();
    renderSearchMap({ onOfferClose });

    expect(onOfferClose).not.toHaveBeenCalled();

    clickMapFeatures([]);

    expect(onOfferClose).toHaveBeenCalledTimes(1);
  });

  it('closes an open offer when search filters change', async () => {
    const onOfferClose = vi.fn();
    const { rerender } = renderSearchMap({ onOfferClose });

    expect(onOfferClose).not.toHaveBeenCalled();

    rerender(
      <SearchMap
        filters='{"hosting":"yes"}'
        isUserPublic={true}
        onCommunityNoteOpen={() => {}}
        onOfferClose={onOfferClose}
        onOfferOpen={vi.fn()}
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
    const onOfferOpen = vi.fn();
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

  it('opens the offer named by the pin rather than its numeric map feature id', async () => {
    renderSearchMap();

    clickMapFeatures([
      {
        id: featureId('offer-1'),
        layer: { id: 'unclustered-point' },
        properties: { id: 'offer-1' },
        source: 'offers',
      },
    ]);

    await waitFor(() => expect(mockGetOffer).toHaveBeenCalledWith('offer-1'));
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
      onCommunityNoteOpen: vi.fn(),
      onOfferClose: vi.fn(),
      onOfferOpen: vi.fn(),
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
    const onOfferOpen = vi.fn();
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

  it('zooms to clusters using the cluster expansion zoom', async () => {
    renderSearchMap();

    clickOfferCluster(123);
    await flushPromises();

    expect(mockSource.getClusterExpansionZoom).toHaveBeenCalledWith(123);
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

  it('ignores clusters without an expansion id or expansion zoom', async () => {
    renderSearchMap();

    clickMapFeatures([
      {
        geometry: { coordinates: [24, 60] },
        layer: { id: 'clusters' },
        properties: {},
      },
    ]);

    expect(mockSource.getClusterExpansionZoom).not.toHaveBeenCalled();

    mockSource.getClusterExpansionZoom.mockRejectedValueOnce(
      new Error('missing zoom'),
    );

    clickOfferCluster(123);
    await flushPromises();

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

  it('does not subscribe to community notes while filtering by connections', () => {
    renderCommunityNotesMap({
      filters: JSON.stringify({ communityNotes: true, connectionsOnly: true }),
    });

    expect(mockSubscribeMapNotes).not.toHaveBeenCalled();
  });

  it('subscribes to community notes and converts valid location events to geojson', async () => {
    vi.useFakeTimers();
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
    expect(mockSourcePropsById['community-notes']).not.toHaveProperty(
      'promoteId',
    );
    expect(mockSourcePropsById['community-notes'].data.features[0]).toEqual(
      expect.objectContaining({
        id: featureId('note-valid'),
        properties: expect.objectContaining({
          authorPubkey: 'author-pubkey',
          content: 'A valid map note',
          kind: 30397,
        }),
      }),
    );

    vi.useRealTimers();
  });

  it('hides community notes blocked by the Nostr visibility check', async () => {
    vi.useFakeTimers();
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
      featureId('note-visible'),
    );
    expect(mockFilterCommunityNotesByAuthorVisibility).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'note-visible' }),
        expect.objectContaining({ id: 'note-hidden' }),
      ]),
    );

    vi.useRealTimers();
  });

  it('reconnects after an interrupted relay load and deduplicates replayed notes', async () => {
    vi.useFakeTimers();
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
      vi.advanceTimersByTime(1000);
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
      vi.advanceTimersByTime(1000);
    });
    expect(mockSubscribeMapNotes).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('does not replace newer community notes with a stale visibility result', async () => {
    vi.useFakeTimers();
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
    vi.useRealTimers();
  });

  it('opens community note threads from stored map note events', () => {
    const onCommunityNoteOpen = vi.fn();
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
    const onOfferOpen = vi.fn();
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
    vi.useFakeTimers();
    const onVisibleCommunityNoteThreadsChange = vi.fn();
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
    vi.useRealTimers();
  });

  it('excludes community notes outside a viewport that crosses the dateline', async () => {
    vi.useFakeTimers();
    const onVisibleCommunityNoteThreadsChange = vi.fn();
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
    vi.useRealTimers();
  });

  it('reconstructs a clicked community note when no stored thread is available', () => {
    const onCommunityNoteOpen = vi.fn();

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
    const onCommunityNoteOpen = vi.fn();

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

  it('opens overlapping Community Notes instead of repeatedly zooming', async () => {
    const onCommunityNoteOpen = vi.fn();
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
    mockSource.getClusterLeaves.mockResolvedValue([
      makeLeaf('note-older', 'Older note', 1700000000),
      makeLeaf('note-newer', 'Newer note', 1700000100),
    ]);

    renderCommunityNotesMap({
      onCommunityNoteOpen,
    });

    clickCommunityNoteCluster({ clusterId: 7, pointCount: 2 });
    await flushPromises();

    expect(mockSource.getClusterLeaves).toHaveBeenCalledWith(7, 2, 0);
    expect(onCommunityNoteOpen).toHaveBeenCalledWith({
      notes: [
        expect.objectContaining({ id: 'note-older', content: 'Older note' }),
        expect.objectContaining({ id: 'note-newer', content: 'Newer note' }),
      ],
      plusCode: '9F350000+',
    });
    expect(mockMapProps.zoom).toBe(2);
  });

  it('uses zero leaves when a community cluster omits its point count', async () => {
    mockSource.getClusterLeaves.mockResolvedValue([
      {
        properties: {
          tags: JSON.stringify([['l', '9F350000+', 'open-location-code']]),
        },
      },
    ]);
    renderCommunityNotesMap();

    clickCommunityNoteCluster({ clusterId: 12 });
    await flushPromises();

    expect(mockSource.getClusterLeaves).toHaveBeenCalledWith(12, 0, 0);
  });

  it('zooms Community Note clusters whose leaves have different locations', async () => {
    mockSource.getClusterLeaves.mockResolvedValue([
      {
        properties: {
          tags: JSON.stringify([['l', '9F350000+', 'open-location-code']]),
        },
      },
      {
        properties: {
          tags: JSON.stringify([['l', '8FVC9G8F+5W', 'open-location-code']]),
        },
      },
    ]);

    renderCommunityNotesMap();

    clickCommunityNoteCluster({ clusterId: 8, pointCount: 2 });
    await flushPromises();

    expect(mockMapProps.zoom).toBe(5);
  });

  it('falls back to zooming when cluster leaves cannot be read', async () => {
    mockSource.getClusterLeaves.mockRejectedValue(
      new Error('source unavailable'),
    );

    renderCommunityNotesMap();

    clickCommunityNoteCluster({ clusterId: 9, pointCount: 2 });
    await flushPromises();

    expect(mockMapProps.zoom).toBe(5);
  });

  it('falls back to zooming when the Community Notes source is unavailable', () => {
    mockSourceInstance = null;
    renderCommunityNotesMap();

    clickCommunityNoteCluster({ clusterId: 10, pointCount: 2 });

    expect(mockMapProps.zoom).toBe(5);
  });

  it('does not require a note handler for overlapping Community Notes', async () => {
    mockSource.getClusterLeaves.mockResolvedValue([
      {
        properties: {
          tags: JSON.stringify([['l', '9F350000+', 'open-location-code']]),
        },
      },
    ]);
    renderCommunityNotesMapWithoutOpenHandler();

    clickCommunityNoteCluster({ clusterId: 11, pointCount: 1 });
    await flushPromises();
    expect(mockSource.getClusterLeaves).toHaveBeenCalledWith(11, 1, 0);
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
    vi.useFakeTimers();
    mockSubscribeMapNotes.mockRejectedValueOnce(new Error('relay unavailable'));

    const { unmount } = renderCommunityNotesMap();

    await waitFor(() => expect(mockSubscribeMapNotes).toHaveBeenCalledTimes(1));

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    await waitFor(() => expect(mockSubscribeMapNotes).toHaveBeenCalledTimes(2));

    unmount();

    expect(mockUnsubscribeMapNotes).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('flushes notes on relay EOSE and cancels a pending reconnect', async () => {
    vi.useFakeTimers();
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
    vi.useRealTimers();
  });

  it('logs offer query failures in development without replacing current offers', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const consoleError = vi
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
    const consoleError = vi
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

  it('uses a font from the map style for cluster counts', () => {
    renderCommunityNotesMap();

    expect(mockLayerPropsById['cluster-count'].layout['text-font']).toEqual([
      'Noto Sans Bold',
    ]);
    expect(
      mockLayerPropsById['community-notes-cluster-count'].layout['text-font'],
    ).toEqual(['Noto Sans Bold']);
  });
});
