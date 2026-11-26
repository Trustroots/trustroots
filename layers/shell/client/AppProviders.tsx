import React, { useMemo, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  AnalyticsProvider,
  type AnalyticsTracker,
} from '@trustroots/analytics/client';

import {
  AppBootstrapContext,
  type BootstrapData,
} from '@trustroots/core/app-context';
import { AuthProvider } from '@trustroots/core/auth';
import { AnalyticsErrorEvents } from './AnalyticsErrorEvents';
import { getBootstrapData } from './bootstrap';

type AppProvidersProps = {
  bootstrapData?: BootstrapData;
  /** Defaults to the Umami tracker; tests pass a fake one. */
  analyticsTracker?: AnalyticsTracker;
  /** The router's client, so route loaders and pages share one cache. */
  queryClient?: QueryClient;
  children: ReactNode;
};

export function AppProviders({
  bootstrapData,
  analyticsTracker,
  queryClient: routerQueryClient,
  children,
}: AppProvidersProps) {
  const resolvedBootstrapData =
    bootstrapData === undefined ? getBootstrapData() : bootstrapData;
  const queryClient = useMemo(
    () => routerQueryClient ?? new QueryClient(),
    [routerQueryClient],
  );

  return (
    <AppBootstrapContext.Provider value={resolvedBootstrapData}>
      <AnalyticsProvider tracker={analyticsTracker}>
        <AnalyticsErrorEvents />
        <QueryClientProvider client={queryClient}>
          <AuthProvider initialUser={resolvedBootstrapData.user}>
            {children}
          </AuthProvider>
        </QueryClientProvider>
      </AnalyticsProvider>
    </AppBootstrapContext.Provider>
  );
}
