import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import RemoveProfilePage from '@/modules/users/client/components/RemoveProfilePage.component';
import * as authApi from '@/modules/users/client/api/auth.api';

jest.mock('@/modules/users/client/api/auth.api');
jest.mock('@/modules/core/client/components/Board', () => ({
  __esModule: true,
  default: ({ children }) => <section>{children}</section>,
}));
jest.mock('@/modules/core/client/components/LoadingIndicator', () => ({
  __esModule: true,
  default: () => <div data-testid="loading-indicator" />,
}));
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  getCurrentRouteParams: jest.fn(() => ({ token: 'remove-token' })),
}));

describe('RemoveProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows success after the profile is removed', async () => {
    authApi.removeProfile.mockResolvedValue({ message: 'Removed.' });

    render(<RemoveProfilePage />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Permanently delete my account' }),
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    expect(
      await screen.findByText('Your profile was removed.'),
    ).toBeInTheDocument();
    expect(authApi.removeProfile).toHaveBeenCalledWith('remove-token');
  });

  it('shows failure when removal fails', async () => {
    authApi.removeProfile.mockRejectedValue(new Error('Failed.'));

    render(<RemoveProfilePage />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Permanently delete my account' }),
    );

    expect(
      await screen.findByText('Your profile was not removed.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /get a new confirmation email/i }),
    ).toHaveAttribute('href', '/profile/edit/account#remove');
  });

  it('ignores a successful removal response after unmounting', async () => {
    let resolveRemoval;
    authApi.removeProfile.mockReturnValue(
      new Promise(resolve => {
        resolveRemoval = resolve;
      }),
    );

    const { unmount } = render(<RemoveProfilePage />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Permanently delete my account' }),
    );
    unmount();
    resolveRemoval({ message: 'Removed.' });
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it('ignores a removal failure after unmounting', async () => {
    let rejectRemoval;
    authApi.removeProfile.mockReturnValue(
      new Promise((resolve, reject) => {
        rejectRemoval = reject;
      }),
    );

    const { unmount } = render(<RemoveProfilePage />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Permanently delete my account' }),
    );
    unmount();
    rejectRemoval(new Error('late failure'));
    await new Promise(resolve => setTimeout(resolve, 0));
  });
});

it('requires explicit confirmation before removing an account', () => {
  jest.clearAllMocks();
  render(<RemoveProfilePage />);
  expect(screen.getByText('Delete your account?')).toBeVisible();
  expect(authApi.removeProfile).not.toHaveBeenCalled();
  expect(
    screen.getByRole('link', { name: 'Cancel and keep my account' }),
  ).toHaveAttribute('href', '/profile/edit/account#remove');
});
