## Why

`MemberProfileViewModel` currently coordinates six independently cancellable
operations with three freshness counters, job references, and post-request
generation checks. The counters duplicate request ownership and make it harder
to prove that replacement, environment changes and entry removal cancel the
right work. A small request-slot abstraction can own each operation's current
job while retaining cancellation and stale-result guarantees.
Other Android ViewModels repeat the same lifetime bookkeeping. Extend the
pattern after validating the member-profile pilot, while retaining revisions
that represent independent query or membership changes.

## What Changes

- Add an internal `LatestRequest` owner for one replaceable coroutine job.
- Publish a replacement job before cancelling the previous job or starting the
  replacement, so synchronous cancellation callbacks and request re-entry
  cannot make older work current.
- First migrate `MemberProfileViewModel`'s load, removal, explicit reference
  refresh, block-status, block-update and report jobs to request slots.
- Apply the validated pattern to replaceable requests in account settings,
  profile editing, experience creation, contacts, inbox, host detail, host
  offers, host maps, member search, conversations, circles, circle detail and the member shell.
- Keep initial-load reference fetching as a child of the initial load request;
  explicit reference refresh remains a separate request slot.
- Preserve `requestResult` as the cancellation boundary and keep session
  invalidation latches independent from request cancellation.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: preserve Android request cancellation,
  supersession and stale-response behaviour while consolidating job ownership.

## Impact

Internal Android coroutine ownership and JVM unit tests only. No user-visible
behaviour, API, navigation, persistence, or dependency changes. Existing
session invalidation delivery and request ordering remain unchanged. The
validation target is the Android JVM unit suite; an end-to-end test is not
appropriate for an internal request-lifetime refactor.
