import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import MapScaleControl from '@/modules/core/client/components/Map/MapScaleControl';

jest.mock('react-map-gl', () => ({
  __esModule: true,
  ScaleControl: () => <div data-testid="scale-control" />,
}));

describe('<MapScaleControl />', () => {
  it('renders the scale control inside the styled wrapper', () => {
    render(<MapScaleControl />);

    const scaleControl = screen.getByTestId('scale-control');

    expect(scaleControl).toBeInTheDocument();
    expect(
      scaleControl.closest('.map-scale-control-container'),
    ).toBeInTheDocument();
  });
});
