import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import OfferLocationOverlay from '@/modules/offers/client/components/OfferLocationOverlay';
type MockBaseControlProps = { children?: React.ReactNode };
type MockSVGOverlayProps = {
  redraw: (context: {
    project: (coordinates: [number, number]) => [number, number];
  }) => React.ReactElement;
};

let mockZoom = 10;

jest.mock('react-map-gl', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  class MockBaseControl extends React.Component<MockBaseControlProps> {
    _context: { viewport: { zoom: number } };

    constructor(props: MockBaseControlProps) {
      super(props);
      this._context = {
        viewport: {
          zoom: mockZoom,
        },
      };
    }

    _render(): React.ReactNode {
      return null;
    }

    render(): React.ReactNode {
      return this._render();
    }
  }

  function MockSVGOverlay({ redraw }: MockSVGOverlayProps) {
    const circleNode = redraw({
      project: ([lng, lat]) => [lng, lat],
    });
    return <svg>{circleNode}</svg>;
  }

  return {
    __esModule: true,
    BaseControl: MockBaseControl,
    SVGOverlay: MockSVGOverlay,
  };
});

jest.mock('@/modules/offers/client/utils/markers', () => ({
  getOfferHexColor: jest.fn(() => '#abcdef'),
  zoomToPixelMeters: jest.fn(() => 111),
}));

describe('OfferLocationOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockZoom = 10;
  });

  it('renders a high-zoom bubble style and computed radius', () => {
    mockZoom = 12;
    const { container } = render(
      <OfferLocationOverlay
        location={[50.1, 19.89]}
        offerType="host"
        offerStatus="yes"
      />,
    );

    const circle = container.querySelector('circle');

    expect(circle).toBeInTheDocument();
    expect(circle).toHaveAttribute('cx', '19.89');
    expect(circle).toHaveAttribute('cy', '50.1');
    expect(circle).toHaveStyle({
      fill: '#b1b1b1',
      'fill-opacity': '0.5',
      stroke: '#989898',
      'stroke-width': '2px',
    });
    expect(circle).toHaveAttribute('r', '111');
  });

  it('renders a standard offer dot for low zoom levels', () => {
    const { container } = render(
      <OfferLocationOverlay
        location={[50.1, 19.89]}
        offerType="host"
        offerStatus="no"
      />,
    );

    const circle = container.querySelector('circle');

    expect(circle!.tagName).toBe('circle');
    expect(circle!).toHaveStyle({ fill: '#abcdef' });
    expect(circle!).toHaveAttribute('r', '12');
  });
});
