/**
 * Server product events, sent to Umami's `/api/send` endpoint through the
 * official `@umami/node` client. Use it only for events the browser cannot
 * report; browser events go through `@trustroots/analytics/client`.
 */
import { Umami } from '@umami/node';
import type {
  AnalyticsEventArgs,
  AnalyticsEventName,
} from '../shared/events.ts';

export type ServerAnalyticsOptions = {
  /** `umami.enabled` from the application configuration. */
  enabled?: boolean;
  /** Origin of the Umami service, e.g. `https://1p.trustroots.org`. */
  hostUrl: string;
  /** `umami.websiteId` from the application configuration. */
  websiteId: string;
  /** Host name the events are recorded under, e.g. `www.trustroots.org`. */
  hostname: string;
};

export type RequestHeaders = Record<string, string | string[] | undefined>;

export type ServerAnalytics = {
  /**
   * Record a product event for a request. Resolves once delivery has been
   * attempted and never rejects; skipped when analytics is disabled or the
   * request asks not to be tracked.
   */
  track<Name extends AnalyticsEventName>(
    headers: RequestHeaders,
    name: Name,
    ...args: AnalyticsEventArgs<Name>
  ): Promise<void>;
};

function headerValue(headers: RequestHeaders, name: string): string {
  const value = headers[name];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

/** Whether the request sends Do-Not-Track or Global Privacy Control. */
export function requestsNoTracking(headers: RequestHeaders): boolean {
  return (
    headerValue(headers, 'dnt') === '1' ||
    headerValue(headers, 'sec-gpc') === '1'
  );
}

export function createServerAnalytics(
  options: ServerAnalyticsOptions,
): ServerAnalytics {
  const client =
    options.enabled === false
      ? undefined
      : new Umami({ hostUrl: options.hostUrl, websiteId: options.websiteId });

  return {
    async track(headers, name, ...[data]) {
      if (!client || requestsNoTracking(headers)) return;
      try {
        await client.track({
          website: options.websiteId,
          hostname: options.hostname,
          name,
          ...(data === undefined ? {} : { data }),
        });
      } catch {
        // Analytics delivery must never break the request that reports it.
      }
    },
  };
}
