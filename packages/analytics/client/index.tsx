/**
 * Browser product events for React: mount `<AnalyticsProvider>` once and call
 * `useAnalytics().track(name, data)` from components. The provider owns the
 * tracker, so tests and stories pass a fake one instead of touching `window`.
 */
import React, {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';

import { createUmamiTracker, type AnalyticsTracker } from './umami.ts';

export {
  MAX_QUEUED_EVENTS,
  createUmamiTracker,
  type AnalyticsTracker,
} from './umami.ts';

const AnalyticsContext = createContext<AnalyticsTracker | null>(null);

type AnalyticsProviderProps = {
  /** Defaults to the Umami tracker script the page layout loads. */
  tracker?: AnalyticsTracker;
  children: ReactNode;
};

export function AnalyticsProvider({
  tracker,
  children,
}: AnalyticsProviderProps) {
  const [defaultTracker] = useState(() => tracker ?? createUmamiTracker());

  return (
    <AnalyticsContext.Provider value={tracker ?? defaultTracker}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics(): AnalyticsTracker {
  const analytics = useContext(AnalyticsContext);
  if (!analytics) {
    throw new Error('useAnalytics must be used within AnalyticsProvider');
  }
  return analytics;
}
