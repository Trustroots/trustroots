## Implementation

- [x] Add typed serialisable SignIn and browser route keys with unique visit
      identities and purpose-only browser data.
- [x] Host the signed-out stack with the existing Activity-retained destination
      holder and standard Navigation 3 entry decorators.
- [x] Obtain the sign-in ViewModel from the actual decorated root entry; cancel
      and reject stale authentication when the entry is cleared, and clear it
      on successful login or backend change.
- [x] Remove browser selection from `SignInScreen`; preserve its form API for
      focused tests and route browser Back through WebView history first.
- [x] Move remaining SignIn copy and browser titles into localised Android
      string resources.

## Tests and validation

- [x] Add unit coverage for cancellation, stale results and single success
      delivery without saving credentials in route state.
- [x] Add Android journeys for signup and password-reset origins, WebView Back,
      recreation and Back, backend-change cleanup, locale labels, and successful
      authentication with no retry.
- [x] Run focused Android unit/instrumentation checks and repository checks.
