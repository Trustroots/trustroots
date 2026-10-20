## Context

`TrustrootsApp.kt` already uses a Navigation 3 stack for unique top-level tab
visits. Within those entries, the menu page and browser use shell-level mutable
state; Circles uses a selected-circle value; Search swaps map and member search
with a local tab and nested profile state; Messages conditionally replaces the
inbox with a conversation or profile; and profile, contacts and map screens
hold their own nested selections. Their `BackHandler`s can intercept Back
without a shared route history. These are the remaining navigation items in
issue 3234.

## Decisions

### Stack ownership and route representation

Keep the existing `MemberTabVisit(destination, visitID)` shell stack as the
owner of top-level origin history. Each distinct tab visit owns a separate
child Navigation 3 stack, so revisiting Search or Messages creates an
independent route context and returning to an older tab visit restores its
previous child route. Child stacks use `NavKey`s with a route discriminator,
unique entry identity and only the minimum stable public resource identifier
needed to reload a destination. They do not contain API responses, message
text, cookies, tokens or session/member objects. The authenticated parent
continues to provide the live `MemberSession` and `MobileApiClient`.

Use Navigation 3 entry decorators for saveable Compose state and entry-scoped
ViewModel stores. Move screen-owned loading, error, selection and event logic
into screen ViewModels as each screen is migrated; route keys describe
navigation identity, while ViewModels own fetched data and transient business
state. Search terms, map filters, pager position and unsent message drafts
remain in their screen state owners, not route keys. Draft persistence keeps
using the existing account-scoped draft store.

### Per-flow stacks

| Flow             | Navigation 3 route history                                                                                                                                           | State that stays with a route                                                                                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Circles          | `CirclesOverview → CircleDetail(circleId)`                                                                                                                           | Circle list/filter in overview; selected circle content and scroll state in detail. Circle detail Back returns to the exact overview entry.                                                                                                                  |
| Search           | `SearchHome(mode=Map or Members) → MemberProfile(memberId)` for member results; `SearchHome(Map) → HostDetail(offerId) → MemberProfile(memberId)` for map selections | Search mode, query, map camera and filters stay with SearchHome; sheets, filter menus and map note dialogs stay transient to the map route. Returning from profile/host detail reveals the same map and filters.                                             |
| Messages         | `Inbox → Conversation(memberId) → MemberProfile(memberId)`                                                                                                           | Inbox filter and loaded list remain with Inbox; conversation recipient and message screen state remain with Conversation. Alert entry selects/pushes a Messages tab visit and pushes Conversation over Inbox, preserving the previous shell origin below it. |
| Profile/menu     | `Menu → OwnProfile`, `Menu → EditProfile`, `Menu → Contacts → MemberProfile(memberId)`, `Menu → HostOffer`, and `Menu → Account`                                     | Each page retains its scroll and screen state. Edit state and dirty form ownership remain with the edit entry. The menu's Nostroots and support links use `Browser(title, url)` entries.                                                                     |
| Profile detail   | `MemberProfile → RelatedProfile(memberId)`, `MemberProfile → Conversation(memberId)`, and `MemberProfile → ExperienceForm` where those actions exist                 | Profile tab selection and fetched data are entry state. Related profile, message composition and experience editing return to the profile that opened them.                                                                                                  |
| Embedded browser | `Browser(url, title)` under its originating flow                                                                                                                     | WebView history remains owned by the browser entry. Browser Back first traverses WebView history, then pops the browser route to its originating screen. Authentication cookies remain supplied at runtime and are never saved in route keys.                |

Map host sheets, map community-note panels, dropdowns, confirmation dialogs,
and profile image viewing are presentation state rather than independent
destinations unless an existing user-visible Back action treats them as a
screen. A flow owner handles these transient layers before Navigation 3 pops.
Member profiles opened from map results, messages, contacts or profile links
must be children of that source flow, never global destinations that discard
their origin.

### Profile route family and entry ownership

`MemberProfileScreen` currently multiplexes several actual screens through
local nullable selectors: related profile, conversation, edit profile,
experience form and browser. Replace these selectors with child Navigation 3
entries in the stack that owns the profile visit. The profile overview remains
the underlying entry; a push adds one independently decorated destination and
Back pops only that child. Each entry uses the saveable-state and
ViewModel-store decorators, including repeated visits to the same username or
recipient, so Conversation, Profile, Edit and Experience ViewModels have the
same lifetime as the visible route that owns them.

Before related-profile routing, establish a real per-entry
`MemberProfileViewModel` on the actual decorated profile route. The current
profile, hosting offer, contacts, references, contact relationship, loading and
failure state, and contact-removal request state are business state held by
that ViewModel rather than ordinary `remember` values. The ViewModel is
created from the current Navigation 3 entry's `ViewModelStoreOwner` and the
route username. Repeated visits to the same username therefore receive
different ViewModels because they have distinct entry stores; do not use a
shared/global profile ViewModel or add a synthetic owner solely to host it.
The route key and authenticated parent supply the public username and live
session respectively. On Activity recreation, the retained entry store keeps
the loaded opener profile; after process death, only the username key is
restored and the canonical data is loaded again.

Keep pager selection, list expansion, and scroll positions in the entry's
saveable state so disposing the opener while a related profile is current does
not reset its visible position. Keep transient photo, confirmation, browser,
Conversation, Experience and Edit presentation state in the owning entry until
their later route slices. Their existing Back order and the active Edit
leave-guard remain ahead of the route pop. A related-profile push is available
only from the profile content where its link is shown; it must not discard an
active form or bypass a guard.

Use serialisable keys with unique visit identity and only the resource ID
needed to reload the destination:

| Entry                                           | Safe route data                                                          | Runtime data source                                                                                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MemberProfileVisit(username)`                  | Public username and visit ID                                             | Existing `GET /api/users/:username`; profile overview loads its own profile, hosting, contacts, references and contact relationship.                                                             |
| `RelatedProfileVisit(username)`                 | Public username and visit ID                                             | Same profile loader; pushed from contact/reference/experience links.                                                                                                                             |
| `ConversationVisit(memberID)`                   | Stable public member ID and visit ID                                     | Conversation route owner resolves recipient identity through the existing authenticated mini-user lookup, then loads messages; it does not read the profile or inbox payload from another entry. |
| `EditProfileVisit(username)`                    | Own-profile username and visit ID                                        | Edit route loads canonical own-profile values with the existing profile API and saves through `PUT /api/users`.                                                                                  |
| `ExperienceFormVisit(memberID)`                 | Stable public member ID and visit ID                                     | Experience route resolves the recipient label through the existing mini-user lookup and submits through `POST /api/experiences`.                                                                 |
| `ProfileBrowserVisit(destination, resourceID?)` | Stable browser destination enum, optional public member ID, and visit ID | Derive translated title and URL from the support-link registry or contact-add destination; obtain the session cookie at runtime.                                                                 |

The profile entry owns the existing reads through `MobileApiClient`: profile
`GET /api/users/:username`, hosting `GET /api/offers-by/:memberID?types=host`,
contacts `GET /api/contacts/:memberID`, references
`GET /api/experiences?userTo=:memberID`, and relationship state
`GET /api/contact-by/:memberID`. Contact removal remains
`DELETE /api/contact/:contactID`; adding a contact opens the keyed embedded
browser for `/contact-add/:memberID`. Edit saves remain `PUT /api/users` with
the existing `ProfileUpdate`; experience submission keeps the existing
`POST /api/experiences` payload; messaging retains the existing message
repository contract. Every request receives the current live session from the
authenticated parent or entry repository, never from a route key.

The `MemberProfileVisit` key already used by message, search and map flows
contains a username; retain that public identifier when opening a profile from
Contacts or another profile. Search/map roots, Contacts, Messages and each
profile visit own their own child stack. A related-profile child is a distinct
`MemberProfileVisit(username, visitID)` in the profile visit's stack; it is
not a nullable selected-profile overlay or a recursive call to
`MemberProfileScreen`. Extract the existing profile body into an entry content
composable rendered by the route host. Each profile entry obtains its own
`MemberProfileViewModel` from its decorated store and loads the canonical
profile by username, so the opener's loaded model and saveable UI state remain
underneath the child.

Thus a profile opened from Contacts
is a child of that Contacts entry; one opened from member search or a map host
result is a child of that Search visit; one opened from Messages is a child of
the message source route; and related profiles or conversations are children
of the profile visit that launched them. Popping a child restores the exact
source route, including its filter, scroll, pager position and loaded state.
Never push a profile onto the shell-global stack or replace the source route.

The menu's existing direct Edit Profile destination and Edit from the own
profile action both use `EditProfileVisit` under their current owning stack.
The edit entry fetches its own canonical profile from the username key rather
than serialising `MemberProfile`, HTML, form fields or cookies into the key.
The current description normalisation remains
`Html.fromHtml(description, FROM_HTML_MODE_COMPACT).toString().trim()`; compare
the editable plain-text description with that same normalised baseline when
computing dirty state. The Edit ViewModel owns the original snapshot and form
fields, retains them across Activity recreation, recalculates dirty state
against the snapshot, and owns the save operation. A process-death restore
replays only the safe username key, reloads the canonical profile, and starts
from that clean baseline, matching the current form's non-persistent draft
behaviour. A discard-confirmation dialog and its pending navigation action
are transient and are never restored as route data.

Only the active Edit entry supplies the leave guard. Toolbar Cancel, toolbar
Back, system Back, predictive Back, tab navigation and any push/pop leaving
that entry all request the same guarded transition. Saving blocks departure;
discard confirmation keeps the exact current entry if cancelled and pops once
if confirmed. A successful save informs the shell of the updated display name,
pops the Edit entry, and refreshes the still-retained profile entry from the
server rather than passing a profile payload through a route key. The direct
menu edit path applies the same save and return behaviour to its menu origin.

Keep `ProfileImageViewer` as a transient modal overlay: it does not own a
separate route ViewModel or URL key, and its close action consumes Back before
the profile stack. Contact confirmations, quick menus and other dialogs also
consume Back while visible. The existing expanding artwork, pinned profile
action row, tabs outside the profile pager, fixed shell tabs and supplied
system insets remain owned by their current shell/profile layouts when
navigation is extracted.

### Profile navigation implementation slices

Implement this route family in small source-family changes rather than one
cutover. The first slice is Contacts → profile inside the existing
`MenuNavigationDisplay` stack. Keep `MenuPageVisit(MenuPage.Contacts, visitID)`
as the actual Contacts screen entry and give it an entry-scoped
`ContactsViewModel` for the loaded list, loading/error state and refresh event.
Remove `selectedUsername` and nested `MemberProfileScreen` composition from
`ContactsScreen`; it emits `onOpenProfile(username)` for rows with a public
username and otherwise preserves the current non-clickable row. The Menu child
stack pushes a real `MenuMemberProfileVisit(username, visitID)` entry whose
content is `MemberProfileScreen`, with its own saveable-state and ViewModel
decorators. This is the actual profile destination, not a wrapper route or a
separate global profile store. Popping it reveals the retained Contacts entry
and same loaded list without another request. Menu reselection clears the
whole child stack back to Menu, removing both owners; entering Contacts again
creates a new Contacts entry and reloads its list. Derive `UsageScreen.Profile`
when the profile route is current, and derive the underlying menu page's usage
again after it is popped.

Screen-level tests such as `ContactsScreenTest` and
`ContactsFailureJourneyTest` continue to test the Contacts UI and service
results directly, supplying an explicit no-op profile callback when profile
opening is outside the case. The Contacts row case in
`MemberJourneysContactAndSearchNavigationJourneyTest` asserts that a public
username is emitted through `onOpenProfile`; it does not mount a profile as a
local fallback. `TrustrootsMemberShellJourneysTest.contactsOpenAMemberProfileAndBackReturnsToTheContactList`
remains the genuine shell/Navigation 3 route journey and is extended to cover
Activity recreation while the profile is open and Menu reselection while the
profile route is active. Add a focused `MenuNavigationDisplay` route test for
the `UsageScreen.Profile` → underlying `UsageScreen.Contacts` derivation and
for the list reload after Menu reselection. Keep the empty-list, failed-load,
authentication-failure and username-missing assertions in their current
focused tests.

Keep remaining profile-related flows for subsequent small changes: (1) Search
member results and map/host results push profile entries on the Search visit;
(2) the profile's related-profile links push a second profile entry; (3)
conversation navigation from a profile pushes a Conversation entry; (4) own-
profile edit actions and direct Menu Edit use Edit entries; (5) experience
forms use Experience entries; and (6) add-contact uses a stable-ID browser
entry. Each change removes only the corresponding old selector, keeps the
source route below it, and adds route-origin and Back coverage before moving
to the next family. The existing complete-navigation requirements remain the
overall target, while production changes and validation land as these
independent slices.

### Back, guards and reselection

Provide one shell Back dispatcher that asks the active route to consume Back
for transient UI first, then delegates to the active child Navigation 3 stack,
then pops one `MemberTabVisit`. Toolbar Back callbacks call the same dispatcher
with the same route precedence. Existing screen-specific handlers are replaced
by route callbacks or narrow transient-state handlers; they must not independently
pop a parent stack.

Run `LocalLeaveGuard` before every navigation push, pop, tab action, browser
close or alert-driven transition that would abandon a dirty form. A cancelled
guard leaves both stack contents and selected route unchanged. A completed
predictive Back commits exactly one eligible child pop, or one shell pop when
the child stack is at its root; cancellation changes no navigation state.

Reselecting a selected bottom tab does not add a visit. It executes that
destination's established reset action: Circles returns to overview and
refreshes its route state; Search returns to the map root and clears the
member-search mode as currently expected; Messages returns to inbox and
refreshes; Profile returns to the menu root. Selecting a different tab keeps
the existing push-history semantics and preserves the departing tab visit's
child stack.

### Safe restoration and rollout

Restore keys only after `TrustrootsApp` has loaded and validated the live
session. A missing session discards the authenticated shell and its nested
stacks. Keys may contain opaque public resource IDs and safe route enums, but
never credentials, response payloads, private message content or member
session objects. Reload destination data from the authenticated API after
restoration. Keep keys serialisable and version their route shape conservatively
so unknown saved keys fall back to the owning flow's safe root.

Migrate in vertical slices while the established screen remains usable:

1. Add typed child-stack ownership and central Back/guard dispatch; move the
   simplest menu pages and browser route, preserving existing callback APIs.
2. Migrate Circles detail and Search/map/member-search routes, then add origin
   tests for profile and host details.
3. Migrate Inbox, Conversation and profile subroutes, including alert entry.
4. Migrate Contacts, own profile/edit, host offer and Account routes; remove
   obsolete local navigation state and handlers only after each route's tests
   prove parity.
5. Add ViewModels and restoration at each route boundary, then run the complete
   nested journey matrix and update the living spec.

Each slice keeps legacy route callbacks as adapters only until its callers use
Navigation 3. Do not keep two active histories for the same flow after cutover.
The activity recreation tests must cover a child detail route, a distinct
revisited top-level tab entry, and a restored route whose live session has been
invalidated.

## Risks and mitigations

- Competing `BackHandler`s can still pop the wrong owner. Centralise committed
  Back dispatch and make each screen report transient Back eligibility rather
  than popping its parent directly; test toolbar, system and predictive Back.
- Recreating map, search or inbox state while changing routes can lose context.
  Keep each top-level visit's child stack and entry state, and assert restoration
  of map filters/search input, inbox position and selected profile origin.
- Route arguments can accidentally retain private data. Restrict keys to enums,
  entry IDs and stable public resource IDs; inspect saveable state for secrets
  and keep sessions and API responses in live parent/ViewModel owners.
- Nested ViewModels can outlive their intended route or be shared between
  repeated visits. Use Navigation 3's entry ViewModel decorator and verify
  distinct visit identities own distinct stores, cleared when their entries
  are removed.
- The migration spans many screens. Land it as focused route-family stages
  under this proposal, retaining journey coverage at each cutover.
