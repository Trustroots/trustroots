import type { AuthUser } from '@/modules/core/client/react-app/auth';

let viewer: AuthUser | null = null;

/** The signOut() that the mocked useAuth() returns. */
export const mockSignOut = jest.fn<Promise<void>, []>();

/** Sets the signed-in member that the mocked useAuth() returns. */
export function setViewer(user: AuthUser | null): void {
  viewer = user;
}

/**
 * A jest.mock factory for the auth module, so components render without an
 * AuthProvider:
 *
 *   jest.mock('@/modules/core/client/react-app/auth', () =>
 *     jest.requireActual('@/testutils/client/auth.testutil').mockAuthModule(),
 *   );
 */
export function mockAuthModule() {
  return {
    ...jest.requireActual('@/modules/core/client/react-app/auth'),
    useAuth: () => ({
      user: viewer,
      isAuthenticated: Boolean(viewer),
      setUser: jest.fn(),
      signOut: mockSignOut,
      hasRole: (role: string) => Boolean(viewer?.roles?.includes(role)),
    }),
  };
}
