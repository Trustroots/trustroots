## Context

`MemberProfileScreen` currently selects Edit Profile and Experience creation
with inline booleans. `EditProfileScreen` receives a loaded profile and owns
form fields, saving and error state in Compose. Direct Menu Edit is represented
by `MenuPage.EditProfile`, but it also opens `MemberProfileScreen` with
`startInEditMode=true`. `CreateExperienceScreen` owns its form and submission
in Compose. Both forms share `rememberFormLeave` through the shell's
`LocalLeaveGuard`.

The profile navigation slice now represents each profile as a decorated
`MemberProfileVisit(username, visitID)` and its real entry owns a
`MemberProfileViewModel`. This change builds on that route and store. It does
not wrap a screen in another `ViewModelStoreOwner` and does not change the
inline Conversation or browser selectors.

## Decisions

- Add `MemberProfileEditVisit(username, visitID)` under the active profile
  visit. Add `MenuEditProfileVisit(username, visitID)` as a direct Menu child
  route. Remove the `MenuPage.EditProfile` path that opens an entire profile
  screen solely to show the editor.
- Add `MemberProfileExperienceVisit(memberID, visitID)` under the active
  profile visit. Resolve the display label from the retained profile entry at
  render time; do not put a name, profile object, translated text, form data,
  API response or cookie in a route key.
- Give each entry an independent `EditProfileViewModel` or
  `CreateExperienceViewModel`, created from its actual Navigation 3 entry
  owner. Each accepts an injectable repository that receives the current
  `MemberSession` only at runtime. Repository API/session dependencies update
  when the retained entry receives a new runtime environment; Compose must
  retrieve the ViewModel by its stable entry owner and resource ID, not by API
  or session object identity. A replacement API client for the same normalized
  backend updates the repository without reloading or repeating a mutation.
  A same-account cookie rotation cancels and invalidates work started with the
  old cookie, retains the in-memory draft, clears the old auth latch, and
  allows an explicit user retry; it never automatically resubmits an
  Experience POST. An account or backend change cancels work and clears the
  old form. Edit reloads the canonical profile only when the current account
  still matches the route username; it remains blank otherwise. Generation
  checks prevent late results from mutating an entry or invalidating a newer
  account.
- Keep Edit Profile's existing HTML-to-plain-text description baseline,
  profile update payload, language set semantics, localized rendering and
  `SAVE_PROFILE` fallback. Keep Experience's defaults, validation, exact
  `ExperienceCreate` payload, and `SHARE_EXPERIENCE` fallback. ViewModels
  retain typed failure metadata, not translated strings or arbitrary
  exception messages.
- Keep form drafts in ViewModel memory so Activity recreation retains them.
  Do not put drafts in `SavedStateHandle` or persistent storage; if Android
  restores only the route after process death, load the canonical profile or
  a clean default Experience form. The current UI loses unsaved drafts after
  process death, so this does not change persistence behavior.
- Keep `rememberFormLeave` as the single active `LocalLeaveGuard`. The active
  form's Cancel action, its BackHandler, and shell navigation all use the
  same guard. A pending discard dialog/action is transient and is never route
  data or ViewModel state. Confirming discard executes the pending navigation
  exactly once; saving prevents leaving and prevents duplicate submit.
- On successful Edit, update the shell's `MobileMember`, notify the retained
  parent `MemberProfileViewModel` with the saved profile (or an explicit
  refresh event), and pop the child exactly once. On successful Experience
  creation, pop once and refresh the retained profile references through its
  existing ViewModel. Do not create a second parent-profile owner for these
  handoffs.
- A 401 or other existing authentication failure emits one identified
  invalidation event. Compose resolves that event through the existing shell
  callback and acknowledges it; the account-scoped shell then clears all
  entry stores. Check request generation before dispatching auth invalidation.
  Until the shell removes the entry, the form blocks further submission after
  that event is acknowledged. A changed same-account session renews the auth
  latch while retaining the draft.
- Conversation and contact-add browser remain in their current composable
  state for this slice. Their actual route keys, draft owner and WebView entry
  state are specified in a separate follow-up; do not use an owner wrapper as
  a placeholder here.

## Validation

Unit tests use anonymous fake repositories to cover edit field updates and
dirty state, language toggles, save payload, retryable failure, success and
auth-once acknowledgement; Experience defaults, validation, payload,
duplicate-submit prevention, failure retry, success and auth-once
acknowledgement; stale responses and clearing one visit without affecting
another visit to the same member.

Native journeys cover the real Menu Edit and profile Edit origins, Activity
recreation, toolbar/system/predictive Back leave decisions, keep/discard,
success callbacks and return position, expired-session cleanup, and late
responses after entry removal. Conversation and browser journeys remain in
their existing suites and are not claimed as migrated by this change.
