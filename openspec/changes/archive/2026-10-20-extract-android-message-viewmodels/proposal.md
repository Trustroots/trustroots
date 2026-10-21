## Why

The Android inbox and conversation currently keep network requests, loaded data,
filters, drafts and send state in Compose-local state. Opening a conversation
replaces the inbox content, which makes the two screens share one state
boundary and complicates restoration, cancellation and account changes. Moving
each screen's business state into a Navigation 3 entry-scoped ViewModel will
preserve inbox and conversation work for the life of their routes while making
transport and failure behaviour independently testable.

## What Changes

- Deliver the Inbox ViewModel as an independently reviewable first slice,
  followed by a separate Conversation ViewModel slice. Each uses immutable
  state, explicit events and an injectable repository; neither model owns or
  reads the other model's state.
- Scope the Inbox ViewModel to the Navigation 3 `Inbox` route entry and the
  Conversation ViewModel to its `Conversation(memberId)` route entry. Keep the
  inbox below the conversation so Back reveals the same filtered inbox and a
  popped conversation releases its own ViewModel store.
- Preserve inbox pagination, filtering, refresh on return from a conversation,
  message loading, quick-reply eligibility, sending, retryable transport
  failures and the existing account-scoped draft persistence.
- Resolve a Conversation recipient from its stable member ID through the
  existing authenticated `GET /api/users/mini/:userId` endpoint, independently
  of Inbox state; store a public username on profile route keys.
- Cancel or reject stale work when a route is removed or the live session
  changes, and deliver acknowledged authentication invalidation through the
  existing parent callback.
- Keep the shell's periodic unread-message badge polling in `MemberShell`;
  it remains independent of the Inbox and Conversation route models.
- Keep cookies and session objects out of UI state, Navigation 3 keys,
  `SavedStateHandle` and persistent draft keys.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: specify route-scoped inbox and conversation
  state, restoration, reload and cleanup behaviour.

## Impact

- Android messaging screens under `apps/android/app/src/main/java/org/trustroots/android/ui/inbox`
  and `ui/conversation`, plus their repositories and ViewModels.
- The nested Messages route integration in `TrustrootsApp.kt`, Android unit
  tests and authenticated-shell instrumentation journeys.
- No API or server changes, data migration, or web/iOS behaviour changes.
  Existing `MessageDraftStore` remains the persistence format and source of
  truth for unsent drafts across route removal and process recreation.

## Dependency

The Messages route migration from `complete-android-nested-navigation3` is
already present in the implementation baseline. `MessageInboxScreen` owns a
child Navigation 3 back stack with decorated `MessageInboxVisit`,
`MessageConversationVisit` and `MessageProfileVisit` entries. Therefore the
Inbox slice can start independently: create its ViewModel from the actual
`MessageInboxVisit` entry owner and leave the unread badge poll in `MemberShell`.
Do not wait for Conversation extraction or add an owner above the Inbox entry.

The Conversation slice remains a separate follow-up within this proposal.
It must obtain recipient identity independently through the existing mini-user
API route and must not receive an Inbox ViewModel, `InboxUiState`, or an
Inbox-owned lookup callback. Until that slice is implemented, preserve the
existing Conversation composable behavior without treating its current
thread-list lookup as the future repository contract. No Activity-global,
application-global, or manually keyed ViewModel store is an acceptable
substitute for either decorated route owner.
