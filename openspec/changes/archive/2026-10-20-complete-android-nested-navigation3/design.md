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

The Circles overview and detail repositories keep the current normalized
backend and session as runtime dependencies. A replacement `MobileApiClient`
for the same normalized backend updates the repository in place without
reloading entry data or repeating a membership mutation. A changed backend,
account username or session cookie cancels active reads and membership work,
invalidates the request generation, clears account-scoped entry state, renews
the authentication-invalidation latch, and reloads through the current
environment. Late results from the previous environment are ignored. The
decorated Navigation 3 entry remains the owner throughout; do not create a
second owner or key ViewModels by API/session object identity.

### Per-flow stacks

| Flow             | Navigation 3 route history                                                                                                                                           | State that stays with a route                                                                                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Circles          | `CirclesOverview(visitID) → CircleDetail(slug, visitID)`                                                                                                             | The overview entry owns the loaded list, filter, memberships and list scroll. The detail entry independently loads the canonical circle by slug and owns membership status, join/leave, loading, failure and retry state. Back returns to that same overview entry. |
| Search           | `SearchHome(mode=Map or Members) → MemberProfile(memberId)` for member results; `SearchHome(Map) → HostDetail(offerId) → MemberProfile(memberId)` for map selections | Search mode, query, map camera and filters stay with SearchHome; sheets, filter menus and map note dialogs stay transient to the map route. Returning from profile/host detail reveals the same map and filters.                                                    |
| Messages         | `Inbox → Conversation(memberId) → MemberProfile(memberId)`                                                                                                           | Inbox filter and loaded list remain with Inbox; conversation recipient and message screen state remain with Conversation. Alert entry selects/pushes a Messages tab visit and pushes Conversation over Inbox, preserving the previous shell origin below it.        |
| Profile/menu     | `Menu → OwnProfile`, `Menu → EditProfile`, `Menu → Contacts → MemberProfile(memberId)`, `Menu → HostOffer`, and `Menu → Account`                                     | Each page retains its scroll and screen state. Edit state and dirty form ownership remain with the edit entry. The menu's Nostroots and support links use `Browser(title, url)` entries.                                                                            |
| Profile detail   | `MemberProfile → RelatedProfile(memberId)`, `MemberProfile → Conversation(memberId)`, and `MemberProfile → ExperienceForm` where those actions exist                 | Profile tab selection and fetched data are entry state. Related profile, message composition and experience editing return to the profile that opened them.                                                                                                         |
| Embedded browser | `Browser(url, title)` under its originating flow                                                                                                                     | WebView history remains owned by the browser entry. Browser Back first traverses WebView history, then pops the browser route to its originating screen. Authentication cookies remain supplied at runtime and are never saved in route keys.                       |

Map host sheets, map community-note panels, dropdowns, confirmation dialogs,
and profile image viewing are presentation state rather than independent
destinations unless an existing user-visible Back action treats them as a
screen. The selected map host card is an actual HostDetail destination because
it loads independent server-backed detail, profile and membership data and
supports profile navigation. Map notes, filter menus and confirmation dialogs
remain transient layers; a flow owner handles them before Navigation 3 pops.
Member profiles opened from map results, messages, contacts or profile links
must be children of that source flow, never global destinations that discard
their origin.

### Search modes and map HostDetail overlay

The stable owner is the existing decorated shell
`MemberTabVisit(Destination.Search, visitID)`. Acquire the SearchHub's
`MemberSearchViewModel` and `HostMapViewModel` from that owner before its child
`NavDisplay`; do not add a synthetic single-entry store or key either model to
the currently visible child route. Search mode becomes a serialisable
`SearchModeVisit(mode, visitID)` route under that owner. Selecting a mode
replaces the current mode route rather than accumulating mode history. The
Search root retains the current entry's initial mode so Back keeps its existing
behaviour: a visit that began on Map returns from Members to Map, while a visit
that began on Members delegates root Back to the shell. The member query,
filters, map viewport, circles and notes remain in their existing parent-owned
ViewModels when a mode or child route is hidden.

Selecting a map offer pushes `HostDetailVisit(offerID, offerType, visitID)`.
The key contains only the canonical public offer ID, a constrained `host` or
`meet` discriminator, and entry identity; it never contains `MapOffer`, a
`HostOffer`, profile/membership data, or session state. A dedicated
entry-owned `HostDetailViewModel` loads the canonical offer through the
existing `GET /api/offers/:id` client method, then the existing profile and
membership reads. It owns retryable failures, generation checks, cancellation
on entry clear, and one-shot session invalidation. It is not a renderer-only
ViewModel and does not share the Search-root map store. The map ViewModel owns
viewport, filters, offer results and note-source lifecycle only; it no longer
fetches or retains selected-offer detail, profile or shared-membership data.

Keep the map visibly composed beneath HostDetail and its member-profile child
using an app-local Navigation 3 `OverlayScene` strategy, alongside
`SinglePaneSceneStrategy` for ordinary mode routes. Both overlays render in the
existing Activity window and Search display bounds, preserving the shell's
bottom navigation and status-bar owner. HostDetail renders its existing white
bottom surface above a dim scrim that blocks underlying map input. A profile
uses an opaque surface above the retained HostDetail or mode scene. Neither
route introduces a second MapView or a second destination owner.

The underlying map entry remains the same decorated Search owner: its camera,
filters, completed-query fingerprint, circles and note source stay live while
HostDetail or a profile is above it. Navigation 3 owns the retained scenes'
lifecycle states; the inline strategy does not replace their lifecycle owners.
The active inline overlay registers its Activity predictive-Back handler using
the overlay scene's lifecycle owner and Navigation 3 onBack callback, so it
handles system Back before the parent tab shell. The handler consumes the
gesture stream and pops only after normal completion; cancellation retains the
current child. It is registered before the profile content so deeper profile
routes and transient controls keep their own Back precedence. Opening the host's profile pushes
`SearchMemberProfileVisit` above HostDetail; toolbar, system and predictive
Back return through HostDetail to the unchanged map.

Activity recreation restores supported Search mode and HostDetail keys after
the encrypted session store restores the live session and the authenticated
shell is composed. This is session restoration, not an additional remote
validation request. HostDetail reloads canonical data using its offer key; the
Search-root ViewModels retain their existing state. Removing the Search tab visit or invalidating the session
clears all child route stores and the Search-root map/member models. Reselect
continues to use the existing visit-scoped reset generation and returns to the
Map root with default map filters/camera and empty member-search state.

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

| Entry                                                 | Safe route data                                                          | Runtime data source                                                                                                                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MemberProfileVisit(username)`                        | Public username and visit ID                                             | Existing `GET /api/users/:username`; profile overview loads its own profile, hosting, contacts, references and contact relationship.                                                                                              |
| `RelatedProfileVisit(username)`                       | Public username and visit ID                                             | Same profile loader; pushed from contact/reference/experience links.                                                                                                                                                              |
| `ConversationVisit(memberID, visitID)`                | Stable public member ID and unique visit ID                              | Inbox conversation route resolves recipient identity through the authenticated mini-user lookup and owns its own conversation entry ViewModel. It does not reuse a profile-conversation owner.                                    |
| `EditProfileVisit(username)`                          | Own-profile username and visit ID                                        | Edit route loads canonical own-profile values with the existing profile API and saves through `PUT /api/users`.                                                                                                                   |
| `ExperienceFormVisit(memberID)`                       | Stable public member ID and visit ID                                     | Experience route resolves the recipient label through the existing mini-user lookup and submits through `POST /api/experiences`.                                                                                                  |
| `ProfileBrowserVisit(destination, memberID, visitID)` | Contact-request destination, stable public member ID and unique visit ID | Derive the localised contact-request title and `/contact-add/:memberID` URL at runtime; obtain the session cookie from the current session. Never save username, title, URL, cookies or request/private payload in the route key. |

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

The profile's conversation action pushes a `ProfileConversationVisit(memberID,
visitID)` and renders the independent `MessageConversationEntryScreen` with
that decorated entry as its `ViewModelStoreOwner`. This uses the existing
message-conversation repository and ViewModel contract, but creates a distinct
conversation ViewModel for every profile visit; it has no dependency on an
Inbox entry or inbox-loaded payload. The member ID is sufficient for the
screen's authenticated mini-user lookup and message load. The profile's
username, recipient model, display name and other fetched data are not copied
into the route key. A retained profile entry stays below the conversation,
keeping its loaded profile, selected tab, pager/list position and saveable
scroll state. On Activity recreation, the route restores by member ID and
visit ID while the current authenticated session is supplied by the shell.
Repeated conversations with the same member from different profile visits
receive separate stores.

The menu's existing direct Edit Profile destination and Edit from the own
profile action both use `EditProfileVisit` under their current owning stack.
The edit entry fetches its own canonical profile from the username key rather
than serialising `MemberProfile`, HTML, form fields or cookies into the key.
The profile contact-request action pushes
`ProfileBrowserVisit(ContactRequest, memberID, visitID)` on the profile visit's
child stack. It is available only when the loaded profile has a stable member
ID, matching the current action. The route contains the public member ID,
destination and unique visit identity; username is not needed to derive the
contact-add URL. It derives the localised `profile_add_contact` title and
contact-add URL from the current resources; the authenticated session cookie
is supplied only to the WebView at render time. Do not persist the resolved
URL, title, cookie, or browser/request content in the key. WebView history
remains owned by this browser entry: Back first traverses WebView history when
possible, then closes the browser route and returns to the same profile entry.
Existing active form leave guards remain ahead of a browser push or route
close.

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

The profile flow's fast handoff values are owned by a `ProfileFlowHandoffViewModel` created from the actual enclosing decorated Navigation 3 entry owner before the profile child stack is composed. It is not Activity-scoped or backed by a synthetic store. The owner-scoped model keeps the loaded profile snapshot and display name by the existing parent profile `visitID`, so ordinary navigation seeds the edit ViewModel without another profile request and labels Experience from the retained display name. The edit ViewModel still owns canonical form loading and mutation; the profile ViewModel remains canonical for its displayed profile and references.

Form returns use typed, runtime-only one-shot events keyed by the exact `parentVisitID`: `ProfileSaved(profile)` updates the matching profile ViewModel and `ExperienceCreated` refreshes only that profile's references. Each event has a monotonically increasing delivery ID; the parent consumes only a matching pending event once. Repeated visits to the same username therefore cannot read or consume one another's handoff. Popping a profile route removes its handoff values, while clearing the enclosing decorated entry clears the ViewModel. A changed backend URL, account username or session cookie clears all pending snapshots, labels and completions before they can cross environments. No snapshot, display name, completion, or credential is serialised into a route key or saved-state bundle. If process death removes the handoff ViewModel, the restored edit entry has no snapshot and the edit ViewModel reloads by its safe username key.

Keep `ProfileImageViewer` as a transient modal overlay: it does not own a
separate route ViewModel or URL key, and its close action consumes Back before
the profile stack. Contact confirmations, quick menus and other dialogs also
consume Back while visible. The existing expanding artwork, pinned profile
action row, tabs outside the profile pager, fixed shell tabs and supplied
system insets remain owned by their current shell/profile layouts when
navigation is extracted.

### Circles overview and detail ownership

The Circles stack is a child stack beneath the actual
`MemberTabVisit(Destination.Circles, visitID)`. Its first entry is the real
`CirclesOverviewVisit`; it owns the overview `CirclesViewModel`, list/filter,
loaded membership set and overview scroll position. A row selection pushes a
`CircleDetailVisit(slug, visitID)` with only the public slug and a unique visit
identity. Use the Navigation 3 saveable-state and ViewModel-store decorators
on both entries. Do not keep `selectedCircle` in the overview state, mount the
detail inline, or create a wrapper entry whose only purpose is to hold a
ViewModel store.

The detail is a genuine data-owning screen. `CircleDetailViewModel` loads its
own canonical `TrustrootsCircle` using the existing authenticated
`GET /api/tribes/:tribe` endpoint, where `:tribe` is the route slug. It obtains
the member's membership IDs through the existing
`GET /api/users/memberships` endpoint and joins or leaves with the existing
`POST`/`DELETE /api/users/memberships/:circleID` endpoints. These operations
stay behind an injectable repository; the live session is supplied at runtime
and never enters route keys or saved state. The detail owner handles loading,
typed/dynamic failure and retry, one-shot authentication invalidation,
membership mutation, stale request rejection and account replacement. It has
no profile-opening behaviour in the current UI. Although the server exposes
`GET /api/tribes/:tribe/members`, Circles detail does not display members or
member profiles today, so this route migration must not add that feature.

On successful detail membership change, send a typed event to the retained
overview entry so its membership set updates immediately without reloading the
circle list or losing the filter and scroll position. Keep current count
display semantics; the existing UI updates membership state without changing
the catalogue count. Popping detail clears its ViewModel and saveable detail
state while preserving the overview entry. Activity recreation restores only
the route slug and per-entry saveable UI state, then reloads the circle and
membership from the API. A missing/unknown slug displays the normal retryable
detail failure and never falls back to a cached object in the route key.

When Circles is reselected as the active top-level tab, reset the child stack
to a fresh overview route and apply the established overview reset/refresh
behaviour. This clears both route owners and their account-scoped work. A
different top-level visit to Circles receives an independent overview entry
and ViewModel store.

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
while preserving the Java class names of supported, previously persisted route
types. The legacy `MenuPage.EditProfile` value remains supported and renders the
editor for the current live session username. A missing or unknown
`supportLinkID` uses the existing general Support page fallback. Unknown
serialized NavKey class names are outside this change's compatibility contract;
do not promise or add arbitrary-class recovery. If the live session is absent,
the authenticated shell and its nested stacks are discarded before restoration.

Migrate in vertical slices while the established screen remains usable:

1. Add typed child-stack ownership and central Back/guard dispatch; move the
   simplest menu pages and browser route, preserving existing callback APIs.
2. Migrate Circles overview/detail as distinct decorated entries and ViewModels,
   then model Search modes and HostDetail as actual routes. Keep the Search
   ViewModels with the shell Search visit and HostDetail in its own decorated
   overlay entry; preserve the map beneath it and verify origin/Back/restoration.
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
