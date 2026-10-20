## Why

The Android member-profile screen currently keeps Edit Profile and Experience
creation inline. Their forms, save requests, failures and leave decisions are
owned by composable-local state, so the forms have no stable business-state
owner when Navigation 3 entries are introduced. Moving these flows to real
profile/menu child entries with entry-scoped ViewModels preserves edits across
Activity recreation, keeps Back tied to the actual origin, and makes save,
failure and authentication behavior independently testable.

## What Changes

- Give Edit Profile and Experience creation their own typed Navigation 3 child
  entries and separate entry-scoped ViewModels with immutable state, explicit
  events and injectable repositories.
- Route the own-profile Edit action to a child Edit entry, and make the direct
  Menu Edit destination an actual Menu stack entry rather than opening a
  nested profile screen in edit mode.
- Retain the existing profile entry underneath child routes, update the shell
  and parent profile state after a successful edit, and refresh profile
  references after a successful Experience submission.
- Preserve dirty-form confirmation for toolbar Cancel, system/predictive Back
  and navigation away; saving blocks departure and duplicate submission.
- Keep live session credentials in repository dependencies only. Store only
  public resource identifiers and visit IDs in route keys. Preserve form
  values through Activity recreation, while process-death route restoration
  reloads a clean canonical form as it does today.
- Keep inline Conversation and contact-add browser behavior for a separate
  focused route migration; do not add fake owners or broaden this slice.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: specify route-owned profile forms, restoration,
  dirty-form Back behavior, credential-safe state and profile refresh behavior.

## Impact

- Android profile and Menu navigation and form screens under `apps/android`.
- New Edit Profile and Experience ViewModels, injectable API repositories,
  deterministic unit tests and native Android Navigation 3 journeys.
- No server/API contract, persistent data, web or iOS changes. Session
  credentials remain runtime-only; unsaved drafts remain non-persistent across
  process death.
