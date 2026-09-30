import React, {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from 'react-query';

import { AuthProvider, type AuthUser } from './auth';
import { getBootstrapData } from './bootstrap';

export type BootstrapData = {
  env?: string;
  gaId?: string;
  isNativeMobileApp?: boolean;
  settings: NonNullable<Window['settings']>;
  title: string;
  user: AuthUser | null;
};
type AppProvidersProps = {
  bootstrapData?: BootstrapData;
  children: ReactNode;
};

const AppBootstrapContext = createContext<BootstrapData | null>(null);

export function AppProviders({ bootstrapData, children }: AppProvidersProps) {
  const resolvedBootstrapData =
    bootstrapData === undefined ? getBootstrapData() : bootstrapData;
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <AppBootstrapContext.Provider value={resolvedBootstrapData}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={resolvedBootstrapData.user}>
          {children}
        </AuthProvider>
      </QueryClientProvider>
    </AppBootstrapContext.Provider>
  );
}

export function useBootstrapData(): BootstrapData {
  const bootstrapData = useContext(AppBootstrapContext);
  if (!bootstrapData) {
    throw new Error('useBootstrapData must be used within AppProviders');
  }
  return bootstrapData;
}

export function useSettings(): BootstrapData['settings'] {
  return useBootstrapData().settings;
}

export function useAppConfig() {
  const { env, gaId, isNativeMobileApp, title } = useBootstrapData();
  return { env, gaId, isNativeMobileApp, title };
}

AppProviders.propTypes = {
  bootstrapData: PropTypes.shape({
    env: PropTypes.string,
    gaId: PropTypes.string,
    isNativeMobileApp: PropTypes.bool,
    settings: PropTypes.object,
    title: PropTypes.string,
    user: PropTypes.object,
  }),
  children: PropTypes.node.isRequired,
};
