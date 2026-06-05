import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import SearchMap from '@/modules/search/client/components/SearchMap.component';

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

const mockFitBounds = jest.fn();
const mockMap = {
  getBounds: jest.fn(),
  getFeatureState: jest.fn(),
  getZoom: jest.fn(),
  setFeatureState: jest.fn(),
};
let mockMapProps;
let mockSourceProps;
const mockSource = {
  getClusterExpansionZoom: jest.fn(),
};
jest.mock('react-map-gl', () => {
  const React = require('react');

  const MockReactMapGL = React.forwardRef(function MockReactMapGL(
    { children, ...props },
    ref,
  ) {
    mockMapProps = props;
    React.useImperativeHandle(ref, () => ({
      getMap: () => mockMap,
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
    React.useImperativeHandle(ref, () => ({
      getSource: () => mockSource,
    }));
    return React.createElement(
      'div',
      { 'data-testid': 'map-source' },
      children,
    );
  });
  Source.propTypes = {
    children: () => null,
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
  mockSource.getClusterExpansionZoom.mockImplementation((clusterId, done) =>
    done(null, 18),
  );
  mockGetOffer.mockResolvedValue({ _id: 'offer-1' });
  mockQueryOffers.mockResolvedValue({
    features: [],
    type: 'FeatureCollection',
  });
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

    renderSearchMap({
      isUserPublic: false,
      onOfferClose,
    });

    await waitFor(() => expect(onOfferClose).toHaveBeenCalledTimes(1));
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

  it('updates offer hover state and clears it when leaving the map', () => {
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

    expect(mockMap.setFeatureState).toHaveBeenLastCalledWith(
      { id: 'offer-1', source: 'offers' },
      {
        existing: true,
        hover: true,
      },
    );

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
});
