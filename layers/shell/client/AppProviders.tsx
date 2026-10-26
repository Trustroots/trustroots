import React, { useMemo, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  AppBootstrapContext,
  type BootstrapData,
} from '@/modules/core/client/react-app/app-context';
import { AuthProvider } from '@/modules/core/client/react-app/auth';
import { getBootstrapData } from './bootstrap';

type AppProvidersProps = {
  bootstrapData?: BootstrapData;
  children: ReactNode;
};

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
