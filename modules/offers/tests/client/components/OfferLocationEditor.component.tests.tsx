import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import OfferLocationEditor from '@/modules/offers/client/components/OfferLocationEditor.component';
import type SearchPlaceInput from '@/modules/core/client/components/SearchPlaceInput.component';
import type { MapPoint } from '@/modules/core/client/utils/location';
import type { MapDefaultLocation } from '@/modules/core/client/utils/use-map-default-location';
import type {
  MapBounds,
  MapProps,
} from '@/modules/core/client/components/Map/types';

let mockApproximateLocation: MapDefaultLocation | null = null;
const mockStopDefaultLocation = vi.fn();
const mockMapView = vi.fn<(view: MapProps['view']) => void>();
vi.mock('@/modules/core/client/utils/use-map-default-location', () => ({
  __esModule: true,
  default: (enabled: boolean) => [
    enabled ? mockApproximateLocation : null,
    mockStopDefaultLocation,
  ],
}));
vi.mock('@/modules/core/client/components/DeviceLocationButton', () => ({
  __esModule: true,
  default: ({
    onLocation,
    onApproximateLocation,
    onRequest,
    showFeedback,
  }: {
    onLocation: (location: { lat: number; lng: number }) => void;
    onApproximateLocation?: (location: MapDefaultLocation) => void;
    onRequest: () => void;
    showFeedback: boolean;
  }) => (
    <>
      <button type="button" onClick={() => onLocation({ lat: 0, lng: 0 })}>
        Use my location
      </button>
      <button
        type="button"
        onClick={() => {
          onRequest();
          onApproximateLocation?.({ latitude: 12, longitude: 23, zoom: 5 });
        }}
      >
        Use approximate location
      </button>
      <button type="button" onClick={onRequest}>
        Start location request
      </button>
      <button
        type="button"
        onClick={() =>
          onApproximateLocation?.({ latitude: 24, longitude: 36, zoom: 4 })
        }
      >
        Complete location request
      </button>
      {showFeedback && <span role="status">Location feedback</span>}
    </>
  ),
}));
beforeEach(() => {
  mockApproximateLocation = null;
  mockStopDefaultLocation.mockClear();
  mockMapView.mockClear();
});

type LocationChange = React.ComponentProps<
  typeof OfferLocationEditor
>['onLocationChange'];
vi.mock('@/modules/core/client/components/SearchPlaceInput.component', () => {
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

  return { default: MockSearchPlaceInput };
});
vi.mock('@/modules/core/client/components/Map/index', () => ({
  default: function MockMap({ view, onClick, onMoveEnd, area }: MapProps) {
    mockMapView(view);
    const drag = (latitude: number, longitude: number, dragged = true) =>
      onMoveEnd?.(
        { latitude, longitude, zoom: view.zoom },
        {} as MapBounds,
        dragged,
      );
    return (
      <div
        data-testid="offer-map"
        data-location={`${view.latitude},${view.longitude}`}
        data-zoom={view.zoom}
        data-area={area ? `${area.latitude},${area.longitude}` : undefined}
      >
        <button
          type="button"
          onClick={() => drag(48.6908333333, 9.14055555556)}
        >
          Report initial centre
        </button>
        <button type="button" onClick={() => drag(48.690834, 9.140556)}>
          Drag near default
        </button>
        <button type="button" onClick={() => drag(50, 10)}>
          Drag map
        </button>
        <button type="button" onClick={() => drag(50, 10, false)}>
          Zoom map
        </button>
        <button type="button" onClick={() => drag(48.6908333333, 10)}>
          Drag map east
        </button>
        <button type="button" onClick={() => onClick?.([48.85, 2.35])}>
          Click map
        </button>
        <button
          type="button"
          onClick={() => onClick?.([48.6908333333, 9.14055555556])}
        >
          Click initial centre
        </button>
      </div>
    );
  },
}));

describe('OfferLocationEditor', () => {
  it('centres new offers approximately without choosing a location', async () => {
    mockApproximateLocation = { latitude: 34, longitude: -17, zoom: 5 };
    const onLocationChange = vi.fn();
    render(
      <OfferLocationEditor
        location={null}
        onLocationChange={onLocationChange}
      />,
    );
    expect(await screen.findByTestId('offer-map')).toHaveAttribute(
      'data-location',
      '34,-17',
    );
    expect(screen.getByTestId('offer-map')).toHaveAttribute('data-zoom', '5');
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
      <OfferLocationEditor location={[12, 23]} onLocationChange={vi.fn()} />,
    );
    expect(screen.getByTestId('offer-map')).toHaveAttribute(
      'data-location',
      '12,23',
    );
    expect(screen.getByTestId('offer-map')).toHaveAttribute('data-zoom', '13');
  });
  it('centres approximately without changing the chosen offer location', () => {
    const onLocationChange = vi.fn();
    render(
      <OfferLocationEditor
        location={[40, -70]}
        onLocationChange={onLocationChange}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Use approximate location' }),
    );

    expect(screen.getByTestId('offer-map')).toHaveAttribute(
      'data-location',
      '12,23',
    );
    expect(screen.getByTestId('offer-map')).toHaveAttribute('data-zoom', '5');
    expect(screen.getByTestId('offer-map')).not.toHaveAttribute('data-area');
    expect(onLocationChange).not.toHaveBeenCalled();
  });
  it('dismisses map guidance on navigation and ignores late device responses after a gesture', () => {
    mockApproximateLocation = { latitude: 34, longitude: -17, zoom: 5 };
    const onLocationChange = vi.fn();
    render(
      <OfferLocationEditor
        location={null}
        onLocationChange={onLocationChange}
        showHostingGuide
      />,
    );
    const map = screen.getByTestId('offer-map');
    const initialCentre = mockMapView.mock.lastCall?.[0];
    fireEvent.keyDown(map, { key: 'Tab' });
    expect(screen.getByRole('note')).toHaveTextContent(
      'Set your hosting location on the map.',
    );
    fireEvent.keyDown(map, { key: '+' });
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(mockMapView.mock.lastCall?.[0]).toBe(initialCentre);

    fireEvent.click(
      screen.getByRole('button', { name: 'Start location request' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Location feedback');
    fireEvent.pointerDown(map);
    fireEvent.click(
      screen.getByRole('button', { name: 'Complete location request' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(map).toHaveAttribute('data-location', '34,-17');
    expect(onLocationChange).not.toHaveBeenCalled();
  });

  it('keeps the requested zoom after the first map selection', () => {
    mockApproximateLocation = { latitude: 34, longitude: -17, zoom: 5 };
    function Editor() {
      const [location, setLocation] = React.useState<[number, number] | null>(
        null,
      );
      return (
        <OfferLocationEditor
          location={location}
          onLocationChange={setLocation}
        />
      );
    }

    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: 'Drag map' }));

    const map = screen.getByTestId('offer-map');
    expect(map).toHaveAttribute('data-location', '50,10');
    expect(map).toHaveAttribute('data-zoom', '5');
  });

  it('shows a map without an offer marker before a location is chosen', () => {
    render(<OfferLocationEditor location={null} onLocationChange={vi.fn()} />);

    expect(screen.getByTestId('offer-map')).not.toHaveAttribute('data-area');
  });

  it('waits for a place search or map movement before choosing a location', () => {
    const onLocationChange = vi.fn();
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

    fireEvent.click(screen.getByRole('button', { name: 'Zoom map' }));
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
        onLocationChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        /Zoom in, then click or drag the map to place the marker/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('offer-map')).toHaveAttribute(
      'data-area',
      '51.5,-0.12',
    );
  });

  it('updates the location when a place is searched', () => {
    const onLocationChange =
      vi.fn<
        (...args: Parameters<LocationChange>) => ReturnType<LocationChange>
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
    const onLocationChange = vi.fn();
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
    const onLocationChange =
      vi.fn<
        (...args: Parameters<LocationChange>) => ReturnType<LocationChange>
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
    const onLocationChange =
      vi.fn<
        (...args: Parameters<LocationChange>) => ReturnType<LocationChange>
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
    const onLocationChange =
      vi.fn<
        (...args: Parameters<LocationChange>) => ReturnType<LocationChange>
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
