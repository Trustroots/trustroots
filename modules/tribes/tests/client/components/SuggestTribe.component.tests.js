import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import SuggestTribe from '@/modules/tribes/client/components/SuggestTribe';

describe('SuggestTribe', () => {
  it('renders translated invitation text and external suggestion link', () => {
    render(<SuggestTribe />);

    expect(screen.getByText('Missing your circle?')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Send us suggestions!/i }),
    ).toHaveAttribute('href', 'https://goo.gl/forms/B9EPVfBvMRuRivcH3');
    expect(
      screen.getByRole('link', { name: /Send us suggestions!/i }),
    ).toHaveAttribute('target', '_blank');
    expect(
      screen.getByRole('link', { name: /Send us suggestions!/i }),
    ).toHaveAttribute('rel', 'noreferrer noopener');
  });
});
