## Why

Member-facing search, circle discovery, contacts and messages use different
loading, empty and failure presentations. Some failed requests cannot be
retried, and loading or error announcements are inconsistent for assistive
technology.

## What Changes

- Give asynchronous content states a consistent heading and explanation while
  retaining wording specific to each screen.
- Use the existing web, Android and iOS status, empty-content and alert
  primitives.
- Provide an accessible retry action when a list or search request fails.
- Keep successful empty results distinct from failed requests.

## Capabilities

### Modified Capabilities

- `offers-and-search` gains consistent accessible loading, empty and retryable
  failure states for member search.
- `circles` gains consistent accessible loading, empty and retryable failure
  states for circle discovery.
- `relationships-safety` gains consistent accessible loading, empty and
  retryable failure states for contact lists.
- `messaging` gains consistent accessible loading, empty and retryable failure
  states for inbox and conversation content.

## Impact

This affects member-facing search, circles, contacts and messages in the web,
Android and iOS clients. It changes presentation and retry behaviour only; API
contracts and stored data are unchanged.

Tracks [#3629](https://github.com/Trustroots/trustroots/issues/3629).
