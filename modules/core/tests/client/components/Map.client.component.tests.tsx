import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Map from '@/modules/core/client/components/Map';
import type MapStyleControl from '@/modules/core/client/components/Map/MapStyleControl';
import type LeafletMap from '@/modules/core/client/components/Map/LeafletMap';

type MapProps = React.ComponentProps<typeof Map>;
type MapStyleControlProps = React.ComponentProps<typeof MapStyleControl>;
type LeafletMapProps = React.ComponentProps<typeof LeafletMap>;

const mockIsWebGLSupported = jest.fn<boolean, []>();
jest.mock('@/modules/core/client/utils/map', () => ({
  ...jest.requireActual<typeof import('@/modules/core/client/utils/map')>(
    '@/modules/core/client/utils/map',
  ),
  isWebGLSupported: () => mockIsWebGLSupported(),
}));

const mockMapGL = jest.fn<void, [props: MapProps]>();
const mockMapStyleControl = jest.fn<void, [props: MapStyleControlProps]>();
jest.mock('react-map-gl', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    MapController: jest.requireActual('react-map-gl').MapController,
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
});

function latestReactMapProps(): MapProps {
  const call = mockMapGL.mock.calls[mockMapGL.mock.calls.length - 1];
  if (!call) {
    throw new Error('Expected ReactMapGL to have rendered');
  }
  return call[0];
}

function changeMapViewport(): void {
  const onViewportChange = latestReactMapProps().onViewportChange as
    | ((viewport: {
        latitude: number;
        longitude: number;
        zoom: number;
      }) => void)
    | undefined;
  if (!onViewportChange) {
    throw new Error('Expected the map viewport callback to be provided');
  }
  // ReactMapGL supplies a richer view state; these tests exercise the fields
  // consumed by Map and preserve the original three-field callback payload.
  const viewport = { latitude: 51, longitude: 11, zoom: 15 };
  act(() => onViewportChange(viewport));
}

it('synchronises panning and external place searches while retaining zoom', () => {
  mockIsWebGLSupported.mockReturnValue(true);
  const onLocationChange = jest.fn();
  const { rerender } = render(
    <Map location={[50, 10]} onLocationChange={onLocationChange} />,
  );
  changeMapViewport();
  expect(onLocationChange).toHaveBeenCalledWith([51, 11]);
  rerender(<Map location={[52, 12]} onLocationChange={onLocationChange} />);
  expect(latestReactMapProps()).toEqual(
    expect.objectContaining({ latitude: 52, longitude: 12, zoom: 15 }),
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
