import React from 'react';
import { render, screen } from '@testing-library/react';

import SuspendedPage from '@/modules/users/client/components/SuspendedPage.component';

describe('SuspendedPage', () => {
  it('tells the member their account is suspended and where to go next', () => {
    render(<SuspendedPage />);

    expect(
      screen.getByRole('heading', { name: 'Your account has been suspended.' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Rules Of Trustroots' }),
    ).toHaveAttribute('href', '/rules');
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute(
      'href',
      '/contact',
    );
  });
});
