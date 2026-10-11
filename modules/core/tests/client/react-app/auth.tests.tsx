import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  AuthProvider,
  useAuth,
  userHasRole,
  type AuthUser,
} from '@/modules/core/client/react-app/auth';

function AuthConsumer() {
  const { hasRole, isAuthenticated, setUser, user } = useAuth();

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

  it('checks roles through the pure userHasRole helper', () => {
    expect(userHasRole({ roles: ['user', 'admin'] }, 'admin')).toBe(true);
    expect(userHasRole({ roles: ['user'] }, 'admin')).toBe(false);
    expect(userHasRole(null, 'admin')).toBe(false);
    // Preserve the regression case for a missing role argument at this API boundary.
    expect(
      userHasRole({ roles: ['admin'] }, undefined as unknown as string),
    ).toBe(false);
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
