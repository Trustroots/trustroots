import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import PropTypes from 'prop-types';

export type AuthUser = {
  _id?: string;
  username?: string;
  displayName?: string;
  email?: string;
  public?: boolean;
  roles?: string[];
  blocked?: string[];
  description?: string;
  [key: string]: unknown;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: Dispatch<SetStateAction<AuthUser | null>>;
  hasRole: (role: string) => boolean;
};

type AuthProviderProps = {
  initialUser?: AuthUser | null;
  children: ReactNode;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function userHasRole(user: AuthUser | null, role: string): boolean {
  return Boolean(role && (user?.roles || []).includes(role));
}

export function AuthProvider({
  initialUser = null,
  children,
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const value = useMemo<AuthContextValue>(
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

export function useAuth(): AuthContextValue {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return auth;
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
  initialUser: PropTypes.object,
};
