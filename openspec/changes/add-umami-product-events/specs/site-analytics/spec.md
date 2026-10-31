## ADDED Requirements

### Requirement: Product events

The browser client SHALL record product events through the shared `@trustroots/analytics/client` entry point: components SHALL call `useAnalytics().track(name, data)` under the single `AnalyticsProvider` the app shell mounts, and SHALL NOT read the tracker from `window`. By default the provider hands each event to the loaded Umami tracker; tests pass their own tracker to the provider. Event names and data SHALL come from the package's typed event catalogue. Event data SHALL NOT contain usernames, email addresses, ids, locations, message content or other personal details. Events recorded before the tracker script has loaded SHALL be queued, up to a fixed limit, until the page `load` event. When the tracker is disabled, blocked or unavailable after load, events SHALL be dropped without affecting the feature that recorded them. Do-Not-Track and the tracker's opt-out SHALL apply to product events as they do to page views.

#### Scenario: Member completes a tracked action

- **WHEN** a member saves or removes an offer, signs in or fails to sign in, loads more inbox threads, previews an offer on the search map, opens a missing offer link or opens the rules from signup
- **THEN** the client sends the matching catalogue event to Umami without personal data

#### Scenario: Event recorded while the tracker loads

- **WHEN** a product event is recorded before the asynchronous Umami script has loaded
- **THEN** the event is queued and sent once the page has loaded and the tracker is available

#### Scenario: Tracker blocked or disabled

- **WHEN** an operator disables analytics, a browser blocks the Umami script, or the visitor sends Do-Not-Track
- **THEN** no product event is sent and the page behaves as without analytics

### Requirement: Server product events

The server SHALL send product events only through the `@trustroots/analytics/server` entry point, built on the official Umami Node client. It SHALL send nothing when `umami.enabled` is `false` or the request carries Do-Not-Track or Global Privacy Control. Delivery failures SHALL NOT reject or delay the request that recorded the event. Server events SHALL be limited to outcomes the browser cannot report and SHALL NOT be recorded for native app requests, whose analytics require separate consent.

#### Scenario: Request opts out of tracking

- **WHEN** a request that records a server product event sends `DNT: 1` or `Sec-GPC: 1`
- **THEN** no event is sent to Umami
