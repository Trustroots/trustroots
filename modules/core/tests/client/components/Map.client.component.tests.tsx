import React from 'react';
import { act, render, screen } from '@testing-library/react';

import Map from '@/modules/core/client/components/Map';

type MapProps = React.ComponentProps<typeof Map>;
type MapEvent<Handler extends keyof MapProps> = Parameters<
  NonNullable<MapProps[Handler]>
>[0];

const mockIsWebGLSupported = vi.fn<(...args: []) => boolean>();
vi.mock('@/modules/core/client/utils/map', () => ({
  isWebGLSupported: () => mockIsWebGLSupported(),
}));

const mockMapGL = vi.fn<(...args: [props: MapProps]) => void>();
vi.mock('@vis.gl/react-maplibre', () => ({
  __esModule: true,
  default: function MockMapGL(props: MapProps) {
    mockMapGL(props);
    return <div data-testid="react-map">{props.children}</div>;
  },
}));

vi.mock('@/modules/core/client/components/Map/MapNavigationControl', () => ({
  default: vi.fn(() => <div data-testid="map-navigation-control" />),
}));
vi.mock('@/modules/core/client/components/Map/MapScaleControl', () => ({
  default: vi.fn(() => <div data-testid="map-scale-control" />),
}));

function latestReactMapProps(): MapProps {
  const call = mockMapGL.mock.calls[mockMapGL.mock.calls.length - 1];
  if (!call) {
    throw new Error('Expected ReactMapGL to have rendered');
  }
  return call[0];
}

const viewState = { latitude: 51, longitude: 11, zoom: 15 };

function move(handler: 'onMove' | 'onMoveEnd', state = viewState) {
  act(() =>
    latestReactMapProps()[handler]!({ viewState: state } as MapEvent<
      typeof handler
    >),
  );
}

function dragStart() {
  act(() => latestReactMapProps().onDragStart!({} as MapEvent<'onDragStart'>));
}

function click(lat: number, lng: number) {
  act(() =>
    latestReactMapProps().onClick!({
      lngLat: { lat, lng },
    } as MapEvent<'onClick'>),
  );
}

describe('<Map />', () => {
  beforeEach(() => {
    mockMapGL.mockClear();
    mockIsWebGLSupported.mockReturnValue(true);
  });

  it('renders the OpenFreeMap style with map chrome', () => {
    render(
      <Map>
        <div>Map child</div>
      </Map>,
    );

    expect(screen.getByText('Map child')).toBeInTheDocument();
    expect(latestReactMapProps().mapStyle).toBe(
      'https://tiles.openfreemap.org/styles/liberty',
    );
    const disableRotation = vi.fn();
    const setWheelZoomRate = vi.fn();
    act(() =>
      latestReactMapProps().onLoad!({
        target: {
          touchZoomRotate: { disableRotation },
          scrollZoom: { setWheelZoomRate },
        },
      } as unknown as MapEvent<'onLoad'>),
    );
    expect(disableRotation).toHaveBeenCalled();
    expect(setWheelZoomRate).toHaveBeenCalledWith(1 / 100);
    expect(screen.getByTestId('map-navigation-control')).toBeInTheDocument();
    expect(screen.getByTestId('map-scale-control')).toBeInTheDocument();
  });

  it('shows a notice instead of the map when WebGL is unavailable', () => {
    mockIsWebGLSupported.mockReturnValue(false);

    render(<Map className="offer-location" height={200} />);

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent(
      'This browser cannot show the map because WebGL is not available.',
    );
    expect(notice).toHaveClass('offer-location');
    expect(notice).toHaveStyle({ height: '200px' });
    expect(screen.queryByTestId('react-map')).not.toBeInTheDocument();
  });

  it('chooses a location by dragging or clicking, but not by zooming', () => {
    const onLocationChange = vi.fn();
    const { rerender } = render(
      <Map location={[50, 10]} onLocationChange={onLocationChange} />,
    );

    move('onMove');
    move('onMoveEnd');
    expect(onLocationChange).not.toHaveBeenCalled();
    expect(latestReactMapProps()).toEqual(expect.objectContaining(viewState));

    dragStart();
    move('onMoveEnd');
    expect(onLocationChange).toHaveBeenCalledWith([51, 11]);
    onLocationChange.mockClear();
    move('onMoveEnd');
    expect(onLocationChange).not.toHaveBeenCalled();

    click(49, 9);
    expect(onLocationChange).toHaveBeenCalledWith([49, 9]);

    rerender(<Map location={[52, 12]} onLocationChange={onLocationChange} />);
    expect(latestReactMapProps()).toEqual(
      expect.objectContaining({ latitude: 52, longitude: 12, zoom: 15 }),
    );
    rerender(
      <Map location={[52, 12]} onLocationChange={onLocationChange} zoom={9} />,
    );
    expect(latestReactMapProps()).toEqual(
      expect.objectContaining({ latitude: 52, longitude: 12, zoom: 9 }),
    );
  });

  it('allows maps to pan and be clicked without a location callback', () => {
    render(<Map />);
    dragStart();
    move('onMove');
    move('onMoveEnd');
    click(49, 9);
    expect(latestReactMapProps()).toEqual(expect.objectContaining(viewState));
  });
});
