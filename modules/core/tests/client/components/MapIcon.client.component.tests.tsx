import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import MapIcon from '@/modules/core/client/components/Map/MapIcon';

describe('<MapIcon />', () => {
  it.each([
    ['mapbox/outdoors-v11', '#c6dfb5'],
    ['mapbox/satellite-streets-v11', '#42594b'],
    ['mapbox/streets-v11', '#ece7db'],
    [undefined, '#ece7db'],
  ])('renders local decorative artwork for %s', (mapboxStyle, background) => {
    const { container } = render(<MapIcon mapboxStyle={mapboxStyle} />);
    const icon = container.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveAttribute('width', '24');
    expect(icon?.querySelector('circle')).toHaveAttribute('fill', background);
    expect(container.querySelector('img, image')).not.toBeInTheDocument();
  });
});
