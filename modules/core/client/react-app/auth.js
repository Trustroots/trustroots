import React, { createContext, useContext, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

const AuthContext = createContext(null);

export function userHasRole(user, role) {
  return Boolean(role && (user?.roles || []).includes(role));
}

export function AuthProvider({ initialUser = null, children }) {
  const [user, setUser] = useState(initialUser);
  const value = useMemo(
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

export function useAuth() {
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
