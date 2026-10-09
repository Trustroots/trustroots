import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import OfferLocationOverlay from '@/modules/offers/client/components/OfferLocationOverlay';

const mockMap = {
  getZoom: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};
let mockMapInstance = mockMap;

jest.mock('react-map-gl/mapbox-legacy', () => {
  const React = require('react');
  const PropTypes = require('prop-types');

  function MockMarker({ children, latitude, longitude, style }) {
    return React.createElement(
      'div',
      { 'data-latitude': latitude, 'data-longitude': longitude, style },
      children,
    );
  }
  MockMarker.propTypes = {
    children: PropTypes.node,
    latitude: PropTypes.number.isRequired,
    longitude: PropTypes.number.isRequired,
    style: PropTypes.object,
  };

  return {
    Marker: MockMarker,
    useMap: () => ({ current: { getMap: () => mockMapInstance } }),
  };
});

jest.mock('@/modules/offers/client/utils/markers', () => ({
  getOfferHexColor: jest.fn(() => '#abcdef'),
  zoomToPixelMeters: jest.fn(() => 111),
}));

describe('OfferLocationOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMapInstance = mockMap;
  });

  it('renders when the map instance is not ready yet', () => {
    mockMapInstance = null;

    expect(() =>
      render(<OfferLocationOverlay location={[50.1, 19.89]} />),
    ).not.toThrow();
    expect(mockMap.on).not.toHaveBeenCalled();
  });

  it('renders a high-zoom bubble style at the offer location', () => {
    mockMap.getZoom.mockReturnValue(12);
    const { container } = render(
      <OfferLocationOverlay
        location={[50.1, 19.89]}
        offerType="host"
        offerStatus="yes"
      />,
    );

    const marker = container.querySelector('[data-latitude="50.1"]');
    const circle = marker.querySelector('span');

    expect(marker).toHaveAttribute('data-longitude', '19.89');
    expect(marker).toHaveStyle({ pointerEvents: 'none' });
    expect(circle).toHaveStyle({
      backgroundColor: 'rgba(177, 177, 177, 0.5)',
      border: '2px solid #989898',
      height: '222px',
      width: '222px',
    });
  });

  it('renders a standard offer dot at low zoom', () => {
    mockMap.getZoom.mockReturnValue(10);
    const { container } = render(
      <OfferLocationOverlay
        location={[50.1, 19.89]}
        offerType="host"
        offerStatus="no"
      />,
    );

    const marker = container.querySelector('[data-latitude="50.1"]');
    const circle = marker.querySelector('span');

    expect(circle).toHaveStyle({
      backgroundColor: '#abcdef',
      height: '24px',
      width: '24px',
    });
  });
});
