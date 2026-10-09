import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Map from '@/modules/core/client/components/Map';

const mockIsWebGLSupported = jest.fn();
jest.mock('@/modules/core/client/utils/map', () => ({
  ...jest.requireActual('@/modules/core/client/utils/map'),
  isWebGLSupported: () => mockIsWebGLSupported(),
}));

const mockMapGL = jest.fn();
const mockMapStyleControl = jest.fn();
jest.mock('react-map-gl/mapbox-legacy', () => {
  const React = require('react');
  const PropTypes = require('prop-types');
  function MockMapGL(props) {
    mockMapGL(props);
    return <div data-testid="react-map">{props.children}</div>;
  }
  MockMapGL.propTypes = { children: PropTypes.node };

  return {
    __esModule: true,
    Map: MockMapGL,
  };
});

jest.mock('@/modules/core/client/components/Map/MapNavigationControl', () =>
  jest.fn(() => <div data-testid="map-navigation-control" />),
);
jest.mock('@/modules/core/client/components/Map/MapScaleControl', () =>
  jest.fn(() => <div data-testid="map-scale-control" />),
);
const mockLeafletMap = jest.fn();
jest.mock('@/modules/core/client/components/Map/LeafletMap', () =>
  jest.fn(props => {
    mockLeafletMap(props);
    return <div data-testid="leaflet-map" />;
  }),
);
jest.mock('@/modules/core/client/components/Map/MapStyleControl', () => ({
  __esModule: true,
  default: props => {
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

  it('preserves disabled touch rotation and forwards the load callback', () => {
    const disableRotation = jest.fn();
    const setWheelZoomRate = jest.fn();
    const canvas = document.createElement('canvas');
    const container = document.createElement('div');
    container.appendChild(canvas);
    container.getBoundingClientRect = () => ({ height: 320 });
    const onLoad = jest.fn();
    render(<Map onLoad={onLoad} />);

    const event = {
      target: {
        scrollZoom: { setWheelZoomRate },
        touchZoomRotate: { disableRotation },
        getCanvas: () => canvas,
        getContainer: () => container,
      },
    };
    mockMapGL.mock.calls.slice(-1)[0][0].onLoad(event);

    expect(disableRotation).toHaveBeenCalledTimes(1);
    expect(setWheelZoomRate).toHaveBeenCalledWith(1 / 100);
    expect(onLoad).toHaveBeenCalledWith(event);
  });

  it('normalises page-based wheel input using the map height', () => {
    const canvas = document.createElement('canvas');
    const container = document.createElement('div');
    container.appendChild(canvas);
    container.getBoundingClientRect = () => ({ height: 320 });
    const target = {
      scrollZoom: { setWheelZoomRate: jest.fn() },
      touchZoomRotate: { disableRotation: jest.fn() },
      getCanvas: () => canvas,
      getContainer: () => container,
    };
    const receivedWheels = [];
    canvas.addEventListener('wheel', event => {
      receivedWheels.push(event);
    });
    render(<Map />);
    act(() => mockMapGL.mock.calls.slice(-1)[0][0].onLoad({ target }));
    const pageWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaMode: 2,
      deltaY: -1,
      ctrlKey: true,
      altKey: true,
      metaKey: true,
      shiftKey: true,
    });

    act(() => canvas.dispatchEvent(pageWheel));

    expect(pageWheel.defaultPrevented).toBe(true);
    expect(receivedWheels).toContainEqual(
      expect.objectContaining({
        deltaMode: 0,
        deltaY: -320,
        ctrlKey: true,
        altKey: true,
        metaKey: true,
        shiftKey: true,
      }),
    );

    const lineWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaMode: WheelEvent.DOM_DELTA_LINE,
      deltaY: -2,
    });

    act(() => canvas.dispatchEvent(lineWheel));

    expect(lineWheel.defaultPrevented).toBe(true);
    expect(receivedWheels).toContainEqual(
      expect.objectContaining({ deltaMode: 0, deltaY: -80 }),
    );
  });

  it('leaves page wheel input alone when the map has zero height', () => {
    const canvas = document.createElement('canvas');
    const container = document.createElement('div');
    container.appendChild(canvas);
    container.getBoundingClientRect = () => ({ height: 0 });
    const target = {
      scrollZoom: { setWheelZoomRate: jest.fn() },
      touchZoomRotate: { disableRotation: jest.fn() },
      getCanvas: () => canvas,
      getContainer: () => container,
    };
    render(<Map />);
    act(() => mockMapGL.mock.calls.slice(-1)[0][0].onLoad({ target }));
    const pageWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaMode: 2,
      deltaY: -1,
    });

    act(() => canvas.dispatchEvent(pageWheel));

    expect(pageWheel.defaultPrevented).toBe(false);
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

  it('uses fallback dimensions when a raster map receives zero dimensions', () => {
    mockIsWebGLSupported.mockReturnValue(false);

    render(<Map height={0} width={0} />);

    expect(mockLeafletMap).toHaveBeenCalledWith(
      expect.objectContaining({ height: 320, width: '100%' }),
    );
  });
});

it('synchronises panning and external place searches while retaining zoom', () => {
  mockIsWebGLSupported.mockReturnValue(true);
  const onLocationChange = jest.fn();
  const { rerender } = render(
    <Map location={[50, 10]} onLocationChange={onLocationChange} />,
  );
  act(() =>
    mockMapGL.mock.calls
      .slice(-1)[0][0]
      .onMove({ viewState: { latitude: 51, longitude: 11, zoom: 15 } }),
  );
  expect(onLocationChange).toHaveBeenCalledWith([51, 11]);
  rerender(<Map location={[52, 12]} onLocationChange={onLocationChange} />);
  expect(mockMapGL.mock.calls.slice(-1)[0][0]).toEqual(
    expect.objectContaining({ latitude: 52, longitude: 12, zoom: 15 }),
  );
});
it('allows maps to pan without a location callback', () => {
  mockIsWebGLSupported.mockReturnValue(true);
  render(<Map />);
  act(() =>
    mockMapGL.mock.calls
      .slice(-1)[0][0]
      .onMove({ viewState: { latitude: 51, longitude: 11, zoom: 15 } }),
  );
  expect(mockMapGL.mock.calls.slice(-1)[0][0]).toEqual(
    expect.objectContaining({ latitude: 51, longitude: 11, zoom: 15 }),
  );
});
