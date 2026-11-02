import React, { type ReactNode } from 'react';
import { AnalyticsProvider } from '@trustroots/analytics/client';

/**
 * A fake analytics tracker and a render wrapper that provides it, so component
 * tests assert on recorded events without touching the Umami script.
 */
export function fakeAnalytics() {
  const tracker = { track: jest.fn() };

  function wrapper({ children }: { children: ReactNode }) {
    return <AnalyticsProvider tracker={tracker}>{children}</AnalyticsProvider>;
  }

  return { tracker, track: tracker.track, wrapper };
}
