## Context

`TrustrootsApp` already retains a `SignInDestinationStoreHolder` in the
Activity, but `SignInScreen` keeps browser selection in local Compose state
and obtains its ViewModel from the holder rather than from its Navigation 3
entry. Successful authentication clears the holder. The form fields and
request are retained through Activity recreation, while the signup and
forgot-password pages have no saved route identity or shared Back ordering.

## Decisions

Use a signed-out Navigation 3 stack rooted at `SignInVisit`. Push a distinct
`SignInBrowserVisit(purpose, visitID)` for SignUp and ForgotPassword; the
purpose is a closed enum and is the only content identifier. Derive localized
browser titles and the existing HTTPS URLs from the purpose at render time.
The browser entry uses the existing browser content, so Back traverses its
WebView history before popping to the exact form entry.

The Activity-retained `SignInDestinationStoreHolder` is the stack container
and survives configuration recreation. The `SignInVisit` itself uses the
standard Navigation 3 saveable-state and ViewModel-store decorators. Its
ViewModel receives the configured API base URL and authentication adapter at
creation. The destination store is cleared after authentication succeeds and
when the configured backend identity changes. Removing the sign-in entry
cancels its ViewModel scope; generation checks prevent an obsolete result
from changing state or delivering authentication after removal.

Route keys contain no form values, API response, `MemberSession`, cookie,
username or password. Activity recreation may retain the in-memory form and
current request via the Activity's ViewModel store, but process restoration
recreates a clean sign-in entry. The existing authentication endpoint and
success handoff remain unchanged, and successful login is never automatically
replayed.

Keep `SignInScreen` as a reusable form renderer for focused Compose tests, but
remove its browser state and browser content slot. The real application route
host owns navigation and passes only a signed-in callback to the form.

## Validation

Unit tests cover submission deduplication, cancellation on clear, stale result
rejection and once-only success delivery. Android journeys cover signup and
forgot-password origins, WebView-history Back, route restoration and Back
after Activity recreation, successful credential retention without a second
request, backend-change cleanup, and the absence of secrets from serialized
route state. Resource assertions run with English and a non-English device
locale and verify localized labels and browser titles.
