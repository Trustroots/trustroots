## Context

`HostOfferScreen` currently performs two sequential reads: it loads the signed-
in member profile, then loads that member's accommodation offer by member ID.
It decodes the offer's HTML descriptions into trimmed editable text, fills
defaults for missing fields, and establishes an original `HostOfferUpdate`
snapshot. The composable also owns the editable values, save request, error and
success text, and dirty-form decision state. Its menu destination is already a
separate Navigation 3 entry in the integrated shell.

The API-feedback implementation establishes the shared `UiFailure` adapter:
state retains a nonblank server message, optional `ApiFailureKind`, and a
fallback identity; Compose resolves the translated message from resources at
render time. This change uses that API rather than storing localised strings or
raw exception messages.

## Goals and non-goals

**Goals**

- Make Host offer request and form transitions deterministic and testable
  without Compose or an Android context.
- Keep the current editing and save behaviour, including safe retries and
  dirty-form Back decisions.
- Keep all API credentials outside ViewModel UI state and Navigation 3 keys.
- Preserve one load/save operation across configuration recreation, without
  replaying a request merely because the screen recomposes or its Activity is
  recreated.

**Non-goals**

- Changing the Host offer API, form fields, server validation or map/location
  behaviour.
- Adding persistence across process death. After process death, the existing
  live session is restored by the app and the Host offer entry may load again.
- Moving unrelated experience, account, map or menu business logic.

## Decisions

### Entry-scoped ViewModel and repository

Resolve `HostOfferViewModel` from the current Host menu Navigation 3 entry's
`ViewModelStoreOwner`, following the existing Circles and profile-entry
ownership pattern. The factory receives an injectable `HostOfferRepository`.
The production repository adapter may close over the current `MobileApiClient`
and live `MemberSession`, but neither value is copied into `HostOfferUiState`, a
`SavedStateHandle`, or a navigation key. The ViewModel owns cancellable load
and save jobs and cancels them when cleared with the entry.

The repository exposes a load operation that performs the existing sequence
`profile(username)` then `accommodationOffer(memberID)`. A missing profile ID
is a typed non-authentication load failure. A missing offer returns the current
new-offer defaults. A save operation accepts a complete `HostOfferUpdate` and
returns the persisted offer, including its server-assigned ID.

### HTML boundary and defaults

Decode both HTML description fields in the Android repository adapter (or a
small injectable description-decoder boundary) using the existing compact
`Html.fromHtml` semantics and trim the resulting text. The ViewModel receives
plain editable strings and contains no `Context` or Android rendering API.

Retain these defaults for both a missing offer and omitted API fields:

- availability `yes`;
- hosting description and not-hosting reason empty;
- maximum guests `1`;
- show-only-in-my-circles `false`;
- latitude `48.6908333333` and longitude `9.14055555556`.

The loaded form's original snapshot is the complete `HostOfferUpdate`,
including the offer ID. Dirty state remains a comparison of the current form
with that snapshot. Preserve validation: when availability is not `no`, the
trimmed hosting description must have at least five characters; the not-hosting
reason has no additional minimum. Preserve the current maximum-guests input
normalisation to digits and the inclusive 1–20 range.

### Save transaction and result state

The Save event captures one immutable `HostOfferUpdate` snapshot from current
state before starting the request. Ignore a second Save while that transaction
is active. On failure, keep the form and baseline intact, expose a `UiFailure`
with `HOST_OFFER_SAVE` fallback, and leave the form eligible for another
attempt. On success, store the returned offer ID and establish the original
baseline from the submitted snapshot with that returned ID. This prevents the
new form from appearing dirty because its ID was previously absent.

Store success as an identified transient status (or a boolean success marker),
not as translated text. Render it with
`stringResource(R.string.screen_host_offer_saved)`; clear it when editing
resumes or a new save starts. Error state likewise uses `UiFailure` and
`resolveFailureMessage()` with the existing XML load/save fallback resources.

### Authentication, retries and cancellation

Treat HTTP 401 from either profile load, offer load or save as session
invalidation. Emit one identified pending invalidation event and let the
existing parent callback acknowledge it; do not duplicate a callback if a
request or recomposition observes the same failure again. Other errors retain
their API kind and nonblank server message through the shared `toUiFailure`
adapter. Missing member ID uses the load fallback without a fabricated server
message.

Expose a Retry event for a failed initial profile/offer load. Retry reruns the
ordered load sequence and replaces the baseline only after both reads succeed.
It must not silently convert a failed read into a new offer with defaults.
Cancellation, an obsolete generation, or ViewModel clearing prevents a late
result from overwriting current state. Save remains non-cancellable by form
navigation while in flight, matching the existing guard; Activity recreation
retains the same ViewModel and therefore does not launch a duplicate save.

### Form leave behaviour

Keep the current `rememberFormCancel` / `rememberFormLeave` and shared leave
guard integration in Compose. Derive dirty state, validation and saving from
ViewModel state, then pass those values into the existing action bar and leave
guard. Toolbar Cancel, system Back, predictive Back and top-level navigation
must continue to ask before discarding edits, while a saving form blocks the
leave action. A cancelled predictive gesture must not mutate the form stack or
show a committed discard result.

## Risks and trade-offs

- A repository adapter owning the live session must be scoped no longer than
  the Host entry. The entry's ViewModel store and repository must be cleared
  together on removal or sign-out.
- Activity recreation preserves in-flight work through the retained ViewModel;
  process death does not. After process death the live session store can restore
  authentication and the form reloads from the server.
- Unit tests should inject the repository and description decoder so no
  network, Android `Context`, or real member data is needed.

## Verification

- Unit-test the ordered profile/offer load, normalization, defaults, dirty
  comparison, validation, retry, authentication event de-duplication,
  cancellation, stable save snapshot, duplicate-save suppression, returned ID,
  and failure recovery.
- Native Compose tests should exercise resource-rendered fallback/server
  messages and the existing keep-editing/discard decisions through form Back.
- A native Activity recreation journey should hold a load or save in flight,
  recreate the Activity, and verify that state is restored and the repository
  saw exactly one request/save.
