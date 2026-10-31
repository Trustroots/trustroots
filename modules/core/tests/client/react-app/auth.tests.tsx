import { invokeMalformed } from '@/testutils/client/malformed-fixtures';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  AuthProvider,
  useAuth,
  userHasRole,
  type AuthUser,
} from '@/modules/core/client/react-app/auth';

const mockNavigate = jest.fn();
jest.mock('@tanstack/react-router', () => ({
  ...jest.requireActual('@tanstack/react-router'),
  useRouter: () => ({ navigate: mockNavigate }),
}));

function AuthConsumer() {
  const { hasRole, isAuthenticated, setUser, signOut, user } = useAuth();

  return (
    <div>
      <p>Authenticated: {isAuthenticated ? 'yes' : 'no'}</p>
      <p>Username: {user?.username || 'guest'}</p>
      <p>Admin: {hasRole('admin') ? 'yes' : 'no'}</p>
      <button
        type="button"
        onClick={() =>
          setUser({
            roles: ['user', 'admin'],
            username: 'alice',
          })
        }
      >
        Set admin
      </button>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}

describe('React AuthProvider', () => {
  it('exposes guest auth state by default', () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(screen.getByText('Authenticated: no')).toBeInTheDocument();
    expect(screen.getByText('Username: guest')).toBeInTheDocument();
    expect(screen.getByText('Admin: no')).toBeInTheDocument();
  });

  it('initializes from the bootstrap user and updates via setUser', () => {
    const bootstrapUser: AuthUser = { roles: ['user'], username: 'bob' };

    render(
      <AuthProvider initialUser={bootstrapUser}>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(screen.getByText('Authenticated: yes')).toBeInTheDocument();
    expect(screen.getByText('Username: bob')).toBeInTheDocument();
    expect(screen.getByText('Admin: no')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Set admin' }));

    expect(screen.getByText('Username: alice')).toBeInTheDocument();
    expect(screen.getByText('Admin: yes')).toBeInTheDocument();
  });

  describe('signOut', () => {
    const fetchMock = jest.fn();
    const alertMock = jest.fn();

    beforeEach(() => {
      mockNavigate.mockReset().mockResolvedValue(undefined);
      fetchMock.mockReset();
      alertMock.mockReset();
      global.fetch = fetchMock;
      window.alert = alertMock;
    });

    function renderSignedIn() {
      render(
        <AuthProvider initialUser={{ roles: ['user'], username: 'bob' }}>
          <AuthConsumer />
        </AuthProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    }

    it('posts to the signout endpoint, clears the member and reloads home', async () => {
      // The server answers 302 /, which fetch exposes as an opaque redirect.
      fetchMock.mockResolvedValue({ ok: false, type: 'opaqueredirect' });

      renderSignedIn();

      await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/signout', {
        method: 'POST',
        credentials: 'same-origin',
        redirect: 'manual',
      });
      expect(screen.getByText('Authenticated: no')).toBeInTheDocument();
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/',
        reloadDocument: true,
      });
      expect(alertMock).not.toHaveBeenCalled();
    });

    it('keeps the member signed in and alerts when the request fails', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      renderSignedIn();

      await waitFor(() => expect(alertMock).toHaveBeenCalled());
      expect(screen.getByText('Authenticated: yes')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('keeps the member signed in when the server refuses', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 403, type: 'basic' });

      renderSignedIn();

      await waitFor(() => expect(alertMock).toHaveBeenCalled());
      expect(screen.getByText('Authenticated: yes')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('checks roles through the pure userHasRole helper', () => {
    expect(userHasRole({ roles: ['user', 'admin'] }, 'admin')).toBe(true);
    expect(userHasRole({ roles: ['user'] }, 'admin')).toBe(false);
    expect(userHasRole(null, 'admin')).toBe(false);
    // Preserve the regression case for a missing role argument at this API boundary.
    expect(invokeMalformed(userHasRole, { roles: ['admin'] }, undefined)).toBe(
      false,
    );
  });

  it('throws when useAuth is used outside AuthProvider', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => render(<AuthConsumer />)).toThrow(
      'useAuth must be used within AuthProvider',
    );

    consoleError.mockRestore();
  });
});
