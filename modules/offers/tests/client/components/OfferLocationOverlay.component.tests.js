import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import OfferLocationOverlay from '@/modules/offers/client/components/OfferLocationOverlay';

jest.mock('react-map-gl', () => {
  const React = require('react');
  const PropTypes = require('prop-types');

  class MockBaseControl extends React.Component {
    constructor(props) {
      super(props);
      this._context = {
        viewport: {
          zoom: props.__zoom ?? 10,
        },
      };
    }

    render() {
      return this._render();
    }
  }

  MockBaseControl.propTypes = {
    __zoom: PropTypes.number,
  };

  function MockSVGOverlay({ redraw }) {
    const circleNode = redraw({
      project: ([lng, lat]) => [lng, lat],
    });
    return <svg>{circleNode}</svg>;
  }

  MockSVGOverlay.propTypes = {
    redraw: PropTypes.func.isRequired,
  };

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
  });

  it('renders a high-zoom bubble style and computed radius', () => {
    const { container } = render(
      <OfferLocationOverlay
        __zoom={12}
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
        __zoom={10}
        location={[50.1, 19.89]}
        offerType="host"
        offerStatus="no"
      />,
    );

    const circle = container.querySelector('circle');

    expect(circle.tagName).toBe('circle');
    expect(circle).toHaveStyle({ fill: '#abcdef' });
    expect(circle).toHaveAttribute('r', '12');
  });
});
