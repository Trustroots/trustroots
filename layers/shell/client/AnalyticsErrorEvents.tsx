import { useEffect } from 'react';
import { useAnalytics } from '@trustroots/analytics/client';

import { onRequestFailure } from '@/modules/core/client/api/http-client';

/**
 * Report failed API requests and uncaught browser errors as coarse product
 * events: the status, method and API area of a request, or the kind of
 * error. Messages, stack traces and URLs are never sent.
 */
export function AnalyticsErrorEvents() {
  const { track } = useAnalytics();

  useEffect(() => {
    const unsubscribe = onRequestFailure(failure =>
      track('api_request_failed', failure),
    );
    const onError = () => track('client_error', { kind: 'error' });
    const onUnhandledRejection = () =>
      track('client_error', { kind: 'unhandled_rejection' });

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      unsubscribe();
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [track]);

  return null;
}
