import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import Map from '@/modules/core/client/components/Map';

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
});
