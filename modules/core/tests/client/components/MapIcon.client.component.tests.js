import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import MapIcon from '@/modules/core/client/components/Map/MapIcon';

describe('<MapIcon />', () => {
  const originalSettings = window.settings;

  afterEach(() => {
    window.settings = originalSettings;
  });

  it('renders mapbox static image url when style and token are available', () => {
    window.settings = {
      mapbox: {
        publicKey: 'public-token',
      },
    };

    render(<MapIcon mapboxStyle="mapbox/outdoors-v11" />);
    const image = document.querySelector('img');
    const src = image.getAttribute('src');

    expect(src).toContain(
      'api.mapbox.com/styles/v1/mapbox/outdoors-v11/static',
    );
    expect(src).toContain('access_token=public-token');
  });

  it('falls back to placeholder image without mapbox style', () => {
    window.settings = {
      mapbox: {},
    };

    render(<MapIcon />);

    const image = document.querySelector('img');

    expect(image).toHaveAttribute(
      'src',
      expect.stringMatching(/^data:image\/png;base64,/),
    );
  });
});
