import type { Mock } from 'vitest';
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import L from 'leaflet';

import LeafletSearchMap from '@/modules/search/client/components/LeafletSearchMap';
type LeafletSearchMapProps = React.ComponentProps<typeof LeafletSearchMap>;

type TestPoint = {
  geometry: { coordinates: [number, number]; type: 'Point' };
  id?: string | number;
  properties: Record<string, unknown>;
  type: 'Feature';
};
type TestEvent = { originalEvent?: object };
type TestHandler = (event?: TestEvent) => void;
type MockMarker = {
  location: unknown;
  on: Mock<(...args: [name: string, handler: TestHandler]) => MockMarker>;
  handlers: Record<string, TestHandler>;
  options: Record<string, unknown>;
};
type MockLayerGroup = {
  addLayer: Mock;
  addTo: Mock<(...args: []) => MockLayerGroup>;
  clearLayers: Mock;
};
type MockCluster = {
  getClusterExpansionZoom: Mock<(...args: [clusterId: number]) => number>;
  getClusters: Mock<(...args: []) => TestPoint[]>;
  load: Mock<(...args: [features: TestPoint[]]) => MockCluster>;
};

const mockMapHandlers: Record<string, TestHandler> = {};
const mockMap = {
  getBounds: vi.fn(),
  getCenter: vi.fn(),
  getZoom: vi.fn(),
  fitBounds: vi.fn(),
  invalidateSize: vi.fn(),
  on: vi.fn((name: string, handler: TestHandler) => {
    mockMapHandlers[name] = handler;
  }),
  remove: vi.fn(),
  setView: vi.fn(),
};
mockMap.setView.mockImplementation(() => mockMap);
const mockLayerGroups: MockLayerGroup[] = [];
const mockMarkers: MockMarker[] = [];
const mockCircleMarkers: MockMarker[] = [];
const mockClusterResults: TestPoint[][] = [];
const mockClusterInstances: MockCluster[] = [];

vi.mock('leaflet', () => ({
  default: {
    DomEvent: { stopPropagation: vi.fn() },
    circleMarker: vi.fn(
      (location: unknown, options: Record<string, unknown>) => {
        const marker: MockMarker = {
          location,
          on: vi.fn<(...args: [string, TestHandler]) => MockMarker>(),
          handlers: {},
          options,
        };
        marker.on.mockImplementation((name, handler) => {
          marker.handlers[name] = handler;
          return marker;
        });
        mockCircleMarkers.push(marker);
        return marker;
      },
    ),
    control: {
      zoom: vi.fn(() => ({ addTo: vi.fn() })),
    },
    divIcon: vi.fn(options => options),
    layerGroup: vi.fn(() => {
      const group: MockLayerGroup = {
        addLayer: vi.fn(),
        addTo: vi.fn<(...args: []) => MockLayerGroup>(),
        clearLayers: vi.fn(),
      };
      group.addTo.mockReturnValue(group);
      mockLayerGroups.push(group);
      return group;
    }),
    map: vi.fn(() => mockMap),
    marker: vi.fn((location: unknown, options: Record<string, unknown>) => {
      const marker: MockMarker = {
        location,
        on: vi.fn<(...args: [string, TestHandler]) => MockMarker>(),
        handlers: {},
        options,
      };
      marker.on.mockImplementation((name, handler) => {
        marker.handlers[name] = handler;
        return marker;
      });
      mockMarkers.push(marker);
      return marker;
    }),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
  },
}));

vi.mock('supercluster', () => ({
  default: vi.fn().mockImplementation(function () {
    const result = mockClusterResults[mockClusterInstances.length] || [];
    const instance: MockCluster = {
      getClusterExpansionZoom: vi.fn<(...args: [number]) => number>(() => 10),
      getClusters: vi.fn<(...args: []) => TestPoint[]>(() => result),
      load: vi.fn<(...args: [TestPoint[]]) => MockCluster>(),
    };
    instance.load.mockReturnValue(instance);
    mockClusterInstances.push(instance);
    return instance;
  }),
}));

const bounds = {
  getEast: () => 14,
  getNorth: () => 53,
  getNorthEast: () => ({ lat: 53, lng: 14 }),
  getSouth: () => 51,
  getSouthWest: () => ({ lat: 51, lng: 12 }),
  getWest: () => 12,
};
const viewport = { latitude: 52, longitude: 13, zoom: 6 };

function point(
  id: string | number | undefined,
  properties: Record<string, unknown> = {},
): TestPoint {
  return {
    geometry: { coordinates: [13, 52], type: 'Point' },
    id,
    properties,
    type: 'Feature',
  };
}

function cluster(): TestPoint {
  return {
    geometry: { coordinates: [13, 52], type: 'Point' },
    properties: {
      cluster: true,
      cluster_id: 42,
      point_count: 3,
      point_count_abbreviated: 3,
    },
    type: 'Feature',
  };
}

function pointCollection(
  features: TestPoint[],
): LeafletSearchMapProps['offers'] {
  // Note fixtures intentionally rely on the top-level id without a property id.
  return {
    features: features.map(feature => ({
      ...feature,
      properties: { id: '', ...feature.properties },
    })),
  };
}

function renderMap(props: Partial<LeafletSearchMapProps> = {}) {
  return render(
    <LeafletSearchMap
      communityNotes={{ features: [] }}
      offers={{ features: [] }}
      onCommunityNoteClick={vi.fn()}
      onMapChange={vi.fn()}
      onMapClick={vi.fn()}
      onOfferClick={vi.fn()}
      viewport={viewport}
      {...props}
    />,
  );
}

beforeEach(() => {
  Object.keys(mockMapHandlers).forEach(key => delete mockMapHandlers[key]);
  mockLayerGroups.length = 0;
  mockMarkers.length = 0;
  mockCircleMarkers.length = 0;
  mockClusterResults.length = 0;
  mockClusterInstances.length = 0;
  mockMap.getBounds.mockReturnValue(bounds);
  mockMap.getCenter.mockReturnValue({ lat: 52, lng: 13 });
  mockMap.getZoom.mockReturnValue(6);
  mockMap.fitBounds.mockClear();
  mockMap.invalidateSize.mockClear();
  mockMap.setView.mockClear();
  mockMap.remove.mockClear();
  mockMap.on.mockClear();
  vi.mocked(L.DomEvent.stopPropagation).mockClear();
  vi.mocked(L.tileLayer).mockClear();
  vi.mocked(L.map).mockClear();
  vi.mocked(L.control.zoom).mockClear();
});

describe('<LeafletSearchMap />', () => {
  it('renders clustered offers and Community Notes with their actions', () => {
    const onMapChange = vi.fn();
    const onMapClick = vi.fn();
    const onOfferClick = vi.fn();
    const onCommunityNoteClick = vi.fn();
    mockClusterResults.push(
      [cluster(), point(undefined, { id: 'offer-1', offer: 'host-yes' })],
      [point('note-1', { verified: true })],
    );

    renderMap({
      communityNotes: pointCollection([point('note-1', { verified: true })]),
      offers: pointCollection([
        point(undefined, { id: 'offer-1', offer: 'host-yes' }),
      ]),
      onCommunityNoteClick,
      onMapChange,
      onMapClick,
      onOfferClick,
    });

    expect(L.map).toHaveBeenCalledWith(expect.any(HTMLDivElement), {
      zoomControl: false,
    });
    expect(L.control.zoom).toHaveBeenCalledWith({ position: 'topright' });
    expect(L.tileLayer).toHaveBeenCalledWith(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      expect.objectContaining({ maxZoom: 19 }),
    );
    expect(onMapChange).toHaveBeenCalledWith(
      {
        bounds: {
          northEast: { lat: 53, lng: 14 },
          southWest: { lat: 51, lng: 12 },
        },
        latitude: 52,
        longitude: 13,
        zoom: 6,
      },
      false,
    );
    expect(mockMarkers).toHaveLength(1);
    expect(mockCircleMarkers).toHaveLength(2);
    expect(mockMarkers[0].options.bubblingMouseEvents).toBe(false);
    expect(
      mockCircleMarkers.every(
        marker => marker.options.bubblingMouseEvents === false,
      ),
    ).toBe(true);

    mockMapHandlers.click();
    expect(onMapClick).toHaveBeenCalledTimes(1);

    mockMarkers[0].handlers.click({ originalEvent: {} });
    expect(
      mockClusterInstances[0].getClusterExpansionZoom,
    ).toHaveBeenCalledWith(42);
    expect(mockMap.setView).toHaveBeenCalledWith([52, 13], 10);

    mockCircleMarkers[0].handlers.click({ originalEvent: {} });
    expect(onOfferClick).toHaveBeenCalledWith('offer-1');
    mockCircleMarkers[1].handlers.click({ originalEvent: {} });
    expect(onCommunityNoteClick).toHaveBeenCalledWith(
      point('note-1', { verified: true }),
    );
    expect(L.DomEvent.stopPropagation).toHaveBeenCalledTimes(3);
  });

  it('updates the map from an externally changed viewport and removes it', async () => {
    const { rerender, unmount } = renderMap();
    mockMap.getCenter.mockReturnValue({ lat: 52, lng: 13 });
    mockMap.getZoom.mockReturnValue(6);

    rerender(
      <LeafletSearchMap
        communityNotes={{ features: [] }}
        offers={{ features: [] }}
        onCommunityNoteClick={vi.fn()}
        onMapChange={vi.fn()}
        onMapClick={vi.fn()}
        onOfferClick={vi.fn()}
        viewport={{ latitude: 53, longitude: 14, zoom: 7 }}
      />,
    );

    expect(mockMap.setView).toHaveBeenCalledWith([53, 14], 7);

    await waitFor(() =>
      expect(mockMap.invalidateSize).toHaveBeenCalledWith({ pan: false }),
    );

    unmount();
    expect(mockMap.remove).toHaveBeenCalledTimes(1);
  });

  it('marks explicit place fits separately from initialisation and later resizing', () => {
    const onMapChange = vi.fn();
    renderMap({
      bounds: {
        northEast: { lat: 53, lng: 14 },
        southWest: { lat: 51, lng: 12 },
      },
      onMapChange,
    });
    expect(onMapChange).toHaveBeenLastCalledWith(expect.any(Object), false);
    act(() => mockMapHandlers.moveend());
    expect(onMapChange).toHaveBeenLastCalledWith(expect.any(Object), true);
    act(() => mockMapHandlers.moveend());
    expect(onMapChange).toHaveBeenLastCalledWith(expect.any(Object), false);
  });

  it('refits selected bounds after mobile layout settles', () => {
    vi.useFakeTimers();
    const selectedBounds = {
      northEast: { lat: 52.6755, lng: 13.7611 },
      southWest: { lat: 52.3383, lng: 13.0884 },
    };

    const { rerender, unmount } = renderMap({ bounds: selectedBounds });

    expect(mockMap.invalidateSize).toHaveBeenCalledWith({ pan: false });
    expect(mockMap.fitBounds).toHaveBeenCalledWith(
      [
        [52.3383, 13.0884],
        [52.6755, 13.7611],
      ],
      { padding: [40, 40] },
    );
    expect(mockMap.fitBounds).toHaveBeenCalledTimes(1);

    rerender(
      <LeafletSearchMap
        bounds={selectedBounds}
        communityNotes={{ features: [] }}
        offers={{ features: [] }}
        onCommunityNoteClick={vi.fn()}
        onMapChange={vi.fn()}
        onMapClick={vi.fn()}
        onOfferClick={vi.fn()}
        viewport={{ latitude: 40, longitude: -74, zoom: 4 }}
      />,
    );
    expect(mockMap.setView).not.toHaveBeenCalledWith([40, -74], 4);

    act(() => vi.runOnlyPendingTimers());
    expect(mockMap.fitBounds).toHaveBeenCalledTimes(3);

    unmount();
    vi.useRealTimers();
  });

  it('does not refit selected bounds after map interaction starts', () => {
    vi.useFakeTimers();
    const selectedBounds = {
      northEast: { lat: 52.6755, lng: 13.7611 },
      southWest: { lat: 52.3383, lng: 13.0884 },
    };

    const { getByTestId, unmount } = renderMap({ bounds: selectedBounds });
    expect(mockMap.fitBounds).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(getByTestId('leaflet-search-map'));
    act(() => vi.runOnlyPendingTimers());

    expect(mockMap.fitBounds).toHaveBeenCalledTimes(1);
    unmount();
    vi.useRealTimers();
  });

  it('does not render markers while the map is zoomed out', () => {
    mockClusterResults.push([point('offer-1')], [point('note-1')]);

    renderMap({
      communityNotes: pointCollection([point('note-1')]),
      offers: pointCollection([point('offer-1')]),
      viewport: { ...viewport, zoom: 2 },
    });

    expect(mockMarkers).toHaveLength(0);
    expect(mockCircleMarkers).toHaveLength(0);
    expect(mockLayerGroups[0].clearLayers).toHaveBeenCalledTimes(1);
    expect(mockLayerGroups[1].clearLayers).toHaveBeenCalledTimes(1);
  });

  it('uses fallback colours for unknown offers and Community Notes', () => {
    mockClusterResults.push(
      [point('offer-1', { offer: 'unknown' })],
      [point('note-1', { verified: false })],
    );

    renderMap({
      communityNotes: pointCollection([point('note-1', { verified: false })]),
      offers: pointCollection([point('offer-1', { offer: 'unknown' })]),
    });

    expect(mockCircleMarkers[0].options.fillColor).toBe('#ccc');
    expect(mockCircleMarkers[1].options.fillColor).toBe('#1565C0');
    expect(() => mockCircleMarkers[0].handlers.click({})).not.toThrow();
  });
});
