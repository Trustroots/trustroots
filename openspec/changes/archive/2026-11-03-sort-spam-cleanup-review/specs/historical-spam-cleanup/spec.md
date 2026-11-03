## ADDED Requirements

### Requirement: Sort the entire cleanup review

Administrators SHALL be able to sort the complete reviewed snapshot by selection, account, creation date, last recorded login, stage and decision in either direction. Sorting SHALL use a deterministic tie-breaker, retain selections and exclusions across pages and SHALL NOT change deletion eligibility or start cleanup.

#### Scenario: Change sort order with exclusions

- **WHEN** an administrator excludes an account from select-all and changes the sort order or page
- **THEN** the exclusion remains in effect across the full preview

#### Scenario: Preview after Stage 1 is exhausted

- **WHEN** a completed preview contains no Stage 1 accounts and has eligible accounts with no recorded login
- **THEN** the interface selects the no-recorded-login stage with no accounts selected and deletion confirmation unchecked

### Requirement: Separate accounts with no recorded login

The cleanup SHALL provide separate stages for old recorded logins, no recorded login and recent recorded logins. Protected accounts SHALL remain excluded. Selecting all accounts in the no-recorded-login stage SHALL NOT select recent logins. Deletion SHALL recheck that the selected accounts still have no recorded login.

#### Scenario: Login recorded after preview

- **WHEN** a selected no-recorded-login account acquires a recorded login before deletion
- **THEN** deletion skips that account

## MODIFIED Requirements

### Requirement: Staged campaign cleanup overview

Administrators SHALL see counts for inactive eligible accounts, eligible accounts with no recorded login, recent eligible accounts needing review, and protected accounts. The inactive stage SHALL require a recorded login before 1 January 2024 UTC and all existing activity protections, including zero threads. Unknown login dates SHALL have their own selectable stage and SHALL NOT be grouped with recent logins. Apply SHALL recheck the cutoff for the inactive stage and require a still-missing login for the no-recorded-login stage. Stage changes SHALL reset selections and confirmation. Scan size SHALL be independent of the review page size.

#### Scenario: Prioritise inactive accounts

- **WHEN** staff review a complete preview
- **THEN** the first non-empty eligible stage is the default (inactive, then no recorded login, then recent login) and its evidence and cutoff are displayed
- **AND** protected accounts cannot be selected

#### Scenario: Activity after preview

- **WHEN** an inactive-stage account has a more recent login before apply
- **THEN** the account is skipped even if the original preview classified it as inactive

#### Scenario: Large scan

- **WHEN** staff preview a large campaign cohort
- **THEN** scanning uses 1,000-account internal chunks, omits review rows while building, and presents 100-row review pages after completion
