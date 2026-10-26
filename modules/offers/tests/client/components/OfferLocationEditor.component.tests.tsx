import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import OfferLocationEditor from '@/modules/offers/client/components/OfferLocationEditor.component';
import type SearchPlaceInput from '@/modules/search/client/components/SearchPlaceInput.component';
import type { MapPoint } from '@/modules/search/client/utils/location';
import type { MapDefaultLocation } from '@/modules/core/client/utils/use-map-default-location';

let mockApproximateLocation: MapDefaultLocation | null = null;
const mockStopDefaultLocation = jest.fn();
jest.mock('@/modules/core/client/utils/use-map-default-location', () => ({
  __esModule: true,
  default: (enabled: boolean) => [
    enabled ? mockApproximateLocation : null,
    mockStopDefaultLocation,
  ],
}));
beforeEach(() => {
  mockApproximateLocation = null;
  mockStopDefaultLocation.mockClear();
});

type LocationChange = React.ComponentProps<
  typeof OfferLocationEditor
>['onLocationChange'];
type MockMapProps = {
  children?: React.ReactNode;
  height: number | string;
  location: [number, number];
  zoom: number;
  preferRaster: boolean;
  fallbackMarker?: { location: [number, number] };
  onLocationChange: (location: [number, number]) => void;
};

jest.mock(
  '@/modules/search/client/components/SearchPlaceInput.component',
  () => {
    function MockSearchPlaceInput({
      onPlaceSearch,
      setSearchQuery,
    }: React.ComponentProps<typeof SearchPlaceInput>) {
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('Paris');
              onPlaceSearch({ lat: 48.8566, lng: 2.3522 }, 'center');
            }}
          >
            Search places
          </button>
          <button
            type="button"
            onClick={() =>
              onPlaceSearch(
                {
                  northEast: { lat: 49, lng: 3 },
                  southWest: { lat: 48, lng: 2 },
                },
                'bounds',
              )
            }
          >
            Search bounds
          </button>
          <button
            type="button"
            onClick={() => onPlaceSearch({ lat: 0, lng: 0 }, 'center')}
          >
            Use my location
          </button>
          <button
            type="button"
            onClick={() =>
              // Deliberately incomplete external place data.
              onPlaceSearch({ lat: 0 } as MapPoint, 'center')
            }
          >
            Invalid place
          </button>
        </>
      );
    }

    return MockSearchPlaceInput;
  },
);
jest.mock('@/modules/core/client/components/Map/index', () => {
  function MockMap({
    children,
    height,
    location,
    zoom,
    preferRaster,
    fallbackMarker,
    onLocationChange,
  }: MockMapProps) {
    return (
      <div
        data-testid="offer-map"
        data-height={height}
        data-renderer={preferRaster ? 'raster' : 'webgl'}
        data-location={location.join(',')}
        data-zoom={zoom}
      >
        <button
          type="button"
          onClick={() => onLocationChange([48.6908333333, 9.14055555556])}
        >
          Report initial centre
        </button>
        <button
          type="button"
          onClick={() => onLocationChange([48.690834, 9.140556])}
        >
          Drag near default
        </button>
        <button type="button" onClick={() => onLocationChange([50, 10])}>
          Drag map
        </button>
        <button
          type="button"
          onClick={() => onLocationChange([48.6908333333, 10])}
        >
          Drag map east
        </button>
        <button type="button" onClick={() => onLocationChange([48.85, 2.35])}>
          Click map
        </button>
        <button
          type="button"
          onClick={() => onLocationChange([48.6908333333, 9.14055555556])}
        >
          Click initial centre
        </button>
        {fallbackMarker && (
          <span>Marker at {fallbackMarker.location.join(',')}</span>
        )}
        {children}
      </div>
    );
  }

  return MockMap;
});
jest.mock('@/modules/offers/client/components/OfferLocationOverlay', () => ({
  __esModule: true,
  default: () => <div data-testid="location-overlay" />,
}));

describe('OfferLocationEditor', () => {
  it('centres new offers approximately without choosing a location', () => {
    mockApproximateLocation = { latitude: 34, longitude: -17, zoom: 5 };
    const onLocationChange = jest.fn();
    render(
      <OfferLocationEditor
        location={null}
        onLocationChange={onLocationChange}
      />,
    );
    expect(screen.getByTestId('offer-map')).toHaveAttribute(
      'data-location',
      '34,-17',
    );
    expect(screen.getByTestId('offer-map')).toHaveAttribute('data-zoom', '5');
    expect(screen.queryByText(/Marker at/)).not.toBeInTheDocument();
    expect(onLocationChange).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Data credits' })).toHaveAttribute(
      'href',
      '/credits',
    );
    fireEvent.wheel(screen.getByTestId('offer-map'));
    expect(mockStopDefaultLocation).toHaveBeenCalled();
  });

  it('keeps existing offer coordinates ahead of approximate defaults', () => {
    mockApproximateLocation = { latitude: 34, longitude: -17, zoom: 5 };
    render(
      <OfferLocationEditor location={[12, 23]} onLocationChange={jest.fn()} />,
    );
    expect(screen.getByTestId('offer-map')).toHaveAttribute(
      'data-location',
      '12,23',
    );
    expect(screen.getByTestId('offer-map')).toHaveAttribute('data-zoom', '13');
  });
  it('shows a map without an offer marker before a location is chosen', () => {
    render(
      <OfferLocationEditor location={null} onLocationChange={jest.fn()} />,
    );

    expect(screen.getByTestId('offer-map')).toBeInTheDocument();
    expect(screen.getByTestId('offer-map')).toHaveAttribute(
      'data-renderer',
      'raster',
    );
    expect(screen.getByTestId('offer-map')).toHaveAttribute(
      'data-height',
      '100%',
    );
    expect(screen.queryByText(/Marker at/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('location-overlay')).not.toBeInTheDocument();
  });

  it('waits for a place search or map movement before choosing a location', () => {
    const onLocationChange = jest.fn();
    render(
      <OfferLocationEditor
        location={null}
        onLocationChange={onLocationChange}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Report initial centre' }),
    );
    expect(onLocationChange).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: 'Click initial centre' }),
    );
    expect(onLocationChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Drag near default' }));
    expect(onLocationChange).toHaveBeenCalledWith([48.690834, 9.140556]);

    fireEvent.click(screen.getByRole('button', { name: 'Drag map' }));
    expect(onLocationChange).toHaveBeenCalledWith([50, 10]);

    fireEvent.click(screen.getByRole('button', { name: 'Drag map east' }));
    expect(onLocationChange).toHaveBeenCalledWith([48.6908333333, 10]);
  });

  it('renders the map and location guidance', () => {
    render(
      <OfferLocationEditor
        location={[51.5, -0.12]}
        offerStatus="yes"
        offerType="host"
        onLocationChange={jest.fn()}
      />,
    );

    expect(
      screen.getByText(
        /Zoom in, then click or drag the map below to place the marker/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('offer-map')).toBeInTheDocument();
    expect(screen.getByTestId('location-overlay')).toBeInTheDocument();
  });

  it('updates the location when a place is searched', () => {
    const onLocationChange = jest.fn<
      ReturnType<LocationChange>,
      Parameters<LocationChange>
    >();

    render(
      <OfferLocationEditor
        location={[51.5, -0.12]}
        offerType="host"
        onLocationChange={onLocationChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Search places' }));

    expect(onLocationChange).toHaveBeenCalledWith([48.8566, 2.3522]);
  });

  it('accepts zero coordinates from device location', () => {
    const onLocationChange = jest.fn();
    render(
      <OfferLocationEditor
        location={null}
        onLocationChange={onLocationChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));

    expect(onLocationChange).toHaveBeenCalledWith([0, 0]);
  });

  it('updates the location when the map is clicked', () => {
    const onLocationChange = jest.fn<
      ReturnType<LocationChange>,
      Parameters<LocationChange>
    >();

    render(
      <OfferLocationEditor
        location={[51.5, -0.12]}
        offerType="meet"
        onLocationChange={onLocationChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Click map' }));

    expect(onLocationChange).toHaveBeenCalledWith([48.85, 2.35]);

    fireEvent.click(
      screen.getByRole('button', { name: 'Report initial centre' }),
    );
    expect(onLocationChange).toHaveBeenCalledWith([
      48.6908333333, 9.14055555556,
    ]);
  });

  it('updates the location when a place bounds search completes', () => {
    const onLocationChange = jest.fn<
      ReturnType<LocationChange>,
      Parameters<LocationChange>
    >();

    render(
      <OfferLocationEditor
        location={[51.5, -0.12]}
        offerType="meet"
        onLocationChange={onLocationChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Search bounds' }));

    expect(onLocationChange).toHaveBeenCalledWith([48.5, 2.5]);
  });

  it('ignores incomplete place results', () => {
    const onLocationChange = jest.fn<
      ReturnType<LocationChange>,
      Parameters<LocationChange>
    >();

    render(
      <OfferLocationEditor
        location={[51.5, -0.12]}
        onLocationChange={onLocationChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Invalid place' }));
    expect(onLocationChange).not.toHaveBeenCalled();
  });
});
