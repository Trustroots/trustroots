# Send product events to Umami

## Why

The browser client still reports product events, such as saving an offer or signing in, through `trackEvent()`, which calls Google Analytics' `window.ga`. Google Analytics is no longer loaded, so every event is dropped. Umami already runs on the site but receives page views only.

## What changes

- Add a private source-only `@trustroots/analytics` workspace package with separate `./client` and `./server` entry points and a shared, typed event catalogue.
- `./client` exports `<AnalyticsProvider tracker?>` and `useAnalytics()`, whose `track(name, data)` is typed by the event catalogue. The app shell mounts the provider once. By default it uses a tracker that hands events to the Umami script the layout already loads; that adapter is the only code that reads `window`. Events sent while the script loads are queued, up to a limit, until the page `load` event. If the tracker is disabled, blocked or unavailable, events are dropped silently. Tests pass a fake tracker to the provider instead of mocking `window` or the package.
- `./server` exports `createServerAnalytics(options)`, built on the official `@umami/node` client. It respects `umami.enabled`, Do-Not-Track and Global Privacy Control and never rejects. No server events are added in this change.
- Move the ten existing `trackEvent()` calls in the inbox, offers, search, sign-in and signup pages to `useAnalytics().track()` with new event names. Their data carries no usernames, email addresses, ids, locations or message content. Delete `trackEvent()`.
- Extend the runtime boundary guard to treat `client`, `server` and `shared` folders in shared packages as runtime tiers, as it already does for modules.

## Why no server events yet

The tracker sends events with `fetch` `keepalive`, so they survive the page navigation that follows saving an offer or signing in. Recording the same outcomes on the server would also count API requests from the native apps, whose analytics are opt-in. It would also bypass the tracker's `umami.disabled` opt-out and attribute every event to the server's address. The server entry point exists for future outcomes that the browser cannot report.

## Scope

Page views, the Umami script tag, the content security policy and the native app analytics are unchanged. Google Analytics leftovers outside `trackEvent()` (the `window.ga` type, test guards) are removed separately.
