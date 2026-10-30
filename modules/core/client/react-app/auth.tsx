import { useRouter } from '@tanstack/react-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useTranslation } from 'react-i18next';

export type AuthUser = {
  _id?: string;
  username?: string;
  displayName?: string;
  email?: string;
  public?: boolean;
  roles?: string[];
  languages?: string[];
  blocked?: string[];
  description?: string;
  [key: string]: unknown;
};

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: Dispatch<SetStateAction<AuthUser | null>>;
  hasRole: (role: string) => boolean;
};

type AuthContextValue = AuthState & {
  signOut: () => Promise<void>;
};

type AuthProviderProps = {
  initialUser?: AuthUser | null;
  children: ReactNode;
};

const AuthContext = createContext<AuthState | null>(null);

export function userHasRole(user: AuthUser | null, role: string): boolean {
  return Boolean(role && (user?.roles || []).includes(role));
}

export function AuthProvider({
  initialUser = null,
  children,
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const value = useMemo<AuthState>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      setUser,
      hasRole(role) {
        return userHasRole(user, role);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function postSignout(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'manual',
    });
    // The server answers 302 /, which fetch reports as an opaque redirect.
    return response.ok || response.type === 'opaqueredirect';
  } catch {
    return false;
  }
}

export function useAuth(): AuthContextValue {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  // AuthProvider sits above RouterProvider, so the router comes from where
  // useAuth() is called. Sign-out buttons always render inside the router.
  const router = useRouter({ warn: false });
  const { t } = useTranslation('core');
  const { setUser } = auth;

  const signOut = useCallback(async () => {
    if (!(await postSignout())) {
      window.alert(
        `${t('Could not sign you out.')}\n\n${t(
          'Please ensure you are connected to internet and try again.',
        )}`,
      );
      return;
    }
    setUser(null);
    // A full reload drops every other piece of in-memory member state.
    await router.navigate({ to: '/', reloadDocument: true });
  }, [router, setUser, t]);

  return useMemo(() => ({ ...auth, signOut }), [auth, signOut]);
}
