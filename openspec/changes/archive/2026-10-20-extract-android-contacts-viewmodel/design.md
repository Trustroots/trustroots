## Context

The Contacts menu page is currently held by one Navigation 3 `MemberTabVisit`.
`ContactsScreen` runs a profile request for the signed-in member, uses the
returned member ID to load contacts, and keeps the selected contact profile as
a presentation overlay. Loading and errors currently live in Compose state.

## Decisions

### Repository and state ownership

Use an injectable repository with two operations: load the signed-in member's
profile and load that member's contacts by the profile ID. The ViewModel
coordinates those operations and exposes an immutable state containing the
contacts, loading status, whether an attempt completed, and a typed failure
identity with optional server-provided text. It does not hold resolved or
translated UI strings.

Obtain the ViewModel through the current Navigation 3 entry's
`LocalViewModelStoreOwner`. The repository receives the current API client
and session at construction and keeps them only in memory. Navigation keys and
ViewModel state contain no session credentials.

### Requests, retries and authentication

Start one load when a new Contacts ViewModel is created. A Retry event starts
a new generation, cancels the prior job and clears the previous failure.
Ignore any response that no longer belongs to the active generation. Entry
removal cancels the ViewModel scope and clears its state.

Represent a 401/403 as a typed, one-shot session invalidation event; Compose
acknowledges delivery after invoking the existing session callback. Other
failures keep their failure identity and optional exception/server metadata
in state. Compose resolves a server message when available and otherwise uses
an Android string resource for the existing “Could not load contacts.” copy.

### Existing presentation and Back behaviour

Keep selected contact username in the existing Compose presentation state and
continue to render `MemberProfileScreen` in place. Returning from that profile
reveals the same contacts state and does not submit another successful list
request. A failed request exposes an explicit retry button. This does not add
profile routes or change Contacts navigation behaviour.

## Risks and mitigations

- A failed profile-ID lookup must not request contacts. Model it as the same
  typed Contacts fallback and cover the absence of a contacts request.
- A late profile or contacts response can overwrite a retry. Use generation
  checks in the ViewModel and test stale completion.
- Authentication failure can be observed more than once across recomposition.
  Keep a single pending event and acknowledge it after the callback.
- A retained ViewModel could leak data between repeated menu visits. Use the
  Navigation 3 entry owner and verify a removed entry clears its state.
