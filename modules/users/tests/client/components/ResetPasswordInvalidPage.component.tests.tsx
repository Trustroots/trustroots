import React from 'react';
import { render, screen } from '@testing-library/react';

import ResetPasswordInvalidPage from '@/modules/users/client/components/ResetPasswordInvalidPage.component';

type BoardProps = { children?: React.ReactNode };

vi.mock('@/modules/core/client/components/Board', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: ({ children }: BoardProps) => <section>{children}</section>,
  };
});

describe('ResetPasswordInvalidPage', () => {
  it('renders the invalid reset message and recovery link', () => {
    render(<ResetPasswordInvalidPage />);

    expect(screen.getByText('Password reset is invalid')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Either this reset link has been already used or it has expired.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /ask for a new password reset/i }),
    ).toHaveAttribute('href', '/password/forgot');
  });
});
