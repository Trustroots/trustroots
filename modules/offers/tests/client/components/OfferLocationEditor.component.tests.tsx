import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import OfferLocationEditor from '@/modules/offers/client/components/OfferLocationEditor.component';
import type SearchPlaceInput from '@/modules/search/client/components/SearchPlaceInput.component';
import type { MapPoint } from '@/modules/search/client/utils/location';

type LocationChange = React.ComponentProps<
  typeof OfferLocationEditor
>['onLocationChange'];
type MockMapProps = {
  children?: React.ReactNode;
  fallbackMarker?: { location: [number, number] };
  onClick: (event: { lngLat?: [number, number] }) => void;
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
  function MockMap({ children, fallbackMarker, onClick }: MockMapProps) {
    return (
      <div data-testid="offer-map">
        <button
          type="button"
          onClick={() => onClick({ lngLat: [2.35, 48.85] })}
        >
          Click map
        </button>
        <button type="button" onClick={() => onClick({})}>
          Empty map click
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
      screen.getByText(/Zoom in and drag the map below to place the marker/),
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

  it('ignores incomplete place and map results', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Empty map click' }));
    expect(onLocationChange).not.toHaveBeenCalled();
  });
});
