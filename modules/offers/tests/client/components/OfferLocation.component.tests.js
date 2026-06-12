import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import OfferLocation from '@/modules/offers/client/components/OfferLocation.component';

const mockMap = jest.fn();
jest.mock('@/modules/core/client/components/Map', () => {
  const React = require('react');
  const PropTypes = require('prop-types');

  function MockMap(props) {
    return (
      <div data-testid="map">
        {mockMap(props)}
        {props.children}
      </div>
    );
  }

  MockMap.propTypes = {
    children: PropTypes.node,
  };

  return MockMap;
});

const mockOfferLocationOverlay = jest.fn();
jest.mock('@/modules/offers/client/components/OfferLocationOverlay', () =>
  jest.fn(props => {
    mockOfferLocationOverlay(props);
    return <div data-testid="offer-overlay" />;
  }),
);

describe('<OfferLocation />', () => {
  beforeEach(() => {
    mockMap.mockClear();
    mockOfferLocationOverlay.mockClear();
  });

  it('renders nothing for invalid location data', () => {
    const { container } = render(<OfferLocation location={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders map and overlay for valid location data', () => {
    render(
      <OfferLocation
        location={[50.12, 19.89]}
        offerStatus="yes"
        offerType="host"
      />,
    );

    expect(screen.getByTestId('map')).toBeInTheDocument();
    expect(screen.getByTestId('offer-overlay')).toBeInTheDocument();
    expect(mockOfferLocationOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        location: [50.12, 19.89],
        offerStatus: 'yes',
        offerType: 'host',
      }),
    );
  });
});
