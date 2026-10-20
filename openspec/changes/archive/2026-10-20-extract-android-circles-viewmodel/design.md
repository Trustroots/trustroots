## Context

`CirclesScreen` currently performs two initial API reads (circle catalogue and
memberships), joins/leaves circles, derives a filtered/sorted list and switches
between overview and detail. Each is Compose-local state or work started from
the composable. A temporary tab visit can therefore discard loaded data and
filter text. In the Navigation 3 foundation, each `MemberTabVisit` receives an
entry-owned `ViewModelStore`; its lifetime follows that visit as it moves on
and off the back stack.

The shell also supports explicit reselect of an active top-level tab. Today
that increments `circlesNavigationID` and remounts the composable. Reusing the
same NavEntry keeps the same ViewModel, so Circles reselection must replace
that active `MemberTabVisit` with a new unique visit. The Navigation 3 entry
decorator then clears the old ViewModel and the new visit loads fresh data.

## Goals and non-goals

**Goals:**

- Keep circle data, memberships, filter and selected detail with one Circles
  navigation entry while it is retained off-stack.
- Clear entry-owned work and state when Navigation 3 removes that entry.
- Clear account-scoped state on sign-out or account replacement.
- Preserve loading, errors, join/leave behaviour and the parent-owned session
  invalidation callback.
- Make API operations and account scope replaceable in ViewModel unit tests.
- Keep the Compose UI focused on rendering and forwarding user actions.

**Non-goals:**

- Changing circle API contracts, sorting/filtering semantics, layout,
  accessibility copy or description rendering.
- Persisting circles or filters across process death or across accounts.
- Introducing an Activity-scoped or app-global Circles ViewModel.
- Creating ViewModels for stateless sub-composables.

## Decisions

### Use the Navigation 3 entry as the ViewModel owner

Obtain the Circles ViewModel from the current Navigation 3 entry owner made
available by `rememberViewModelStoreNavEntryDecorator` and the
`lifecycle-viewmodel-navigation3` 2.10.0 dependency in the foundation. Do not
use `ViewModelProvider(activity)` or a shared key: an
Activity-global store would allow state from one Circles visit or account to
leak into another. Removing a `MemberTabVisit` must clear its store and cancel
its ViewModel scope.

The signed-in shell owns the account dependency and tears down when sign-out
clears the session. Build the ViewModel through a factory that receives the
current account-scoped repository/session dependencies. Session cookies may be
held only as in-memory request dependencies; they are never part of
`CirclesUiState`, saved state, navigation keys, or persisted state.

### Separate state, events and API operations

Expose an immutable `CirclesUiState` through `StateFlow`. It contains the
catalogue, membership IDs, filter text, selected circle ID or model, loading
and update indicators, a displayable error, and an identified pending
authentication-invalidation event. Expose one event handler for filter edits,
circle selection, Back, membership toggle, retry and acknowledgement of the
invalidation event.

Inject a small circle repository interface for catalogue, memberships and
membership mutation operations. Its production implementation delegates to
the existing `MobileApiClient`; tests use a deterministic fake. The
ViewModel owns filtering and sorting (including searchable plain-text
descriptions) so the composable only renders state. Preserve the existing
error messages and do not turn failed reads into empty results.

### Guard asynchronous work and deliver authentication failure once

Launch requests in `viewModelScope`, propagate cancellation, and check that a
request still belongs to the active load/update generation before applying
its result. A request from an old account, earlier retry, or removed entry
must not overwrite newer state. Prevent overlapping membership writes as the
current UI does. Authentication failures create a uniquely identified pending
event; Compose calls the existing `onSessionInvalidated` callback and then
acknowledges that event so recomposition cannot deliver it repeatedly.

### Preserve off-stack state and reset on active-tab reselection

The ViewModel retains the successful catalogue, membership set, filter and
selected detail as long as its `MemberTabVisit` remains in the Navigation 3
back stack. Returning to the visit shows that state without duplicate initial
requests. When the shell explicitly reselects the active Circles tab, it
replaces that visit with a new unique `MemberTabVisit`. That removes the old
entry store and creates a fresh ViewModel whose initial load fetches catalogue
and memberships. A navigation to Circles from another tab already creates a
new visit; Back to an earlier Circles visit retains that earlier entry's
state. Back from detail only clears the selected detail and keeps the filter,
matching current behaviour.

### Keep the screen composable presentational

`CirclesScreen` collects immutable UI state, forwards control events and
renders the existing overview/detail components. It retains Compose-owned
scroll behaviour, shell padding, artwork URL construction, BackHandler and
the parent callback. The overview/detail leaf composables receive state and
callbacks only; they do not acquire ViewModels.

## Validation approach

Add meaningful unit tests using an injected fake repository for initial loads,
filter/sort derivation, join and leave success/failure, retry, cancellation or
stale-result rejection, authentication-event acknowledgement and account-scope
isolation. Extend native journeys to
verify that a temporary Navigation 3 tab departure and return retains loaded
data/filter/detail without another read, removing an entry clears the store,
explicit reselection resets and reloads, membership still updates, and Back
returns to the filtered overview. Include a recreation journey to verify that
the entry owner preserves the active Circles visit across configuration
recreation without persisting credentials. Reuse anonymous circle fixtures
and existing API failure journeys. Run Android checks only after the parent
integrates and verifies the Navigation 3 foundation.
