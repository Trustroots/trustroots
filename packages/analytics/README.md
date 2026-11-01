# @trustroots/analytics

Product events for the self-hosted Umami service. Event names and the data each may carry are listed in `shared/events.ts`; keep that data free of personal details such as usernames, email addresses, ids, locations and message content.

- `@trustroots/analytics/client`: `<AnalyticsProvider>`, mounted once in the app shell, and `useAnalytics().track(name, data)` in components. By default the provider sends events through the Umami tracker script the page layout loads; `client/umami.ts` is the only code that reads `window`. Tests and stories pass `<AnalyticsProvider tracker={fake}>` instead of mocking `window`. The tracker honours Do-Not-Track, the `umami.disabled` opt-out and `umami.enabled: false`. Events sent while the script loads are queued until the page `load` event; otherwise a missing tracker drops them.
- `@trustroots/analytics/server`: `createServerAnalytics(options).track(headers, name, data)` on the server, through `@umami/node`. It skips requests with Do-Not-Track or Global Privacy Control. Prefer browser events; use the server only for outcomes the browser cannot report, and never for requests from the native apps, which have their own consent.

Client code must not import `./server`, and server code must not import `./client`; the runtime boundary guard enforces this.
