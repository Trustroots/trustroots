## Context

`modules/users/server/config/users.config.server.mts` serialises the signed-in
account ID and authentication version. Passport reloads that account on each
request and rejects revoked sessions. Preserve this authentication relationship
throughout masquerading.

Most policies and controllers authorise using `req.user`. The member view can
reuse these checks if a middleware supplies an effective member, while retaining
the authenticated administrator separately. Place this middleware after
Passport and suspended-actor checks, and before last-seen middleware, module
routes and parameter handlers.

`users.lastseen.server.controller.mts` writes activity and IP data during normal
browsing. `Thread.component.tsx` automatically posts to `/api/messages-read`.
These are concrete examples of writes that must be suppressed. Merely disabling
edit buttons or allowing every GET is insufficient: inventory the selected
read routes and their middleware for indirect writes.

## Session and request context

- Passport continues to identify the administrator. Store only the target ID,
  target authentication version, expiry time, an opaque context
  generation and an audit correlation ID in server-side session state.
- During an active view, expose the administrator as `req.actor` and the
  effective member as `req.user`. Never copy administrator roles onto the
  effective member. Do not pass the actor into ordinary member authorisation.
- Revalidate both accounts, actor privileges, authentication versions and
  expiry on each request. A target suspension, deletion or changed
  authentication version ends member access. Actor invalidation requires
  sign-in again; it must never restore administrator access automatically.
- Begin and end through CSRF-protected POST endpoints. The start handler checks
  the real actor and their current password, rate-limits attempts, validates
  the reason and target, and rejects nesting. The stop handler authenticates
  against the real actor even though ordinary admin routes are unavailable.
- Regenerate the session ID on entry and exit, retaining only explicitly
  required authentication/context fields. Never sign Passport in as the target.
- Use an authoritative context generation in bootstrap/session responses and
  request validation. A request created before a transition must not execute
  with a different identity after the transition. Context validation must also
  cover tabs opened before masquerading and stale forms after exit; a client
  broadcast by itself is not authorisation. Each request retains the actor and
  session snapshot it loaded. Already authorised requests finish with that
  identity; requests arriving with a rotated cookie must present its new
  generation. Member reads never change the session document, so they cannot
  rewrite stale member-view state after exit. The entry audit date records
  when access started.

## View-only boundary

- Use an explicit, reviewed allowlist of side-effect-free member reads. Deny
  unlisted API requests, administrative reads and all member mutations before
  route handlers or parameter middleware can act. Normal session-store
  maintenance and dedicated audit records are allowed operational writes.
- Only explicit stop and sign-out lifecycle operations may mutate the current
  session during the view. They cannot alter member data. Reauthentication for
  starting the view occurs before the view-only boundary is active.
- Exclude credential/token handlers, full account exports and push credential
  disclosure, even if exposed through a GET route. Preserve normal sanitisation
  of profile and bootstrap responses.
- Suppress target last-seen and IP updates, read receipts, automatic push
  subscriptions, notifications, analytics attributed to member activity and
  other effects found during the route inventory. Do not fake successful
  writes or mark messages read in client state.
- The server returns a consistent read-only error for forbidden operations.
  Disable or hide write controls where practical and explain the restriction;
  server enforcement remains authoritative.

## Expiry and browser behaviour

- Reload the document when entering or leaving to discard account-specific
  React Query data, authentication context and local component state. Broadcast
  the context change to other tabs and revalidate on focus before enabling
  interactions. Scope persistent client caches by identity where needed.
- Render a banner outside header visibility conditions: “Viewing as username —
  read-only”, with the expiry and “Return to your account”. Expose only the
  minimum actor/context metadata required by this interface.
- On expiry, stop member reads and writes. Keep a recoverable expired state
  and return action, including after a full reload. Never silently run the
  expired request under the administrator's identity. Explicit exit establishes
  the restored administrator context before a clean reload.
- Context-change and expiry errors must not trigger an automatic retry of a
  mutation after restoration. Requests already authorised before entry must
  retain their original actor and must never be reinterpreted as target writes.

## Audit

Extend the existing audit collection with structured action, target, outcome
and correlation metadata inside the existing audit `body` object. The existing
`user` field continues to identify the
real administrator so actor filtering remains useful. Record the reason once
at entry, then lifecycle events and permitted API/document reads with paths
and authorisation outcomes. Store no password, session ID, message text, response body
or raw query/body. Use the established trusted client-address resolver.

An entry audit failure prevents access. Failure to persist required access
audit metadata prevents returning private member data. Expiry is enforced by
the server clock on every request; logging it on the next request does not
extend the deadline. Explicit exit/sign-out must remain possible if auditing
fails, with an operational error recorded through the existing logger.

## Delivery

Strict OpenSpec validation precedes implementation. The users module registers
the guard and lifecycle routes immediately after Passport and suspended-actor
checks. It reuses the existing users-to-admin module relationship and the
actor-filtered audit history rather than introducing another log.
Ordinary sessions retain their previous request contract until a member view
is started; subsequent bootstrap responses carry their context generation.
The shared HTTP client sends that generation, rejects local member mutations
and reloads on expiry or stale-context responses. Sign-out forms carry the
generation in a hidden field.

The read inventory contains member search/profiles/memberships, blocked-user
lists, message inbox/thread/count/synchronisation, offers, circles and their
member lists, contacts/common contacts, experiences and public reference
counts/suggestions, public statistics/languages/volunteer lists, and Nostr
author visibility. These handlers do not persist member state. Other routes
remain denied until separately reviewed. Message reply controls are hidden
and their automatic read-receipt effect is skipped. Profile settings retain
their normal presentation, with changes refused by both the HTTP client and
the server. Message draft editors are not mounted, so their persistent draft
cache is not used under another identity. Full document reloads discard
authentication, React Query caches and component state at each transition.

Archive and update the living specification only after successful verification.
