# Expand Umami product events

## Why

Umami receives page views and a handful of product events, so it cannot show where members drop out of signup, how many would-be guests the profile-length rule stops, which surface turns browsing into a first message, where searches find nobody, or what members need support for. Its Performance view is empty because the tracker script only collects Web Vitals when asked to.

## What changes

- Grow the typed catalogue in `@trustroots/analytics/shared/events.ts` to 37 events, each tied to a question in `docs/analytics.md`: the signup, email confirmation, sign-in and password funnels, profile completion, offers, search (including searches with no results), reaching out (first messages and contact requests with their `source`, and the message gate), circles, support by category, language switching, navigation and errors. The catalogue gains a runtime description map, `ANALYTICS_EVENTS`, whose mapped type keeps it exhaustive. Languages and navigation items are fixed lists.
- Rename the existing events from kebab-case to snake_case `<object>_<past-tense verb>` names (for example `signin-failure` becomes `signin_failed`), and drop `inbox-load-more`.
- Report unexpected failed API requests (`api_request_failed`) with only the HTTP status, method and first API path segment, and uncaught errors (`client_error`) with only their kind. Requests without a response and statuses a request lists in `expectedStatuses` are skipped. The unread-count poller catches its own failures.
- Give each feature failure event a `reason` from a fixed list, read from the HTTP status only: sign-in (`credentials`, `suspended`, `rate_limited`, `server`), email confirmation and password reset links (`invalid_link`, plus `rate_limited` for resets, `server`), messages (`rate_limited`, `other`), and profile and offer saves (`validation`, `server`).
- Fix the failure paths the events exposed: removing a contact, leaving a circle and saving the language no longer leave the UI stuck or raise unhandled rejections.
- Add `data-performance="true"` to the Umami script tag, so the tracker sends Web Vitals (LCP, INP, CLS, FCP, TTFB) for the Performance view.
- Document every event, its data, when it fires and the question it answers in `docs/analytics.md`; a unit test keeps the docs and the catalogue in step.

## Not included

- Events the database, statistics module or admin pages already answer: blocks, reports, contact confirmations and removals, experiences, reference votes.
- Events that duplicate page views or drive no decision: sign-out, profile tabs, the inbox's next page, map base layer, clearing filters, experience change requests, unblocking, and per-feature `_failed` events already counted by `api_request_failed`.
- Reply rate, which comes from the database (`MessageStat.firstReplyCreated`).

## Privacy

Event data stays coarse: enum-like strings from fixed lists, small counts and HTTP statuses. No usernames, email addresses, ids of any member or record, free text, message content, place names or coordinates. The outreach source keeps the other member's username in the tab's `sessionStorage` only, to match the later send; it is never sent. Do-Not-Track and the tracker's opt-out apply to every event and to Web Vitals, as before.

This change depends on the URL scrubbing change (#3543, branch `fix/umami-route-templates`), which replaces usernames, ids and tokens in the page URLs Umami stores with route templates. Without it, the page URL attached to each event would identify members.

## Compatibility

Umami keeps the old event names in its history; dashboards built on them need the new names. No server, data or deployment changes. The Performance view needs an Umami version whose tracker supports `data-performance`; the instance at 1p.trustroots.org already serves such a tracker.
