import React from 'react';
import { render, screen } from '@testing-library/react';

import MapScaleControl from '@/modules/core/client/components/Map/MapScaleControl';

const mockScaleControl = vi.fn();

vi.mock('@vis.gl/react-maplibre', () => ({
  __esModule: true,
  ScaleControl: (props: unknown) => {
    mockScaleControl(props);
    return <div data-testid="scale-control" />;
  },
}));

describe('<MapScaleControl />', () => {
  it('renders a metric scale control', () => {
    render(<MapScaleControl />);

    const scaleControl = screen.getByTestId('scale-control');

    expect(scaleControl).toBeInTheDocument();
    expect(mockScaleControl).toHaveBeenCalledWith(
      expect.objectContaining({
        unit: 'metric',
        maxWidth: 100,
        position: 'bottom-left',
      }),
    );
  });
});
