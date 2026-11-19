## ADDED Requirements

### Requirement: Account-scoped native signing lifecycle

The iOS app SHALL store local Nostr keys per normalised Trustroots server and
member in Keychain. Shared Kotlin SHALL own secret-free scope and session
revision rules suitable for Android and iOS adapters. Sign-out and session
invalidation SHALL pause signing immediately while retaining the encrypted key.
Account or key changes SHALL invalidate outstanding signing and backup work and
clear browser permissions.

#### Scenario: Member changes account or server

- **WHEN** a different member or Trustroots server becomes active
- **THEN** only that scope's local key is available
- **AND** previously captured work cannot use the new scope's key

#### Scenario: Member signs out and returns

- **WHEN** the member signs out and later signs into the same server and account
- **THEN** signing pauses before network sign-out completes
- **AND** the retained key becomes available only for the matching signed-in scope

### Requirement: Safe iOS legacy key adoption

The iOS app SHALL preserve an existing installation-wide key as an unclaimed
candidate. It SHALL adopt it automatically only when a live own-profile lookup
matches its npub; otherwise it SHALL display the public key and require an
explicit claim. It SHALL NOT overwrite an existing account key. It SHALL save
the scoped key before deleting the legacy entry.

#### Scenario: Legacy key matches the live profile

- **WHEN** a signed-in member's live profile returns the legacy key's npub
- **THEN** the app assigns that key to the active account without a claim prompt

#### Scenario: Legacy key differs or profile lookup fails

- **WHEN** the profile key differs, is absent, or cannot be loaded
- **THEN** the legacy key cannot sign until the member explicitly claims it

### Requirement: Native key backup and local removal

The iOS Account screen SHALL distinguish the local and linked profile public
keys, allow copying the local npub, reveal nsec only after successful device-owner
authentication for the current signing session, and hide it on backgrounding or
identity changes. Removing a local key SHALL require confirmation and SHALL NOT
unlink the profile key.

#### Scenario: Member backs up a key

- **WHEN** device authentication succeeds and the account and key are unchanged
- **THEN** the app displays the local nsec for backup

#### Scenario: Authentication is denied or the identity changes

- **WHEN** authentication fails or the signing-session revision changes
- **THEN** the app does not reveal a private key

#### Scenario: Member removes the local key

- **WHEN** the member confirms local key removal
- **THEN** the local Keychain entry is removed and browser permissions are cleared
- **AND** the profile-linked key remains unchanged
