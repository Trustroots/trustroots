import React from 'react';
import { render, waitFor } from '@testing-library/react';
import L from 'leaflet';

import LeafletSearchMap from '@/modules/search/client/components/LeafletSearchMap';

const mockMapHandlers = {};
const mockMap = {
  getBounds: jest.fn(),
  getCenter: jest.fn(),
  getZoom: jest.fn(),
  invalidateSize: jest.fn(),
  on: jest.fn((name, handler) => {
    mockMapHandlers[name] = handler;
  }),
  remove: jest.fn(),
  setView: jest.fn(),
};
mockMap.setView.mockImplementation(() => mockMap);
const mockLayerGroups = [];
const mockMarkers = [];
const mockCircleMarkers = [];
const mockClusterResults = [];
const mockClusterInstances = [];

jest.mock('leaflet', () => ({
  DomEvent: { stopPropagation: jest.fn() },
  circleMarker: jest.fn((location, options) => {
    const marker = {
      location,
      on: jest.fn((name, handler) => {
        marker.handlers[name] = handler;
        return marker;
      }),
      handlers: {},
      options,
    };
    mockCircleMarkers.push(marker);
    return marker;
  }),
  divIcon: jest.fn(options => options),
  layerGroup: jest.fn(() => {
    const group = {
      addLayer: jest.fn(),
      addTo: jest.fn(() => group),
      clearLayers: jest.fn(),
    };
    mockLayerGroups.push(group);
    return group;
  }),
  map: jest.fn(() => mockMap),
  marker: jest.fn((location, options) => {
    const marker = {
      location,
      on: jest.fn((name, handler) => {
        marker.handlers[name] = handler;
        return marker;
      }),
      handlers: {},
      options,
    };
    mockMarkers.push(marker);
    return marker;
  }),
  tileLayer: jest.fn(() => ({ addTo: jest.fn() })),
}));

jest.mock('supercluster', () =>
  jest.fn().mockImplementation(() => {
    const result = mockClusterResults[mockClusterInstances.length] || [];
    const instance = {
      getClusterExpansionZoom: jest.fn(() => 10),
      getClusters: jest.fn(() => result),
      load: jest.fn(),
    };
    instance.load.mockReturnValue(instance);
    mockClusterInstances.push(instance);
    return instance;
  }),
);

const bounds = {
  getEast: () => 14,
  getNorth: () => 53,
  getNorthEast: () => ({ lat: 53, lng: 14 }),
  getSouth: () => 51,
  getSouthWest: () => ({ lat: 51, lng: 12 }),
  getWest: () => 12,
};
const viewport = { latitude: 52, longitude: 13, zoom: 6 };

function point(id, properties = {}) {
  return {
    geometry: { coordinates: [13, 52], type: 'Point' },
    id,
    properties,
    type: 'Feature',
  };
}

function cluster() {
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

function renderMap(props = {}) {
  return render(
    <LeafletSearchMap
      communityNotes={{ features: [] }}
      offers={{ features: [] }}
      onCommunityNoteClick={jest.fn()}
      onMapChange={jest.fn()}
      onMapClick={jest.fn()}
      onOfferClick={jest.fn()}
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
  mockMap.invalidateSize.mockClear();
  mockMap.setView.mockClear();
  mockMap.remove.mockClear();
  mockMap.on.mockClear();
  L.DomEvent.stopPropagation.mockClear();
  L.tileLayer.mockClear();
  L.map.mockClear();
});

describe('<LeafletSearchMap />', () => {
  it('renders clustered offers and Community Notes with their actions', () => {
    const onMapChange = jest.fn();
    const onMapClick = jest.fn();
    const onOfferClick = jest.fn();
    const onCommunityNoteClick = jest.fn();
    mockClusterResults.push(
      [cluster(), point(undefined, { id: 'offer-1', offer: 'host-yes' })],
      [point('note-1', { verified: true })],
    );

    renderMap({
      communityNotes: { features: [point('note-1', { verified: true })] },
      offers: {
        features: [point(undefined, { id: 'offer-1', offer: 'host-yes' })],
      },
      onCommunityNoteClick,
      onMapChange,
      onMapClick,
      onOfferClick,
    });

    expect(L.map).toHaveBeenCalledWith(expect.any(HTMLDivElement), {
      zoomControl: true,
    });
    expect(L.tileLayer).toHaveBeenCalledWith(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      expect.objectContaining({ maxZoom: 19 }),
    );
    expect(onMapChange).toHaveBeenCalledWith({
      bounds: {
        northEast: { lat: 53, lng: 14 },
        southWest: { lat: 51, lng: 12 },
      },
      latitude: 52,
      longitude: 13,
      zoom: 6,
    });
    expect(mockMarkers).toHaveLength(1);
    expect(mockCircleMarkers).toHaveLength(2);

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
        onCommunityNoteClick={jest.fn()}
        onMapChange={jest.fn()}
        onMapClick={jest.fn()}
        onOfferClick={jest.fn()}
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

  it('does not render markers while the map is zoomed out', () => {
    mockClusterResults.push([point('offer-1')], [point('note-1')]);

    renderMap({
      communityNotes: { features: [point('note-1')] },
      offers: { features: [point('offer-1')] },
      viewport: { ...viewport, zoom: 2 },
    });

    expect(mockMarkers).toHaveLength(0);
    expect(mockCircleMarkers).toHaveLength(0);
    expect(mockLayerGroups[0].clearLayers).toHaveBeenCalledTimes(1);
    expect(mockLayerGroups[1].clearLayers).toHaveBeenCalledTimes(1);
  });

  it('uses fallback colours for unknown offers and unverified notes', () => {
    mockClusterResults.push(
      [point('offer-1', { offer: 'unknown' })],
      [point('note-1', { verified: false })],
    );

    renderMap({
      communityNotes: { features: [point('note-1', { verified: false })] },
      offers: { features: [point('offer-1', { offer: 'unknown' })] },
    });

    expect(mockCircleMarkers[0].options.fillColor).toBe('#ccc');
    expect(mockCircleMarkers[1].options.fillColor).toBe('#1976D2');
    expect(() => mockCircleMarkers[0].handlers.click({})).not.toThrow();
  });
});
