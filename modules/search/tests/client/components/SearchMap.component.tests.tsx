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
import type {
  MapBounds,
  MapProps,
  MapView,
} from '@/modules/core/client/components/Map/types';

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
type OfferSearchResponse = OfferSearchFeatureCollection;
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

vi.mock('@/modules/search/client/components/SearchMapNoContent', () => {
  return {
    default: function MockSearchMapNoContent() {
      return <div>Zoom closer to find members.</div>;
    },
  };
});

const mockHandle = {
  fitBounds: vi.fn(),
  flyTo: vi.fn(),
  setPointState: vi.fn(),
};
const mockCluster = { expansionZoom: vi.fn(), leaves: vi.fn() };
let mockBounds: MapBounds;
let mockAutoLoad = true;
let mockMapProps!: MapProps;
vi.mock('@/modules/core/client/components/Map/index', () => ({
  default: function MockMap(props: MapProps) {
    mockMapProps = props;
    React.useImperativeHandle(props.ref, () => mockHandle);
    React.useEffect(() => {
      // Maps load after the page's own mount effects have run.
      if (mockAutoLoad) {
        void Promise.resolve().then(() =>
          act(() => props.onLoad!(props.view, mockBounds)),
        );
      }
    }, []);
    return <div data-testid="search-map-canvas">{props.children}</div>;
  },
}));

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

function mapView() {
  const map = document.querySelector<HTMLElement>('.search-map')!;
  return {
    latitude: Number(map.dataset.mapLatitude),
    longitude: Number(map.dataset.mapLongitude),
    zoom: Number(map.dataset.mapZoom),
  };
}

function layer(id: string) {
  return mockMapProps.layers!.find(layer => layer.id === id)!;
}

function clickPoint(layerId: string, properties: Record<string, unknown>) {
  act(() =>
    mockMapProps.onPointClick!(layerId, {
      id: featureId(String(properties.id)),
      latitude: 0,
      longitude: 0,
      colour: '#000',
      properties,
    }),
  );
}

function clickOfferPin(id: string) {
  clickPoint('offers', { id });
}

function clickCommunityNotePoint(properties: Record<string, unknown>) {
  clickPoint('community-notes', properties);
}

function clickCluster(layerId: string, [longitude, latitude]: number[]) {
  act(() =>
    mockMapProps.onClusterClick!(layerId, {
      latitude,
      longitude,
      expansionZoom: mockCluster.expansionZoom,
      leaves: mockCluster.leaves,
    }),
  );
}

function clickOfferCluster(coordinates: number[] = [24, 60]) {
  clickCluster('offers', coordinates);
}

function clickCommunityNoteCluster(coordinates: number[] = [3.5, 51.5]) {
  clickCluster('community-notes', coordinates);
}

const DATELINE_BOUNDS = {
  northEast: { lat: 10, lng: -170 },
  southWest: { lat: -10, lng: 170 },
};

const WORLD_BOUNDS = {
  northEast: { lat: 90, lng: 180 },
  southWest: { lat: -90, lng: -180 },
};

const DATELINE_OFFER_FEATURES: OfferSearchFeature[] = [
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [179, 0] },
    properties: { id: 'east', type: 'host' },
  },
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-179, 0] },
    properties: { id: 'west', type: 'meet' },
  },
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: { id: 'middle', type: 'host' },
  },
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [179, 20] },
    properties: { id: 'north', type: 'meet' },
  },
];

function moveMap(view: MapView) {
  fireEvent.pointerDown(screen.getByTestId('search-map-canvas'));
  mockMapProps.onMove!(view, mockBounds);
}

function moveEnd() {
  act(() => {
    mockMapProps.onMove!(mapView(), mockBounds);
    mockMapProps.onMoveEnd!(mapView(), mockBounds, false);
  });
}

function flushMapViewport(viewport: MapView) {
  act(() => {
    moveMap(viewport);
  });
  moveEnd();
}

async function flushCommunityNotesTimers() {
  await act(async () => {
    vi.advanceTimersByTime(200);
    await Promise.resolve();
  });
}

async function flushCommunityNotesViewport(viewport: MapView) {
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
  mockPersistentMapLocation = {
    latitude: 48.6908333333,
    longitude: 9.14055555556,
    zoom: 2,
  };
  analytics.track.mockClear();
  mockAutoLoad = true;
  mockBounds = {
    northEast: { lat: 89.5, lng: 179.5 },
    southWest: { lat: -89.5, lng: -179.5 },
  };
  mockHandle.flyTo.mockImplementation((view: MapView) => moveMap(view));
  mockCluster.expansionZoom.mockResolvedValue(18);
  mockCluster.leaves.mockResolvedValue([
    { properties: { tags: [['l', '9F350000+', 'open-location-code']] } },
    { properties: { tags: [['l', '8FVC9G8F+5W', 'open-location-code']] } },
  ]);
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
    expect(mapView().latitude).toBe(34);
    expect(mapView().longitude).toBe(-17);
    expect(
      screen.getByRole('link', { name: 'Data credits' }),
    ).toBeInTheDocument();
    expect(mockSetPersistentMapLocation).not.toHaveBeenCalled();
  });

  it('keeps recent saved positions ahead of approximate locations', () => {
    mockApproximateLocation = { latitude: 34, longitude: -17, zoom: 6 };
    renderSearchMap();
    expect(mockDefaultLocation).toHaveBeenCalledWith(false);
    expect(mapView().latitude).toBe(mockPersistentMapLocation.latitude);
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
    expect(mapView().latitude).toBe(34);
    rerender(<SearchMap {...props} location={{ lat: 12, lng: 23 }} />);
    expect(mapView().latitude).toBe(12);
    rerender(<SearchMap {...props} location={{}} />);
    expect(mapView().latitude).toBe(12);
  });

  it('does not persist camera changes the member did not make', () => {
    renderSearchMap();
    act(() =>
      mockMapProps.onMove!(
        { latitude: 34, longitude: -17, zoom: 6 },
        mockBounds,
      ),
    );
    expect(mapView().latitude).toBe(34);
    expect(mockSetPersistentMapLocation).not.toHaveBeenCalled();
    expect(mockStopDefaultLocation).not.toHaveBeenCalled();
  });

  it('fetches visible offers once the map loads', async () => {
    mockPersistentMapLocation.zoom = 8;
    mockAutoLoad = false;
    renderSearchMap();
    expect(mockQueryOffers).not.toHaveBeenCalled();
    await act(async () => mockMapProps.onLoad!(mockMapProps.view, mockBounds));
    expect(mockQueryOffers).toHaveBeenCalled();
  });
  it('fits externally supplied bounds once the map loads', () => {
    const locationBounds = {
      northEast: { lat: 54, lng: 25 },
      southWest: { lat: 50, lng: 20 },
    };
    mockAutoLoad = false;
    renderSearchMap({ locationBounds });
    expect(mockHandle.fitBounds).not.toHaveBeenCalled();
    act(() => mockMapProps.onLoad!(mockMapProps.view, mockBounds));
    expect(mockHandle.fitBounds).toHaveBeenCalledWith(locationBounds, {
      padding: 40,
      animate: false,
    });
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

  it('stores viewport changes and fills the map container', () => {
    renderSearchMap();

    act(() => {
      moveMap({ latitude: 51, longitude: 12, zoom: 9 });
    });

    expect(mockSetPersistentMapLocation).toHaveBeenCalledWith({
      latitude: 51,
      longitude: 12,
      zoom: 9,
    });
    expect(mapView()).toEqual({ latitude: 51, longitude: 12, zoom: 9 });
    expect(mockMapProps.style).toEqual({ width: '100%', height: '100%' });
  });
  it('uses the default map location when persisted coordinates are missing', () => {
    mockPersistentMapLocation = {
      zoom: 2,
    };

    renderSearchMap();

    expect(mapView().latitude).toBe(48.6908333333);
    expect(mapView().longitude).toBe(9.14055555556);
    expect(mapView().zoom).toBe(2);
  });

  it('accepts missing filters as an empty filter set', () => {
    renderSearchMap({
      filters: undefined,
    });

    expect(mockMapProps.layers!.map(({ id }) => id)).toEqual(['offers']);
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
    moveEnd();

    await waitFor(() => expect(mockQueryOffers).toHaveBeenCalledTimes(1));
    expect(layer('offers').points).toEqual([]);
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

    moveEnd();
    await waitFor(() => expect(mockQueryOffers).toHaveBeenCalledTimes(2));

    mockQueryOffers.mockResolvedValueOnce({
      features: DATELINE_OFFER_FEATURES,
      type: 'FeatureCollection',
    });
    moveEnd();
    await waitFor(() => expect(mockQueryOffers).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(layer('offers').points).toEqual(
        DATELINE_OFFER_FEATURES.map(({ geometry, properties }) =>
          expect.objectContaining({
            longitude: geometry.coordinates[0],
            latitude: geometry.coordinates[1],
            properties,
          }),
        ),
      ),
    );
    expect(analytics.track).toHaveBeenCalledTimes(1);

    moveEnd();
    await waitFor(() => expect(analytics.track).toHaveBeenCalledTimes(2));
  });

  it('keeps a newer offer response when an older viewport request finishes last', async () => {
    const onVisibleOffersChange = vi.fn();
    const requests: Array<(response: OfferSearchResponse) => void> = [];
    mockQueryOffers.mockImplementation(
      () => new Promise<OfferSearchResponse>(resolve => requests.push(resolve)),
    );

    renderSearchMap({ onVisibleOffersChange });
    act(() => moveMap({ latitude: 0, longitude: 0, zoom: 8 }));
    moveEnd();
    await waitFor(() => expect(requests).toHaveLength(1));

    act(() => moveMap({ latitude: 1, longitude: 1, zoom: 9 }));
    moveEnd();
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

    expect(layer('offers').points).toEqual([
      {
        id: featureId('new'),
        longitude: 13,
        latitude: 52,
        colour: '#ccc',
        properties: { id: 'new' },
      },
    ]);
    expect(onVisibleOffersChange).toHaveBeenLastCalledWith(['new']);
  });

  it('reports only offer pins inside a viewport crossing the dateline', async () => {
    const onVisibleOffersChange = vi.fn();
    const onVisibleMapCountsChange = vi.fn();
    mockBounds = DATELINE_BOUNDS;
    mockQueryOffers.mockResolvedValue({
      features: DATELINE_OFFER_FEATURES,
      type: 'FeatureCollection',
    });

    renderSearchMap({ onVisibleOffersChange, onVisibleMapCountsChange });
    flushMapViewport({ latitude: 0, longitude: 180, zoom: 8 });

    await waitFor(() =>
      expect(onVisibleOffersChange).toHaveBeenLastCalledWith(['east', 'west']),
    );
    expect(onVisibleMapCountsChange).toHaveBeenLastCalledWith({
      host: 1,
      meet: 1,
    });

    mockBounds = WORLD_BOUNDS;
    mockQueryOffers.mockResolvedValue({
      features: DATELINE_OFFER_FEATURES,
      type: 'FeatureCollection',
    });
    moveEnd();

    await waitFor(() =>
      expect(onVisibleOffersChange).toHaveBeenLastCalledWith([
        'east',
        'west',
        'middle',
        'north',
      ]),
    );
    expect(onVisibleMapCountsChange).toHaveBeenLastCalledWith({
      host: 2,
      meet: 2,
    });
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

    await waitFor(() => expect(mapView().zoom).toBe(6));
    expect(onOfferClose).not.toHaveBeenCalled();
    expect(mockQueryOffers).not.toHaveBeenCalled();
  });

  it('does not query offers before the map loads', async () => {
    mockPersistentMapLocation = {
      ...mockPersistentMapLocation,
      zoom: 6,
    };
    mockAutoLoad = false;

    renderSearchMap();

    await waitFor(() => expect(mapView().zoom).toBe(6));
    expect(mockQueryOffers).not.toHaveBeenCalled();
  });
  it('closes any open offer when the map canvas is clicked', async () => {
    const onOfferClose = vi.fn();
    renderSearchMap({ onOfferClose });

    expect(onOfferClose).not.toHaveBeenCalled();

    act(() => mockMapProps.onClick!([0, 0]));

    expect(onOfferClose).toHaveBeenCalledTimes(1);
  });
  it('clears the pin highlight when search filters change', async () => {
    const onOfferClose = vi.fn();
    const { rerender } = renderSearchMap({ onOfferClose });

    clickOfferPin('offer-id');
    expect(mockHandle.setPointState).toHaveBeenCalledWith(
      'offers',
      featureId('offer-id'),
      { selected: true, viewed: true },
    );

    rerender(
      <SearchMap
        filters='{"hosting":"yes"}'
        isUserPublic={true}
        onCommunityNoteOpen={() => {}}
        onOfferClose={onOfferClose}
        onOfferOpen={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(mockHandle.setPointState).toHaveBeenCalledWith(
        'offers',
        featureId('offer-id'),
        { selected: false },
      ),
    );
    expect(onOfferClose).not.toHaveBeenCalled();
  });

  it('marks clicked offers selected and opens the offer details', async () => {
    const onOfferOpen = vi.fn();
    const offer = readOffer();
    mockGetOffer.mockResolvedValueOnce(offer);

    renderSearchMap({ onOfferOpen });

    clickOfferPin('offer-1');

    expect(mockHandle.setPointState).toHaveBeenCalledWith(
      'offers',
      featureId('offer-1'),
      { selected: true, viewed: true },
    );
    await waitFor(() => expect(onOfferOpen).toHaveBeenCalledWith(offer));
  });

  it('opens the offer named by the pin rather than its numeric map feature id', async () => {
    renderSearchMap();

    clickOfferPin('offer-1');

    await waitFor(() => expect(mockGetOffer).toHaveBeenCalledWith('offer-1'));
    expect(mockGetOffer).not.toHaveBeenCalledWith(String(featureId('offer-1')));
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

    expect(mockHandle.setPointState).toHaveBeenCalledWith(
      'offers',
      featureId('offer-1'),
      { selected: false },
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

    clickPoint('offers', {});

    expect(mockGetOffer).not.toHaveBeenCalled();
    expect(mockHandle.setPointState).not.toHaveBeenCalled();
  });
  it('clears the previous selected offer when selecting another one', () => {
    renderSearchMap();

    clickOfferPin('offer-1');
    clickOfferPin('offer-2');

    expect(mockHandle.setPointState).toHaveBeenCalledWith(
      'offers',
      featureId('offer-1'),
      { selected: false },
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

  it('zooms to clusters using the cluster expansion zoom', async () => {
    mockCluster.expansionZoom.mockResolvedValueOnce(9);
    renderSearchMap();

    clickOfferCluster();
    await flushPromises();
    expect(mapView()).toEqual({ latitude: 60, longitude: 24, zoom: 10 });

    clickOfferCluster();
    await flushPromises();
    expect(mapView().zoom).toBe(12);
  });
  it('stays put when a cluster has no expansion zoom', async () => {
    renderSearchMap();
    mockCluster.expansionZoom.mockRejectedValueOnce(new Error('missing zoom'));

    clickOfferCluster();
    await flushPromises();

    expect(mapView().zoom).toBe(2);
    expect(mockCluster.leaves).not.toHaveBeenCalled();
  });
  it('applies external location bounds and selected location updates', async () => {
    const locationBounds = {
      northEast: { lat: 54, lng: 25 },
      southWest: { lat: 50, lng: 20 },
    };
    renderSearchMap({ location: { lat: 10, lng: 20 }, locationBounds });

    await waitFor(() =>
      expect(mockHandle.fitBounds).toHaveBeenCalledWith(locationBounds, {
        padding: 40,
        animate: false,
      }),
    );
    expect(mockMapProps.view).toEqual({ latitude: 10, longitude: 20, zoom: 6 });
    expect(mapView()).toEqual({ latitude: 10, longitude: 20, zoom: 6 });
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
      expect(layer('community-notes').points).toHaveLength(1),
    );
    expect(layer('community-notes').points[0]).toEqual(
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
      expect(layer('community-notes').points).toHaveLength(1),
    );
    expect(layer('community-notes').points[0]!.properties!.content).toBe(
      'Visible note',
    );
    expect(layer('community-notes').points[0].id).toBe(
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
      expect(layer('community-notes').points).toHaveLength(2),
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
      expect(layer('community-notes').points).toHaveLength(2),
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

    expect(layer('community-notes').points).toHaveLength(2);
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

    clickCommunityNotePoint({
      id: 'note-1',
      content: 'Stored map note',
      pubkey: 'validation-pubkey',
      created_at: 1700000000,
      kind: 30398,
      tags: JSON.stringify([['l', '8FVC9G8F+5W', 'open-location-code']]),
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

  it('reports visible community note threads from visibility-filtered map features', async () => {
    vi.useFakeTimers();
    const onVisibleCommunityNoteThreadsChange = vi.fn();
    const onVisibleMapCountsChange = vi.fn();
    const visiblePlusCode = '8FVC9G8F+5W';
    const outsidePlusCode = '7FG49Q00+';
    const visibleArea = new OpenLocationCode().decode(visiblePlusCode);
    mockBounds = {
      northEast: {
        lat: visibleArea.latitudeCenter + 0.01,
        lng: visibleArea.longitudeCenter + 0.01,
      },
      southWest: {
        lat: visibleArea.latitudeCenter - 0.01,
        lng: visibleArea.longitudeCenter - 0.01,
      },
    };
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
      onVisibleMapCountsChange,
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
    expect(onVisibleMapCountsChange).toHaveBeenLastCalledWith({
      host: 0,
      meet: 0,
      communityNotes: 1,
    });
    expect(layer('community-notes').points).toHaveLength(3);
    vi.useRealTimers();
  });

  it('excludes community notes outside a viewport that crosses the dateline', async () => {
    vi.useFakeTimers();
    const onVisibleCommunityNoteThreadsChange = vi.fn();
    const olc = new OpenLocationCode() as OpenLocationCodeRuntime;
    const eastPlusCode = olc.encode(0, 179, 10);
    const westPlusCode = olc.encode(0, -179, 10);
    const middlePlusCode = olc.encode(0, 0, 10);
    mockBounds = DATELINE_BOUNDS;
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

    clickCommunityNotePoint({
      id: 'note-from-feature',
      content: 'Feature-only note',
      pubkey: 'author-pubkey',
      authorPubkey: 'author-pubkey',
      created_at: 1700000000,
      kind: 30397,
      tags: JSON.stringify([['l', '8FVC9G8F+5W', 'open-location-code']]),
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
    const onCommunityNoteOpen = vi.fn();

    renderCommunityNotesMap({
      onCommunityNoteOpen,
    });

    clickCommunityNotePoint({
      id: 'note-without-code',
      content: 'No code here',
      pubkey: 'author-pubkey',
      created_at: 1700000000,
      kind: 30397,
      tags: [],
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
    renderCommunityNotesMapWithoutOpenHandler();

    expect(() => {
      clickCommunityNotePoint({
        tags: [['l', '8FVC9G8F+5W', 'open-location-code']],
      });
    }).not.toThrow();
  });

  it('zooms in when a community note cluster is clicked', async () => {
    renderCommunityNotesMap();

    clickCommunityNoteCluster([13, 52]);
    await flushPromises();

    expect(mapView()).toEqual({ latitude: 52, longitude: 13, zoom: 5 });
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
    mockCluster.leaves.mockResolvedValue([
      makeLeaf('note-older', 'Older note', 1700000000),
      makeLeaf('note-newer', 'Newer note', 1700000100),
    ]);

    renderCommunityNotesMap({
      onCommunityNoteOpen,
    });

    clickCommunityNoteCluster();
    await flushPromises();

    expect(mockCluster.leaves).toHaveBeenCalled();
    expect(onCommunityNoteOpen).toHaveBeenCalledWith({
      notes: [
        expect.objectContaining({ id: 'note-older', content: 'Older note' }),
        expect.objectContaining({ id: 'note-newer', content: 'Newer note' }),
      ],
      plusCode: '9F350000+',
    });
    expect(mapView().zoom).toBe(2);
  });

  it('zooms Community Note clusters whose leaves have different locations', async () => {
    mockCluster.leaves.mockResolvedValue([
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

    clickCommunityNoteCluster();
    await flushPromises();

    expect(mapView().zoom).toBe(5);
  });

  it('falls back to zooming when cluster leaves cannot be read', async () => {
    mockCluster.leaves.mockRejectedValue(new Error('source unavailable'));

    renderCommunityNotesMap();

    clickCommunityNoteCluster();
    await flushPromises();

    expect(mapView().zoom).toBe(5);
  });

  it('does not require a note handler for overlapping Community Notes', async () => {
    mockCluster.leaves.mockResolvedValue([
      {
        properties: {
          tags: JSON.stringify([['l', '9F350000+', 'open-location-code']]),
        },
      },
    ]);
    renderCommunityNotesMapWithoutOpenHandler();

    clickCommunityNoteCluster();
    await flushPromises();
    expect(mockCluster.leaves).toHaveBeenCalled();
  });

  it('starts from the default location zoom when the persisted zoom is missing', async () => {
    mockPersistentMapLocation = {
      latitude: 48.6908333333,
      longitude: 9.14055555556,
    };

    renderCommunityNotesMap();

    clickCommunityNoteCluster([13, 52]);
    await flushPromises();

    expect(mapView().zoom).toBe(DEFAULT_LOCATION.zoom + 3);
  });
  it('expands a community-note cluster when viewing the whole world', async () => {
    mockPersistentMapLocation.zoom = 0;
    renderCommunityNotesMap();
    clickCommunityNoteCluster([13, 52]);
    await flushPromises();
    expect(mapView().zoom).toBe(5);
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
    expect(layer('offers').points).toEqual([]);

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
});
