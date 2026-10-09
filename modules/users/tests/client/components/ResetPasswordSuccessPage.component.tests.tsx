import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ResetPasswordSuccessPage from '@/modules/users/client/components/ResetPasswordSuccessPage.component';
import type Board from '@/modules/core/client/components/Board';

jest.mock('@/modules/core/client/components/Board', () => ({
  __esModule: true,
  default: ({ children }: React.ComponentProps<typeof Board>) => (
    <section>{children}</section>
  ),
}));

describe('ResetPasswordSuccessPage', () => {
  it('renders the success message and sign-in link', () => {
    render(<ResetPasswordSuccessPage />);

    expect(screen.getByText('Password successfully reset')).toBeInTheDocument();
    expect(
      screen.getByText(/Sign in with your new password and authenticator code/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/signin',
    );
  });
});
