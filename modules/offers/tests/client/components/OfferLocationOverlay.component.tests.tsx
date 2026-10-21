import React from 'react';
import { act, render } from '@testing-library/react';
import '@testing-library/jest-dom';

import OfferLocationOverlay from '@/modules/offers/client/components/OfferLocationOverlay';

let mockZoom = 10;
const mockMap = {
  getZoom: () => mockZoom,
  on: jest.fn(),
  off: jest.fn(),
};
let mockCurrentMap: typeof mockMap | undefined;
const mockMarker = jest.fn();
jest.mock('react-map-gl/mapbox', () => ({
  useMap: () => ({ current: mockCurrentMap }),
  Marker: (props: { children: React.ReactNode }) => {
    mockMarker(props);
    return <div>{props.children}</div>;
  },
}));
jest.mock('@/modules/offers/client/utils/markers', () => ({
  getOfferHexColor: jest.fn(() => '#abcdef'),
  zoomToPixelMeters: jest.fn(() => 111),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockZoom = 10;
  mockCurrentMap = mockMap;
});

it('anchors an offer dot to its coordinates and updates its area bubble on zoom', () => {
  const { container, unmount } = render(
    <OfferLocationOverlay
      location={[50.1, 19.89]}
      offerType="host"
      offerStatus="yes"
    />,
  );
  expect(mockMarker).toHaveBeenCalledWith(
    expect.objectContaining({
      latitude: 50.1,
      longitude: 19.89,
      anchor: 'center',
    }),
  );
  expect(container.querySelector('circle')).toHaveAttribute('r', '12');
  expect(container.querySelector('circle')).toHaveStyle({ fill: '#abcdef' });
  mockZoom = 12;
  const updateZoom = mockMap.on.mock.calls[0][1];
  act(() => updateZoom());
  expect(container.querySelector('circle')).toHaveAttribute('r', '111');
  expect(container.querySelector('circle')).toHaveStyle({
    fill: '#b1b1b1',
    'fill-opacity': '0.5',
    stroke: '#989898',
    'stroke-width': '2px',
  });
  unmount();
  expect(mockMap.off).toHaveBeenCalledWith('zoom', updateZoom);
});

it('can render while the map is unavailable', () => {
  mockCurrentMap = undefined;
  const { container } = render(<OfferLocationOverlay location={[50, 19]} />);
  expect(container.querySelector('circle')).toHaveAttribute('r', '12');
  expect(mockMap.on).not.toHaveBeenCalled();
});
