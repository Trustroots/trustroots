## MODIFIED Requirements

### Requirement: Administrator cleanup review

Only administrators SHALL preview and explicitly delete historical spam accounts through the admin interface. Previews SHALL cover all matching accounts using bounded internal processing and chunked storage, expire and bind reviewed IDs to their administrator. Administrators SHALL select all eligible accounts or individual accounts and deselect exceptions across pages. One explicit apply SHALL process the selected snapshot incrementally, rechecking eligibility and protected activity. Audit logs SHALL contain identifiers and counts without personal content. Cleanup SHALL never start automatically.

#### Scenario: Select all with exceptions

- **WHEN** an administrator selects all eligible accounts and deselects an account on any page
- **THEN** the selected count reflects the full preview and apply leaves deselected accounts unchanged

#### Scenario: Large cleanup

- **WHEN** the preview contains more than 100 accounts
- **THEN** one confirmed operation processes all selected accounts in bounded internal batches and reports progress

#### Scenario: Stale or unauthorised cleanup

- **WHEN** a preview expired or another actor attempts to apply it
- **THEN** no accounts are deleted

#### Scenario: Reviewed cleanup

- **WHEN** an administrator reviews a preview and explicitly confirms deletion
- **THEN** only selected eligible accounts from that reviewed preview are deleted after rechecking protection rules
