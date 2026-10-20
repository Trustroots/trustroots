## 1. Entry routes and current ownership

- [x] 1.1 Add a serialisable `MemberProfileEditVisit(username, visitID)` route
      under the active profile visit and a real `MenuEditProfileVisit` for the
      direct Menu action.
- [x] 1.2 Add a serialisable `MemberProfileExperienceVisit(memberID, visitID)`
      route under the active profile visit; resolve its label from the retained
      profile state.
- [x] 1.3 Apply the existing saveable-state and ViewModel-store decorators to
      each destination and remove the edit/experience inline selectors and
      `startInEditMode` route workaround.
- [x] 1.4 Keep Conversation and contact-add browser selectors unchanged and
      document them as separate follow-up route slices.

## 2. Edit Profile state and API

- [x] 2.1 Add an injectable Edit Profile repository and entry-owned
      `EditProfileViewModel` with immutable baseline, field, language, dirty,
      saving, typed-failure and invalidation state.
- [x] 2.2 Add explicit field/language/save/invalidation events; preserve
      description normalisation, language behavior, save payload and
      render-time error resolution.
- [x] 2.3 Retain in-memory form state through Activity recreation without
      persisting unsaved drafts across process death; cancel or reject stale
      save results after entry removal.
- [x] 2.4 Preserve the shared `LocalLeaveGuard` for toolbar Cancel, system and
      predictive Back, and shell navigation. Keep discard action transient,
      execute it once, and block departure while saving.
- [x] 2.5 On successful save, update shell member presentation, update the
      retained profile entry, and pop the edit destination exactly once.

## 3. Experience state and API

- [x] 3.1 Add an injectable Experience repository and entry-owned
      `CreateExperienceViewModel` for the existing defaults, form fields,
      dirty/saving state, typed failure and invalidation event.
- [x] 3.2 Preserve `ExperienceCreate` payload and validation, reject duplicate
      submission, retain form state across Activity recreation, and discard
      unsaved values after process death.
- [x] 3.3 Apply the same shared dirty-form guard to Cancel, system/predictive
      Back and shell navigation; saving blocks departure.
- [x] 3.4 On successful submission, pop once and refresh the retained profile
      references through its existing ViewModel.

## 4. Regression coverage

- [x] 4.1 Add fake-repository tests for Edit baseline, field/language changes,
      dirty state, payload, failure retry, success, auth acknowledgement,
      cancellation and stale completion.
- [x] 4.2 Add fake-repository tests for Experience defaults, validation,
      payload, duplicate submit, failure retry, success, auth acknowledgement,
      cancellation and stale completion.
- [x] 4.3 Add native Navigation 3 journeys for Menu Edit and profile Edit,
      Activity recreation, dirty Back keep/discard, save success/failure,
      profile and shell refresh, and return to the exact origin.
- [x] 4.4 Add native journeys for Experience recreation, dirty Back,
      duplicate-submit protection, failure retry, successful return/reference
      refresh, and a real-shell expired-session flow that clears the account
      stores before a same-account login starts with fresh form state.
- [x] 4.5 Verify repeated visits to the same username have separate ViewModel
      stores and that removing one entry cancels its work without clearing the
      retained parent profile or another visit.

## 5. Validation and completion

- [x] 5.1 Run relevant Android unit/instrumentation tests, lint and debug build.
- [x] 5.2 Update `native-android-member-app`, validate the completed change and
      archive the proposal after implementation and verification.
