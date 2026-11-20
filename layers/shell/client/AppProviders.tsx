import React, { useMemo, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  AnalyticsProvider,
  type AnalyticsTracker,
  type RouteTemplate,
} from '@trustroots/analytics/client';

import {
  AppBootstrapContext,
  type BootstrapData,
} from '@/modules/core/client/react-app/app-context';
import { AuthProvider } from '@/modules/core/client/react-app/auth';
import { AnalyticsErrorEvents } from './AnalyticsErrorEvents';
import { getBootstrapData } from './bootstrap';

type AppProvidersProps = {
  bootstrapData?: BootstrapData;
  /** Defaults to the Umami tracker; tests pass a fake one. */
  analyticsTracker?: AnalyticsTracker;
  /** The router's client, so route loaders and pages share one cache. */
  queryClient?: QueryClient;
  /** Names pages for Umami page views; without it the tracker stays off. */
  routeTemplate?: RouteTemplate;
  children: ReactNode;
};

export function AppProviders({
  bootstrapData,
  analyticsTracker,
  queryClient: routerQueryClient,
  routeTemplate,
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
      <AnalyticsProvider
        tracker={analyticsTracker}
        routeTemplate={routeTemplate}
      >
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
