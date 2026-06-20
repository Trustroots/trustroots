import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import MapNavigationControl from '@/modules/core/client/components/Map/MapNavigationControl';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: key => `i18n:${key}`,
  }),
}));

jest.mock('react-map-gl', () => {
  const PropTypes = require('prop-types');

  function MockNavigationControl({ showCompass, zoomInLabel, zoomOutLabel }) {
    return (
      <div
        data-testid="navigation-control"
        data-show-compass={showCompass}
        data-zoom-in-label={zoomInLabel}
        data-zoom-out-label={zoomOutLabel}
      />
    );
  }

  MockNavigationControl.propTypes = {
    showCompass: PropTypes.bool,
    zoomInLabel: PropTypes.string,
    zoomOutLabel: PropTypes.string,
  };

  return {
    __esModule: true,
    NavigationControl: MockNavigationControl,
  };
});

describe('<MapNavigationControl />', () => {
  it('passes translated labels to react-map-gl navigation control', () => {
    render(<MapNavigationControl />);
    const control = screen.getByTestId('navigation-control');

    expect(control).toHaveAttribute('data-show-compass', 'false');
    expect(control).toHaveAttribute('data-zoom-in-label', 'i18n:Zoom in');
    expect(control).toHaveAttribute('data-zoom-out-label', 'i18n:Zoom out');
  });
});
