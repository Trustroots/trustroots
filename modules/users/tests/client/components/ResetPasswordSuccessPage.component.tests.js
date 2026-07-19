import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import ResetPasswordSuccessPage from '@/modules/users/client/components/ResetPasswordSuccessPage.component';

jest.mock('@/modules/core/client/components/Board', () => ({
  __esModule: true,
  default: ({ children }) => <section>{children}</section>,
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
