import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import Map from '@/modules/core/client/components/Map';

const mockIsWebGLSupported = jest.fn();
jest.mock('@/modules/core/client/utils/map', () => ({
  ...jest.requireActual('@/modules/core/client/utils/map'),
  isWebGLSupported: () => mockIsWebGLSupported(),
}));

const mockMapStyleControl = jest.fn();
jest.mock('react-map-gl', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: function MockMapGL(props) {
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
