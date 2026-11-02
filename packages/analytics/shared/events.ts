/**
 * Every product event Trustroots sends to Umami, with the data it may carry.
 *
 * Event data describes what happened, never who did it: no usernames, email
 * addresses, ids, locations or message content. Values are short strings or
 * numbers so the browser tracker and the server client accept the same data.
 */
export type AnalyticsEvents = {
  'inbox-load-more': { page: number };
  'offer-save': {
    type: 'host' | 'meet';
    action: 'create' | 'update';
    status?: 'yes' | 'maybe' | 'no';
  };
  'offer-delete': { type: 'host' | 'meet' };
  'search-offer-preview': undefined;
  'search-offer-not-found': undefined;
  'signin-success': undefined;
  'signin-failure': undefined;
  'signup-rules-open': undefined;
};

export type AnalyticsEventName = keyof AnalyticsEvents;

export type AnalyticsEventData = Record<string, string | number>;

/** Event data as call arguments: required when the event has data, absent when it has none. */
export type AnalyticsEventArgs<Name extends AnalyticsEventName> =
  AnalyticsEvents[Name] extends undefined ? [] : [data: AnalyticsEvents[Name]];
