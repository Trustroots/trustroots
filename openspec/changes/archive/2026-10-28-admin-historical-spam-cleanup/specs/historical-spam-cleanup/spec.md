## ADDED Requirements

### Requirement: Administrator cleanup review

Only administrators SHALL preview and explicitly delete historical spam accounts through the admin interface. Previews SHALL be bounded to 100 accounts, expire and bind reviewed IDs to their administrator. Apply SHALL recheck campaign eligibility and protected activity, preserve the existing CLI, and audit identifiers and counts without personal content. Cleanup SHALL never start automatically.

#### Scenario: Reviewed cleanup

- **WHEN** an administrator reviews a batch and explicitly confirms deletion
- **THEN** only eligible accounts from that reviewed batch are deleted after rechecking protection rules

#### Scenario: Stale or unauthorised cleanup

- **WHEN** a preview expired or another actor attempts to apply it
- **THEN** no accounts are deleted
