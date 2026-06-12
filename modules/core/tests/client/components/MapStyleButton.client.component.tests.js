import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import MapStyleButton from '@/modules/core/client/components/Map/MapStyleButton';

const mockMapIcon = jest.fn();
jest.mock('@/modules/core/client/components/Map/MapIcon', () => {
  const React = require('react');

  return function MockMapIcon(props) {
    mockMapIcon(props);
    return <div data-testid="map-icon" />;
  };
});

describe('<MapStyleButton />', () => {
  const defaultProps = {
    label: 'Streets',
    onClick: jest.fn(),
    selectedStyle: 'mapbox://styles/mapbox/outdoors-v11',
    styleName: 'mapbox://styles/mapbox/outdoors-v11',
  };

  it('highlights active style and propagates click events', () => {
    const handleClick = jest.fn();

    render(
      <MapStyleButton
        {...defaultProps}
        onClick={handleClick}
        iconStyle="mapbox://styles/mapbox/outdoors-v11"
      />,
    );

    const button = screen.getByRole('button', { name: 'Streets' });

    expect(button).toHaveClass('btn', 'btn-default', 'is-active');
    expect(mockMapIcon).toHaveBeenCalledWith(
      expect.objectContaining({
        mapboxStyle: 'mapbox://styles/mapbox/outdoors-v11',
      }),
    );
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not activate click behavior while disabled', () => {
    const handleClick = jest.fn();

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
