import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import MapStyleButton from '@/modules/core/client/components/Map/MapStyleButton';

type MapIconProps = { mapboxStyle?: string };
const mockMapIcon = vi.fn<(...args: [props: MapIconProps]) => void>();
vi.mock('@/modules/core/client/components/Map/MapIcon', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    default: function MockMapIcon(props: MapIconProps) {
      mockMapIcon(props);
      return <div data-testid="map-icon" />;
    },
  };
});

describe('<MapStyleButton />', () => {
  const defaultProps: React.ComponentProps<typeof MapStyleButton> = {
    label: 'Streets',
    onClick: vi.fn(),
    selectedStyle: 'mapbox://styles/mapbox/outdoors-v11',
    styleName: 'mapbox://styles/mapbox/outdoors-v11',
  };

  it('highlights active style and propagates click events', () => {
    const handleClick = vi.fn();

    render(
      <MapStyleButton
        {...defaultProps}
        onClick={handleClick}
        iconStyle="mapbox://styles/mapbox/outdoors-v11"
      />,
    );

    const button = screen.getByRole('button', { name: 'Streets' });

    expect(button).toHaveAttribute('data-slot', 'button');
    expect(button).toHaveAttribute('data-intent', 'inverse');
    expect(button).toHaveClass('is-active');
    expect(mockMapIcon).toHaveBeenCalledWith(
      expect.objectContaining({
        mapboxStyle: 'mapbox://styles/mapbox/outdoors-v11',
      }),
    );
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not activate click behavior while disabled', () => {
    const handleClick = vi.fn();

    render(
      <MapStyleButton
        {...defaultProps}
        disabled
        onClick={handleClick}
        selectedStyle="mapbox://styles/mapbox/streets-v11"
      />,
    );

    const button = screen.getByRole('button', { name: 'Streets' });
    expect(button).not.toHaveClass('is-active');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });
});
