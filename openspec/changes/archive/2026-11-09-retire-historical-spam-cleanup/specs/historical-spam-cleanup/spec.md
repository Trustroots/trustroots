## ADDED Requirements

### Requirement: Historical spam cleanup is retired

The system SHALL no longer expose the historical spam cleanup page, API or maintenance command. Administrator member searches SHALL display every member returned by the search API.

#### Scenario: Administrator looks for the retired cleanup tools

- **WHEN** an administrator opens the dashboard
- **THEN** the administration navigation omits the historical spam cleanup link
- **AND** the former cleanup page and API routes are unavailable

#### Scenario: Administrator searches for members

- **WHEN** an administrator submits a member search
- **THEN** the results include suspended members returned by the API

## REMOVED Requirements

### Requirement: Historical spam campaign cleanup

**Reason**: The historical campaign cleanup is complete.
**Migration**: None.

### Requirement: Explicit historical spam deletion

**Reason**: The historical campaign cleanup is complete.
**Migration**: None.

### Requirement: Administrator cleanup review

**Reason**: The historical campaign cleanup is complete.
**Migration**: None.

### Requirement: Staged campaign cleanup overview

**Reason**: The historical campaign cleanup is complete.
**Migration**: None.

### Requirement: Sort the entire cleanup review

**Reason**: The historical campaign cleanup is complete.
**Migration**: None.

### Requirement: Separate accounts with no recorded login

**Reason**: The historical campaign cleanup is complete.
**Migration**: None.
