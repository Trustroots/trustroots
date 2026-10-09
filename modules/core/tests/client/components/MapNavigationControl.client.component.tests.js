import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import MapNavigationControl from '@/modules/core/client/components/Map/MapNavigationControl';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: key => `i18n:${key}`,
  }),
}));

jest.mock('react-map-gl/mapbox-legacy', () => {
  const PropTypes = require('prop-types');

  function MockNavigationControl({ showCompass }) {
    return (
      <div data-testid="navigation-control" data-show-compass={showCompass} />
    );
  }

  MockNavigationControl.propTypes = {
    showCompass: PropTypes.bool,
  };

  return {
    __esModule: true,
    NavigationControl: MockNavigationControl,
  };
});

describe('<MapNavigationControl />', () => {
  it('disables the compass on the map navigation control', () => {
    render(<MapNavigationControl />);
    const control = screen.getByTestId('navigation-control');

    expect(control).toHaveAttribute('data-show-compass', 'false');
  });
});
