import React, { useMemo, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  AnalyticsProvider,
  type AnalyticsTracker,
} from '@trustroots/analytics/client';

import {
  AppBootstrapContext,
  type BootstrapData,
} from '@/modules/core/client/react-app/app-context';
import { AuthProvider } from '@/modules/core/client/react-app/auth';
import { getBootstrapData } from './bootstrap';

type AppProvidersProps = {
  bootstrapData?: BootstrapData;
  /** Defaults to the Umami tracker; tests pass a fake one. */
  analyticsTracker?: AnalyticsTracker;
  children: ReactNode;
};

export function AppProviders({
  bootstrapData,
  analyticsTracker,
  children,
}: AppProvidersProps) {
  const resolvedBootstrapData =
    bootstrapData === undefined ? getBootstrapData() : bootstrapData;
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <AppBootstrapContext.Provider value={resolvedBootstrapData}>
      <AnalyticsProvider tracker={analyticsTracker}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider initialUser={resolvedBootstrapData.user}>
            {children}
          </AuthProvider>
        </QueryClientProvider>
      </AnalyticsProvider>
    </AppBootstrapContext.Provider>
  );
}
