/**
 * Browser product events for React: mount `<AnalyticsProvider>` once and call
 * `useAnalytics().track(name, data)` from components. The provider owns the
 * tracker, so tests and stories pass a fake one instead of touching `window`.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { createUmamiTracker, type AnalyticsTracker } from './umami.ts';
import {
  installUmamiBeforeSend,
  type RouteTemplate,
} from './umami-before-send.ts';

export {
  MAX_QUEUED_EVENTS,
  createUmamiTracker,
  type AnalyticsTracker,
} from './umami.ts';
export {
  UMAMI_BEFORE_SEND,
  createUmamiBeforeSend,
  scrubUmamiUrl,
  type RouteTemplate,
  type UmamiPayload,
} from './umami-before-send.ts';
export {
  rememberOutreachSource,
  readOutreachSource,
} from './outreach-source.ts';
export {
  emailConfirmFailureReason,
  messageSendFailureReason,
  passwordResetFailureReason,
  saveFailureReason,
  signinFailureReason,
} from './failure-reasons.ts';
export {
  ANALYTICS_EVENTS,
  ANALYTICS_LANGUAGES,
  NAVIGATION_ITEMS,
  toAnalyticsLanguage,
  type AnalyticsEventArgs,
  type AnalyticsEventName,
  type AnalyticsEvents,
  type AnalyticsLanguage,
  type CircleSource,
  type EmailConfirmFailureReason,
  type MessageGateReason,
  type MessageSendFailureReason,
  type NavigationItem,
  type NavigationSurface,
  type OfferType,
  type OutreachSource,
  type PasswordResetFailureReason,
  type ProfileSection,
  type SaveFailureReason,
  type SearchFilter,
  type SigninFailureReason,
  type SupportCategory,
} from '../shared/events.ts';

const AnalyticsContext = createContext<AnalyticsTracker | null>(null);

type AnalyticsProviderProps = {
  /** Defaults to the Umami tracker script the page layout loads. */
  tracker?: AnalyticsTracker;
  /**
   * Names pages for Umami page views. The tracker script is activated only
   * once this is given, so tests and stories without it never load it.
   */
  routeTemplate?: RouteTemplate;
  children: ReactNode;
};

export function AnalyticsProvider({
  tracker,
  routeTemplate,
  children,
}: AnalyticsProviderProps) {
  const [defaultTracker] = useState(() => tracker ?? createUmamiTracker());

  useEffect(() => {
    if (routeTemplate) installUmamiBeforeSend(routeTemplate);
  }, [routeTemplate]);

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
