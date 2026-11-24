import { malformedFixture } from '@/testutils/client/malformed-fixtures';
import React from 'react';
import { render, screen } from '@testing-library/react';

import OfferLocation from '@/modules/offers/client/components/OfferLocation.component';
import type { MapProps } from '@/modules/core/client/components/Map/types';

const mockMap = vi.fn<(props: MapProps) => void>();
vi.mock('@/modules/core/client/components/Map/index', () => ({
  default: (props: MapProps) => {
    mockMap(props);
    return <div data-testid="map" style={props.style} />;
  },
}));

describe('<OfferLocation />', () => {
  beforeEach(() => {
    mockMap.mockClear();
  });

  it('renders nothing for invalid location data', () => {
    const { container } = render(
      <OfferLocation
        {...malformedFixture({ location: [] as number[] }, { location: null })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the approximate offer area in the offer colour', () => {
    render(
      <OfferLocation
        location={[50.12, 19.89]}
        offerStatus="yes"
        offerType="host"
      />,
    );

    expect(screen.getByTestId('map')).toHaveStyle({ height: '320px' });
    expect(mockMap).toHaveBeenCalledWith(
      expect.objectContaining({
        view: { latitude: 50.12, longitude: 19.89, zoom: 11 },
        scrollZoom: false,
        area: { latitude: 50.12, longitude: 19.89, colour: '#5cb85c' },
      }),
    );
  });

  it('keeps the same view across renders for the same location', () => {
    const { rerender } = render(<OfferLocation location={[51, 4]} />);
    rerender(<OfferLocation location={[51, 4]} offerType="meet" />);
    expect(mockMap.mock.calls[0][0].view).toBe(mockMap.mock.calls[1][0].view);
  });

  it('supports a compact map height', () => {
    render(<OfferLocation location={[51, 4]} height={220} />);
    expect(screen.getByTestId('map')).toHaveStyle({ height: '220px' });
  });

  it('omits maps for incomplete locations', () => {
    const { container } = render(<OfferLocation location={[51]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
