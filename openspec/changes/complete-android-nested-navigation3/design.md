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
