import React from 'react';
import { getMapBoxToken } from '@/modules/core/client/utils/map';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Map from '@/modules/core/client/components/Map';
import type MapStyleControl from '@/modules/core/client/components/Map/MapStyleControl';
import type LeafletMap from '@/modules/core/client/components/Map/LeafletMap';

type MapProps = React.ComponentProps<typeof Map>;
type MapStyleControlProps = React.ComponentProps<typeof MapStyleControl>;
type LeafletMapProps = React.ComponentProps<typeof LeafletMap>;

const mockIsWebGLSupported = jest.fn<boolean, []>();
const mockGetMapBoxToken = jest.mocked(getMapBoxToken);
beforeEach(() => mockGetMapBoxToken.mockReturnValue('test-token'));
jest.mock('@/modules/core/client/utils/map', () => ({
  ...jest.requireActual<typeof import('@/modules/core/client/utils/map')>(
    '@/modules/core/client/utils/map',
  ),
  isWebGLSupported: () => mockIsWebGLSupported(),
  getMapBoxToken: jest.fn(() => 'test-token'),
}));

const mockMapGL = jest.fn<void, [props: MapProps]>();
const mockMapStyleControl = jest.fn<void, [props: MapStyleControlProps]>();
jest.mock('react-map-gl/mapbox', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: function MockMapGL(props: MapProps) {
      mockMapGL(props);
      return <div data-testid="react-map">{props.children}</div>;
    },
  };
});

jest.mock('@/modules/core/client/components/Map/MapNavigationControl', () =>
  jest.fn(() => <div data-testid="map-navigation-control" />),
);
jest.mock('@/modules/core/client/components/Map/MapScaleControl', () =>
  jest.fn(() => <div data-testid="map-scale-control" />),
);
const mockLeafletMap = jest.fn<void, [props: LeafletMapProps]>();
jest.mock('@/modules/core/client/components/Map/LeafletMap', () =>
  jest.fn((props: LeafletMapProps) => {
    mockLeafletMap(props);
    return <div data-testid="leaflet-map" />;
  }),
);
jest.mock('@/modules/core/client/components/Map/MapStyleControl', () => ({
  __esModule: true,
  default: (props: MapStyleControlProps) => {
    mockMapStyleControl(props);
    return <div data-testid="map-style-control" />;
  },
}));

describe('<Map />', () => {
  beforeEach(() => {
    mockMapStyleControl.mockClear();
    mockLeafletMap.mockClear();
    mockIsWebGLSupported.mockReturnValue(true);
  });

  it('passes default viewport and renders map chrome', () => {
    render(
      <Map>
        <div>Map child</div>
      </Map>,
    );

    expect(screen.getByText('Map child')).toBeInTheDocument();
    expect(latestReactMapProps().mapboxAccessToken).toBe('test-token');
    const disableRotation = jest.fn();
    act(() =>
      latestReactMapProps().onLoad!({
        target: {
          touchZoomRotate: { disableRotation },
          scrollZoom: { setWheelZoomRate: jest.fn() },
        },
      } as unknown as Parameters<NonNullable<MapProps['onLoad']>>[0]),
    );
    expect(disableRotation).toHaveBeenCalled();
    expect(screen.getByTestId('map-navigation-control')).toBeInTheDocument();
    expect(screen.getByTestId('map-scale-control')).toBeInTheDocument();
    expect(screen.queryByTestId('map-style-control')).not.toBeInTheDocument();
  });

  it('renders map style control when showMapStyles is enabled', () => {
    render(<Map showMapStyles />);

    expect(screen.getByTestId('map-style-control')).toBeInTheDocument();
    expect(mockMapStyleControl).toHaveBeenCalledWith(
      expect.objectContaining({
        setMapstyle: expect.any(Function),
      }),
    );
  });

  it('uses the raster map when WebGL is unavailable', () => {
    mockIsWebGLSupported.mockReturnValue(false);

    render(
      <Map
        fallbackMarker={{ color: '#11b4da', location: [50.12, 19.89] }}
        location={[50.12, 19.89]}
        scrollZoom={false}
        zoom={11}
      />,
    );

    expect(screen.getByTestId('leaflet-map')).toBeInTheDocument();
    expect(screen.queryByTestId('react-map')).not.toBeInTheDocument();
    expect(mockLeafletMap).toHaveBeenCalledWith(
      expect.objectContaining({
        location: [50.12, 19.89],
        marker: { color: '#11b4da', location: [50.12, 19.89] },
        scrollZoom: false,
        zoom: 11,
      }),
    );
  });

  it('uses raster tiles without a token even when WebGL is supported', () => {
    mockGetMapBoxToken.mockReturnValue(undefined);
    render(<Map />);
    expect(screen.getByTestId('leaflet-map')).toBeInTheDocument();
    expect(screen.queryByTestId('react-map')).not.toBeInTheDocument();
  });

  it('can prefer raster tiles even when WebGL is supported', () => {
    mockIsWebGLSupported.mockReturnValue(true);
    render(
      <Map
        location={[35, -7]}
        fallbackMarker={{ color: '#11b4da', location: [35, -7] }}
        preferRaster
      />,
    );
    expect(screen.queryByTestId('react-map')).not.toBeInTheDocument();
    expect(mockLeafletMap).toHaveBeenCalledWith(
      expect.objectContaining({ location: [35, -7] }),
    );
  });
});

function latestReactMapProps(): MapProps {
  const call = mockMapGL.mock.calls[mockMapGL.mock.calls.length - 1];
  if (!call) {
    throw new Error('Expected ReactMapGL to have rendered');
  }
  return call[0];
}

type Viewport = {
  latitude: number;
  longitude: number;
  zoom: number;
};
type InteractionState = { isPanning?: boolean; isZooming?: boolean };
function changeMapViewport(
  viewport: Viewport = { latitude: 51, longitude: 11, zoom: 15 },
  interactionState?: InteractionState,
): void {
  const props = latestReactMapProps();
  const event = {
    viewState: viewport,
    target: { isZooming: () => interactionState?.isZooming ?? false },
  } as unknown as Parameters<NonNullable<MapProps['onMove']>>[0];
  act(() => {
    props.onMove!(event);
    if (interactionState?.isPanning) props.onDrag!(event);
  });
}

it('synchronises panning and external place searches while retaining zoom', () => {
  mockIsWebGLSupported.mockReturnValue(true);
  const onLocationChange = jest.fn();
  const { rerender } = render(
    <Map location={[50, 10]} onLocationChange={onLocationChange} />,
  );
  changeMapViewport(
    { latitude: 51, longitude: 11, zoom: 15 },
    { isPanning: true, isZooming: false },
  );
  expect(onLocationChange).toHaveBeenCalledWith([51, 11]);
  onLocationChange.mockClear();
  changeMapViewport(
    { latitude: 51, longitude: 11, zoom: 16 },
    { isPanning: true, isZooming: true },
  );
  expect(onLocationChange).not.toHaveBeenCalled();
  changeMapViewport({ latitude: 51, longitude: 11, zoom: 16 });
  expect(onLocationChange).not.toHaveBeenCalled();
  rerender(<Map location={[52, 12]} onLocationChange={onLocationChange} />);
  expect(latestReactMapProps()).toEqual(
    expect.objectContaining({ latitude: 52, longitude: 12, zoom: 16 }),
  );
});
it('allows maps to pan without a location callback', () => {
  mockIsWebGLSupported.mockReturnValue(true);
  render(<Map />);
  changeMapViewport();
  expect(latestReactMapProps()).toEqual(
    expect.objectContaining({ latitude: 51, longitude: 11, zoom: 15 }),
  );
});
