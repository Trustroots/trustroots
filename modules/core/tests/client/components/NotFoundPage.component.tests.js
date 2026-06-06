import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import NotFoundPage from '@/modules/core/client/components/NotFoundPage.component';

describe('<NotFoundPage />', () => {
  it('renders fallback copy and actions for missing pages', () => {
    render(<NotFoundPage />);

    expect(
      screen.getByRole('heading', { name: 'This page cannot be found.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue…' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute(
      'href',
      '/support',
    );
  });
});
