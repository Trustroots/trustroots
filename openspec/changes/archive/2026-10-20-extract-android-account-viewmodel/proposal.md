## Why

`AccountSettingsScreen` currently owns account loading, email/newsletter edits,
password changes, alert settings, update checks and transient result state in
Compose. Those operations can be restarted or become stale as the Menu
Navigation 3 destination is recreated, while the same screen also crosses an
important boundary between account data and Android permission, notification
and external-activity APIs. Giving the Account page one entry-owned state
owner makes its current behaviour testable across lifecycle changes without
putting Android objects or credentials into navigation state.

## What Changes

- Give each `MenuPageVisit(MenuPage.Account, visitID)` an
  `AccountSettingsViewModel` from that decorated Navigation 3 entry's
  `ViewModelStoreOwner`.
- Move account-details loading, email/newsletter drafts and saving, password
  form validation/change, message-alert and preview-update state, update-check
  work, sign-out sequencing, dirty/busy derivation and API error identities
  into that ViewModel, backed by injectable repositories and platform ports.
- Keep permission launchers, the Activity required to choose a UnifiedPush
  distributor, Compose discard-dialog rendering and opening a release URL in
  the UI adapter. Represent their requests and outcomes as identified typed
  effects/events so Activity references never enter the ViewModel and effects
  are not replayed after Activity recreation.
- Keep translated labels in resources and resolve typed statuses/errors in
  Compose. Keep the existing Usage Analytics preference component as its
  separate preference owner.
- Retain the Account entry's non-secret drafts while it remains on the Menu
  back stack and across Activity recreation. Do not place the session cookie,
  password fields, email drafts, account response or platform state in a route
  key, `SavedStateHandle`, saved-state bundle or persistent storage. Clear
  password fields after a successful change and when the Account ViewModel is
  cleared.
- Preserve the current Account page, reset-password child browser, sign-out,
  notification permission and email/password semantics; add anonymous unit
  and native lifecycle coverage.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: specify Account-page entry ownership, safe
  lifecycle retention, account and platform-setting event handling, and
  permission/external-activity boundaries.

## Impact

- Affects `AccountSettingsScreen`, `MenuNavigationDisplay` and Android account
  state/tests under `apps/android`.
- Adds no server endpoint, database migration or web/iOS behaviour change.
  The existing protected account APIs, Android notification services and
  preview-update checker remain the backing operations. The Account page is
  already a decorated `MenuPageVisit`; no navigation-route migration is
  required.
