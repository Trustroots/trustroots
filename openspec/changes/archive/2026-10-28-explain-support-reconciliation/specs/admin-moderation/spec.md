## ADDED Requirements

### Requirement: Explainable historical support reconciliation

Administrators SHALL preview matching reasons before importing historical statuses. Suggestions SHALL require explicit review and retain identity, one-to-one and concurrent activity safeguards. Reduced files SHALL exclude correspondence and email addresses. Unknown or competing matches SHALL NOT silently apply.

#### Scenario: Reviewing a formatting difference

- **WHEN** original sender and category agree, submission times are nearby and conservatively normalised messages agree
- **THEN** an administrator sees a suggested match with its evidence and must select it before apply

#### Scenario: Unconfirmed historical status

- **WHEN** a request has no stored status
- **THEN** the inbox identifies it as unconfirmed legacy status and offers a filter and count distinct from confirmed Open while retaining unresolved queue access

## MODIFIED Requirements

### Requirement: Conservative historical support status import

Administrators SHALL import statuses using unique original fingerprints or explicitly reviewed one-to-one suggestions. Suggestions SHALL require original sender/category, nearby submission times and equivalent normalised messages. Imports SHALL be idempotent, preserve ticket IDs, send no email and grant no investigation access. Logs SHALL exclude correspondence, search text, secrets and payloads.

#### Scenario: Administrator previews historical statuses

- **WHEN** an administrator uploads a reduced manifest
- **THEN** the preview reports exact changes, suggested changes with reasons, and skipped outcomes without applying them
- **AND** support volunteers cannot access import endpoints

#### Scenario: Import is repeated or a request changes after preview

- **WHEN** an administrator applies a reviewed manifest
- **THEN** unchanged exact matches and explicitly selected one-to-one suggestions are updated once and changed or conflicting matches are skipped without sending mail
- **AND** unselected suggestions, unresolved competing matches and requests with newer local activity remain unchanged
