## Context

`MessageInboxScreen` owns the paginated inbox list, live filter, selected
conversation/profile, loading and error state. It fetches `/api/messages` in
pages of 50 and reloads the inbox when a conversation closes. The nested
Navigation 3 proposal is moving this local selection into a child stack, with
`Inbox → Conversation(memberId) → MemberProfile(memberId)` route history.
`ConversationScreen` loads up to 100 messages, stores the draft in
`MessageDraftStore`, derives quick-reply availability from message history,
and sends through `MobileApiClient.sendMessage`. The authenticated shell also
polls the first inbox page every 60 seconds to update the unread badge.

The `MemberTabVisit` already owns a Navigation 3 ViewModel store, but the
current Messages destination still mounts both screens below that same entry.
The nested Navigation 3 proposal establishes per-tab child stacks and entry
decorators. This change must use the resulting distinct Inbox and Conversation
entries rather than the current tab entry so route removal has the intended
cleanup semantics.

### Current route baseline and delivery boundary

The integrated baseline is more specific than the original migration plan:
`TrustrootsApp.MemberTabVisit` owns the top-level Messages tab and its unread
poll. `MessageInboxScreen` creates a child `rememberNavBackStack` with the
serializable `MessageInboxVisit(visitID)`,
`MessageConversationVisit(memberID, visitID)` and
`MessageProfileVisit(username, visitID)` keys. Its `NavDisplay`
installs both `rememberSaveableStateHolderNavEntryDecorator()` and
`rememberViewModelStoreNavEntryDecorator()`. These are real per-entry owners.
The Inbox implementation belongs in the `entry<MessageInboxVisit>` content,
where `LocalViewModelStoreOwner.current` is the decorated Inbox owner. Do not
create the Inbox ViewModel in `MessageInboxScreen` above `NavDisplay`, in
`MemberShell`, or in an application holder.

Make the Inbox slice independently deliverable. It moves only inbox paging,
loaded thread data, filter state, load/retry status and inbox-specific
authentication acknowledgement into the Inbox entry ViewModel. Keep
`InboxContent`, its `LazyListState`, scrolling, row rendering, click callbacks,
the child back stack and Compose toolbar in their current UI/coordinator roles.
The ViewModel's repository wraps the current API signature
`MobileApiClient.inbox(session: MemberSession, page: Int = 1):
Result<List<MessageThread>>`. The current transport uses
`GET /api/messages?page={page}&limit=50`; each result contains a thread ID,
other-member summary, excerpt and read flag. The existing model types are
`MessageThread` and `MessageMember` in `api/MobileApiClient.kt`. Keep page size,
deduplication by thread ID, partial results after a later-page failure, and
server error mapping as they work now.

The Inbox visit key's `visitID` already distinguishes each Messages visit.
Opening another top-level destination retains this child stack and its Inbox
entry. Explicitly reselecting Messages replaces the top-level `MemberTabVisit`
with a fresh visit ID, which removes the old child stack and should create a
fresh Inbox ViewModel with an empty filter and one initial load. An alert also
creates a fresh Messages visit and supplies `requestedMessageMemberID`; the
child host seeds Inbox followed by a `MessageConversationVisit`. Do not put a
cookie, session, thread list, filter, page cursor or message content into that
route key.

One integration detail needs explicit care in the Inbox slice: today
`MessageInboxScreen.popRoute` increments a Compose-local `reload` counter when
a Conversation is popped, then an effect refetches all inbox pages. After
moving reload state, the return-from-conversation refresh must be delivered to
the still-retained Inbox entry without moving its ViewModel owner above the
entry or making the Conversation model call into it. Prefer a route-visibility
or coordinator event that the Inbox entry consumes; do not retain an Inbox
ViewModel reference in a global callback. Test the exact pop-and-return edge
alongside Activity recreation, so a recomposition or ordinary tab return does
not accidentally trigger a second initial request. Messages reselection is a
new visit and therefore uses its initial-load path, not this return event.

The Conversation implementation is a second, separately reviewable slice. The
`MessageConversationVisit` contains the stable member ID and unique visit ID;
that is sufficient for an independent model to call the existing
authenticated `GET /api/users/mini/{userId}` lookup before
`MobileApiClient.conversation(session, memberID)` and
`MobileApiClient.sendMessage(session, memberID, content)`. Before this slice,
`MessageInboxScreen` derived `MessageMember` from `threads`; the new
Conversation entry resolves its recipient independently and never reads Inbox
state, including for alert-first/restored conversations. The legacy inline
`ConversationScreen` inside `MemberProfileScreen` remains until that flow has
its own decorated profile-conversation entry. Keep the route recipient
resolver independently testable, including empty Inbox and inaccessible-user
outcomes. The mini-user request is one additional request per new Messages
Conversation entry; no server endpoint is added.

The read-only `android-message-app-bars` branch changes message headers and
top inset handling while retaining the same Inbox/Conversation state split;
those visual changes can integrate independently. The read-only nested
Navigation 3 Menu implementation confirms the intended child-stack API shape:
serialisable route keys with unique visit IDs, a child `rememberNavBackStack`,
and saveable-state plus ViewModel-store entry decorators. Messages should use
the same route ownership pattern without coupling its ViewModels to the Menu
implementation.

## Decisions

### Route ownership and prerequisites

The Inbox ViewModel belongs to the child `Inbox` NavEntry under a Messages
`MemberTabVisit`. The Conversation ViewModel belongs to a child
`Conversation(memberId)` NavEntry, where `memberId` is the stable public member
ID needed to load the route. The `Inbox` entry stays below Conversation and
retains its own filter and loaded pages while the conversation is visible.
Popping Conversation clears its ViewModel and returns to the same Inbox model;
reopening that conversation creates a fresh route model and reloads messages.

The messages route migration is a hard implementation prerequisite. The
current `MemberTabVisit` alone does not distinguish Inbox from Conversation,
and a shared entry store would either collide the same model type or retain
conversation state after its route should be gone. Do not use an Activity-wide
holder, manually keyed global store or fake route key to bridge this gap. Wait
until the integrated nested route API and actual messages route owner are
available, then obtain each model through
`LocalViewModelStoreOwner.current` from its own decorated entry.

The Conversation key contains only its route type, unique entry identity and
stable public member ID. The Conversation ViewModel resolves its
`MessageMember` through a `ConversationRepository` using the authenticated
`GET /api/users/mini/{userId}` endpoint, then loads messages through
`GET /api/messages/{userId}?limit=100`. It does not read the recipient from
Inbox ViewModel state, so an alert-first or restored Conversation remains
independently loadable when no Inbox row is present. The existing server route
is `modules/users/server/routes/users.server.routes.mts` and delegates to
`userProfile.getMiniUser`; `userMiniByID` validates the ID, applies existing
visibility/blocking checks, and returns the restricted mini profile fields
(`_id`, `username`, `displayName`, and avatar metadata). No server endpoint
change is needed. A missing/inaccessible recipient follows the existing
conversation-load failure path; it does not fall back to reading Inbox state.

The `MessageProfileVisit(username, visitID)` key contains the public username
required by the existing `/api/users/:username` profile loader. Inbox rows and
the independently resolved Conversation recipient supply that username when
pushing it; the profile screen remains owned by its own decorated entry. The
Messages-stack inline Conversation uses its own Conversation ViewModel. The
separate legacy inline Conversation renderer inside `MemberProfileScreen`
remains in place until that flow has a genuine decorated profile-conversation
child route, rather than borrowing the Messages route's owner. Route keys exclude
message content, drafts, cookies and session data. The live
`MemberSession` and API client continue to arrive from the authenticated
parent. A message alert first creates/selects a Messages tab visit, then opens
Inbox and pushes the requested Conversation route while preserving the prior
shell origin. A profile opened from Inbox or Conversation stays below that
source route so Back returns to its origin.

### State, events and repository boundaries

`InboxUiState` contains the loaded `MessageThread` values, filter text, loading
and completion flags, typed `UiFailure`, pagination progress, retry
availability and an identified pending session-invalidation event. Its events
cover initial load, filter changes, retry/refresh, return-from-conversation
refresh and invalidation acknowledgement. The repository exposes one page at a
time; the ViewModel preserves the existing page size and continues until a
page contains fewer than 50 threads. It deduplicates by thread ID and keeps
already loaded pages when a later page fails, matching current behaviour.

`ConversationUiState` contains the route's recipient identity and display
details, loaded `DirectMessage` values, draft text, loading/sending flags,
typed `UiFailure`, quick-reply visibility and an identified pending
session-invalidation event. Explicit events cover recipient/message load and
retry, draft edits, normal send, a quick-reply event carrying the UI-resolved
localized payload, and invalidation acknowledgement. Quick-reply visibility remains derived from a completed load
with at least one message and no outgoing message by the current member. Keep
the exact current quick-reply payloads and enabled-state behaviour.

Use separate injectable repositories. `InboxRepository` wraps
`MobileApiClient.inbox`. `ConversationRepository` wraps the existing
`MobileApiClient.conversation` and `sendMessage` calls, the existing
`MessageDraftStore`, and a `MobileApiClient` method for the existing mini-user
endpoint. The mini-user request is one additional HTTP lookup per new
Conversation entry because alert/restored Conversations cannot rely on an
Inbox row after the ViewModels receive separate entry ownership. Do not
duplicate it when the same Conversation entry is merely recomposed or the
Activity is recreated with its entry ViewModel retained. Inbox paging remains
`GET /api/messages?page=N&limit=50`; recipient resolution is
`GET /api/users/mini/{userId}`; conversation loading remains
`GET /api/messages/{memberId}?limit=100`; sending
remains `POST /api/messages` with the current trimmed request body and
authenticated session cookie. Drafts remain keyed by the current account and
the counterpart username or ID, are saved on edit, restored on route creation,
retained after a failed send and cleared only after a successful send. Route
keys and saved ViewModel state do not take over the draft store's persistence
contract.

Keep rendering, Compose focus/keyboard, list scroll, message bubble layout,
toolbar actions, profile navigation and quick-reply buttons in the UI layer.
The inbox filter remains an immediate local filter and does not issue another
request. The shell's unread badge poll remains owned by `MemberShell`; this
change neither moves it into the route ViewModels nor removes its 60-second
cadence or refresh on Messages-tab reselection.

### Session changes, cancellation and authentication

Each repository holds the latest `MemberSession` only in memory. When the
parent supplies a changed session for the same account, update the repository,
cancel work started with the old session, reset any authentication latch and
reload the active route. If the account changes, clear account-scoped route
data and start fresh state. Never put a cookie in UI state, a route key,
`SavedStateHandle`, a draft key or another persistent preference.

Run requests in each ViewModel's `viewModelScope`. Propagate cancellation,
associate requests with generations, and check the active generation/session
before publishing results or clearing loading flags. A cancelled or
non-cooperative response from an older route request or session cannot replace
newer data. Clearing an entry cancels its pending loads and sends. An
authentication failure creates one identified pending event; the route owner
delivers the existing `onSessionInvalidated` callback and acknowledges that
event. A changed live session resets the latch so a renewed session can retry.
Other failures keep their existing user-facing fallback and server-message
behaviour and expose the retry currently available in each screen. Use the
existing `UiFailure`/`toUiFailure` mapping from the API-feedback change to keep
server feedback and `ApiFailureKind` (`SIGN_IN_REJECTED`, `MISSING_SESSION`, or
`REQUEST_REJECTED`) as context-free state; resolve localized fallback strings
in Compose with `resolveFailureMessage`. Conversation
recipient lookup uses the conversation-load fallback. Authentication remains
classified separately with `isAuthenticationFailure` and delivered through
the one-shot parent callback.

### Route lifecycle and behaviour preservation

Switching to another top-level tab retains the Messages visit and both models
while that visit stays on the stack. Activity recreation restores safe route
keys and reattaches to the Navigation 3 entry stores after the live session is
available; the models keep loaded state without repeating successful reads.
Process recreation may reload server data, while unsent drafts continue to
survive through `MessageDraftStore`.

Popping Conversation preserves the current Inbox model and requests an inbox
refresh, matching today's Back callback. Explicitly reselecting Messages
returns the child stack to Inbox, clears the inbox filter and reloads its
pages, matching the existing `messagesNavigationID` remount. Opening a
conversation via alert uses the same Conversation route and repository as a
conversation opened from an inbox row. Removing the Messages tab visit or
signing out clears its child entries; a subsequent account starts with fresh
ViewModels and cannot observe previous account data.

### Validation strategy

Test each ViewModel with fake repositories for pagination, ordering and
deduplication; filtering; retries after page and transport failures; send
success/failure; draft save/restore/clear; quick-reply eligibility; session
renewal; cancellation and stale results; authentication event acknowledgement;
and entry cleanup. Test Conversation recipient resolution independently of
Inbox state for alert-first and restored routes, including a missing or
inaccessible mini-user response. Verify profile routes retain the public
username across restoration and return to their source entry. Preserve the
existing anonymous API and Android journeys
for message parsing, pagination, alert navigation, drafts, send recovery,
quick replies and unread badge semantics.

After route integration, add authenticated ActivityScenario journeys that
recreate the Activity while Inbox and Conversation are open, switch away and
return, pop and reopen a Conversation, reset the Messages tab, exercise an
alert-origin conversation with an empty Inbox, renew a session during an
in-flight request, and
tear down the account. Assert that Inbox and Conversation retain state only
while their own entries remain, that the unread poll and draft persistence
continue to work, and that no cookie appears in route or saved UI state.
