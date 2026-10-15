import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import OfferLocation from '@/modules/offers/client/components/OfferLocation.component';
import type Map from '@/modules/core/client/components/Map';
import type OfferLocationOverlay from '@/modules/offers/client/components/OfferLocationOverlay';

type MockMapProps = React.ComponentProps<typeof Map>;
const mockMap = jest.fn<void, [MockMapProps]>();
jest.mock('@/modules/core/client/components/Map', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function MockMap(props: MockMapProps) {
    return (
      <div data-testid="map">
        {mockMap(props)}
        {props.children}
      </div>
    );
  }

  return MockMap;
});

const mockOfferLocationOverlay = jest.fn<
  void,
  [React.ComponentProps<typeof OfferLocationOverlay>]
>();
jest.mock('@/modules/offers/client/components/OfferLocationOverlay', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return jest.fn((props: React.ComponentProps<typeof OfferLocationOverlay>) => {
    mockOfferLocationOverlay(props);
    return <div data-testid="offer-overlay" />;
  });
});

describe('<OfferLocation />', () => {
  beforeEach(() => {
    mockMap.mockClear();
    mockOfferLocationOverlay.mockClear();
  });

  it('renders nothing for invalid location data', () => {
    const { container } = render(
      Reflect.apply(OfferLocation, undefined, [{ location: null }]),
    );

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
    expect(mockMap).toHaveBeenCalledWith(
      expect.objectContaining({ height: 320 }),
    );
    expect(mockOfferLocationOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        location: [50.12, 19.89],
        offerStatus: 'yes',
        offerType: 'host',
      }),
    );
  });

  it('supports a compact map height', () => {
    render(<OfferLocation location={[51, 4]} height={220} />);
    expect(mockMap).toHaveBeenCalledWith(
      expect.objectContaining({ height: 220 }),
    );
  });

  it('omits maps for incomplete locations', () => {
    const { container } = render(<OfferLocation location={[51]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
