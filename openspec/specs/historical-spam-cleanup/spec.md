# historical-spam-cleanup Specification

## Purpose

Define conservative removal of inactive accounts from investigated historical signup campaigns through the maintenance command and reviewed administrator batches.

## Requirements

### Requirement: Historical spam campaign cleanup

The system SHALL identify an account for removal only when it was created in a
configured historical automated-signup campaign window, is non-public, carries
only `user` and `suspended` roles, and has no member, moderation, or uploaded
profile activity.

#### Scenario: Eligible campaign account is selected

- **WHEN** an account belongs to a configured campaign window and has no
  protected activity
- **THEN** the cleanup command includes it in its eligible count

#### Scenario: Manually suspended account is retained

- **WHEN** an account has an AdminNote recording a manual moderation action
- **THEN** the cleanup command does not select it, even if it was created in a
  campaign window

#### Scenario: Account outside a campaign window is retained

- **WHEN** a suspended account was created outside every configured campaign
  window
- **THEN** the cleanup command does not select it

#### Scenario: Account with protected activity is retained

- **WHEN** an account has a message, thread, contact, offer, experience,
  reference, membership, block, push registration, or uploaded profile image
- **THEN** the cleanup command does not select it

### Requirement: Explicit historical spam deletion

The system SHALL report the eligible historical spam-account count without
writing by default, and SHALL delete eligible accounts only when an operator
explicitly enables deletion.

#### Scenario: Operator runs a dry-run

- **WHEN** an operator runs the cleanup command without the deletion switch
- **THEN** the system reports the eligible count and deletes no accounts

#### Scenario: Operator enables deletion

- **WHEN** an operator runs the cleanup command with the deletion switch
- **THEN** the system deletes eligible accounts in bounded batches and reports
  the number deleted

### Requirement: Administrator cleanup review

Only administrators SHALL preview and explicitly delete historical spam accounts through the admin interface. Previews SHALL be bounded to 100 accounts, expire and bind reviewed IDs to their administrator. Apply SHALL recheck campaign eligibility and protected activity, preserve the existing CLI, and audit identifiers and counts without personal content. Cleanup SHALL never start automatically.

#### Scenario: Reviewed cleanup

- **WHEN** an administrator reviews a batch and explicitly confirms deletion
- **THEN** only eligible accounts from that reviewed batch are deleted after rechecking protection rules

#### Scenario: Stale or unauthorised cleanup

- **WHEN** a preview expired or another actor attempts to apply it
- **THEN** no accounts are deleted
