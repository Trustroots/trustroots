import React, { createContext, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from 'react-query';

import { AuthProvider } from './auth';
import { getBootstrapData } from './bootstrap';

const AppBootstrapContext = createContext(null);

export function AppProviders({ bootstrapData = getBootstrapData(), children }) {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <AppBootstrapContext.Provider value={bootstrapData}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={bootstrapData.user}>{children}</AuthProvider>
      </QueryClientProvider>
    </AppBootstrapContext.Provider>
  );
}

export function useBootstrapData() {
  const bootstrapData = useContext(AppBootstrapContext);

  if (!bootstrapData) {
    throw new Error('useBootstrapData must be used within AppProviders');
  }

  return bootstrapData;
}

export function useSettings() {
  return useBootstrapData().settings;
}

export function useAppConfig() {
  const { env, facebookAppId, gaId, isNativeMobileApp, title } =
    useBootstrapData();

  return {
    env,
    facebookAppId,
    gaId,
    isNativeMobileApp,
    title,
  };
}

AppProviders.propTypes = {
  bootstrapData: PropTypes.shape({
    env: PropTypes.string,
    facebookAppId: PropTypes.string,
    gaId: PropTypes.string,
    isNativeMobileApp: PropTypes.bool,
    settings: PropTypes.object,
    title: PropTypes.string,
    user: PropTypes.object,
  }),
  children: PropTypes.node.isRequired,
};
