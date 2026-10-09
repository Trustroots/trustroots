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
  it('renders the success message and continue link', () => {
    render(<ResetPasswordSuccessPage />);

    expect(screen.getByText('Password successfully reset')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
