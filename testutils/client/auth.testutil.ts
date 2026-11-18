import type { AuthUser } from '@/modules/core/client/react-app/auth';

let viewer: AuthUser | null = null;

/** The signOut() that the mocked useAuth() returns. */
export const mockSignOut = vi.fn<(...args: []) => Promise<void>>();

/** Sets the signed-in member that the mocked useAuth() returns. */
export function setViewer(user: AuthUser | null): void {
  viewer = user;
}

/**
 * A vi.mock factory for the auth module, so components render without an
 * AuthProvider:
 *
 *   vi.mock('@/modules/core/client/react-app/auth', async () =>
 *     (await import('@/testutils/client/auth.testutil')).mockAuthModule(),
 *   );
 */
export async function mockAuthModule() {
  return {
    ...(await vi.importActual('@/modules/core/client/react-app/auth')),
    useAuth: () => ({
      user: viewer,
      isAuthenticated: Boolean(viewer),
      setUser: vi.fn(),
      signOut: mockSignOut,
      hasRole: (role: string) => Boolean(viewer?.roles?.includes(role)),
    }),
  };
}
