import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import Screenshot from '@/modules/core/client/components/Screenshot';

describe('<Screenshot />', () => {
  it('renders browser frame, source sets, and image', () => {
    const { container } = render(
      <Screenshot
        png="/screenshot.png"
        png2x="/screenshot@2x.png"
        webp="/screenshot.webp"
        webp2x="/screenshot@2x.webp"
      />,
    );

    const sources = container.querySelectorAll('source');
    expect(sources).toHaveLength(2);
    expect(sources[0]).toHaveAttribute(
      'srcSet',
      '/screenshot.webp, /screenshot@2x.webp 2x,',
    );
    expect(sources[1]).toHaveAttribute(
      'srcSet',
      '/screenshot.png, /screenshot@2x.png 2x',
    );
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      '/screenshot.png',
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
