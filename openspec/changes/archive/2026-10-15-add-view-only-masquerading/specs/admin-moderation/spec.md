## ADDED Requirements

### Requirement: View-only member masquerading

The system SHALL let a currently authorised administrator start a temporary
view of an eligible member's experience after confirming their current password
and supplying an investigation reason. The view SHALL last no more than 15
minutes. The authenticated actor SHALL remain the administrator, while ordinary
member visibility and ownership checks SHALL use the selected member. The
system SHALL reject nested views, self-selection, administrator targets and
suspended targets.

#### Scenario: Administrator enters a member view

- **WHEN** an administrator supplies valid credentials, a reason and an eligible target
- **THEN** the system establishes a new session context using the member's visibility rules
- **AND** it retains the real administrator identity for authorisation and auditing
- **AND** it records the entry before returning member data

#### Scenario: Caller cannot start a member view

- **WHEN** a caller lacks the administrator role, supplies invalid credentials or selects an ineligible target
- **THEN** no member view is established
- **AND** repeated entry attempts are subject to a server-side rate limit

### Requirement: Member views cannot change member state

The system SHALL enforce an explicit allowlist of side-effect-free member
reads before route handlers and parameter middleware run. It SHALL reject all
member writes, administrative APIs, credential operations, full account exports
and unlisted reads. It SHALL suppress automatic last-seen/IP updates, read
receipts, push registration and member-attributed activity effects. Only
explicit exit/sign-out, session maintenance and dedicated auditing MAY write
operational state during a member view.

#### Scenario: Administrator browses private member pages

- **WHEN** an administrator opens an allowed member page, including an inbox or settings page
- **THEN** the response uses the selected member's ordinary access and sanitisation rules
- **AND** browsing leaves member data, activity, unread state and notifications unchanged

#### Scenario: Caller attempts a mutation or unlisted read

- **WHEN** a member-view request attempts a member mutation, administrative API or unlisted read
- **THEN** the server rejects it before its route and parameter handlers execute
- **AND** it does not report a successful member mutation

### Requirement: Recoverable and explicit member-view transitions

The system SHALL show a persistent accessible read-only banner with the member
identity, deadline and return action, including when the usual header is hidden.
It SHALL rotate the session ID at entry and exit and discard account-specific
client state through a full reload. Every request SHALL be bound to its intended
server-validated identity context. Expiry or identity invalidation SHALL end
member access without replaying the request as the administrator. Expired views
SHALL retain a usable return/sign-in path after document reload.

#### Scenario: Administrator returns to their account

- **WHEN** the administrator explicitly leaves the member view
- **THEN** the server establishes a restored administrator context with a new session ID
- **AND** the browser reloads without reusing member-specific client data

#### Scenario: View expires or either account becomes invalid

- **WHEN** the deadline passes, the target is removed or suspended, either authentication version changes, or actor privileges are revoked
- **THEN** further member access is rejected
- **AND** the failed request is not retried under a different identity
- **AND** the interface provides an explicit return or sign-in path

#### Scenario: Another tab or an in-flight request uses an old context

- **WHEN** a request created under an earlier context reaches the server after an identity transition
- **THEN** it cannot execute with the new context's identity
- **AND** the client must refresh its context before continuing

### Requirement: Attributed member-view audit history

The system SHALL record member-view entry, exit, observed expiry and permitted
member API access with the real administrator, target, correlation, action and
outcome. It SHALL record an investigation reason at entry and SHALL omit
credentials, session identifiers, private message content, response bodies and
raw request payloads. Required entry/access audit failures SHALL prevent new
private member data from being returned, while exit and sign-out remain usable.

#### Scenario: Administrator reads member data

- **WHEN** a member-view API read is permitted
- **THEN** its audit event identifies the administrator and selected member
- **AND** ordinary actor filters continue to find the event under that administrator
- **AND** private content is absent from the audit event

#### Scenario: Required access audit cannot be persisted

- **WHEN** the required entry or access audit record cannot be persisted
- **THEN** the system does not return new private member data
- **AND** the administrator can still leave the view or sign out
