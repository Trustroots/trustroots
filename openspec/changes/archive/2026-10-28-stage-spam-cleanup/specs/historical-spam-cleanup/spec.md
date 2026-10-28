## ADDED Requirements

### Requirement: Staged campaign cleanup overview

Administrators SHALL see counts for inactive eligible accounts, other eligible accounts needing review, and protected accounts. The inactive stage SHALL require a recorded login before 1 January 2024 UTC and all existing activity protections, including zero threads. Unknown login dates SHALL remain in the review stage. Apply SHALL recheck the cutoff for the inactive stage. Stage changes SHALL reset selections and confirmation. Scan size SHALL be independent of the review page size.

#### Scenario: Prioritise inactive accounts

- **WHEN** staff review a complete preview
- **THEN** the inactive stage is the default and its evidence and cutoff are displayed
- **AND** protected accounts cannot be selected

#### Scenario: Activity after preview

- **WHEN** an inactive-stage account has a more recent login before apply
- **THEN** the account is skipped even if the original preview classified it as inactive

#### Scenario: Large scan

- **WHEN** staff preview a large campaign cohort
- **THEN** scanning uses 1,000-account internal chunks, omits review rows while building, and presents 100-row review pages after completion
