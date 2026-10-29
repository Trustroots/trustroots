## ADDED Requirements

### Requirement: Canonical Android conversation recipients

The authenticated conversation recipient lookup SHALL expose a non-null,
non-blank canonical member ID after validation. Conversation state SHALL carry
that validated recipient separately from sparse generic member records. An
unresolved recipient SHALL remain distinguishable from a resolved recipient.
Optional usernames, label fallback and persisted draft-key precedence SHALL
remain unchanged.

#### Scenario: Canonical recipient has no username

- **WHEN** the mini-user endpoint returns a valid canonical ID without a username
- **THEN** the conversation can use the canonical ID for sending and draft identity
- **AND** the profile action remains unavailable until a public username is known

#### Scenario: Mini-user response lacks a canonical ID

- **WHEN** the mini-user endpoint omits its ID or returns a blank ID
- **THEN** the lookup fails before publishing a resolved conversation recipient
- **AND** sparse inbox and host records retain their existing nullable-ID contract
