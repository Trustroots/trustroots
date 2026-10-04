## ADDED Requirements

### Requirement: Pull request line-change summary

CI SHALL maintain one updated pull request summary comment showing added,
removed and net lines separately for application code, tests and fixtures,
documentation/configuration/other, and generated files/lockfiles. Counts SHALL
compare the current PR head with its merge base and account for renames using
the destination path. Binary files SHALL be reported outside line totals.

Green SHALL indicate reduced application code or increased tests; yellow SHALL
indicate the opposite direction without failing CI. Unchanged and neutral
groups SHALL use white. Labels and signed counts SHALL explain the result
without relying on colour alone.
Reports for fork and older PRs SHALL execute only trusted main-branch tooling;
fetched PR commits SHALL be used solely as diff data.

#### Scenario: Code and test changes

- **WHEN** a PR removes application code and adds tests
- **THEN** its comment shows separate additions, removals and green net counts
- **AND** existing coverage results remain in the comment

#### Scenario: Neutral and opposite changes

- **WHEN** application code grows, tests shrink, or only neutral files change
- **THEN** the table uses yellow for the first two and white for neutral groups
- **AND** these directions do not determine CI success

#### Scenario: Documentation-only PR

- **WHEN** a PR changes only documentation or configuration
- **THEN** CI still provides its line-change table
- **AND** the comment does not claim that skipped coverage suites passed

#### Scenario: Renames and binaries

- **WHEN** a PR renames a file or changes a binary file
- **THEN** renamed line changes use the destination category
- **AND** binary files are counted separately without invented line counts

#### Scenario: Updated PR head

- **WHEN** a new commit is pushed to a PR
- **THEN** CI refreshes the same summary comment for the current PR head

#### Scenario: Backfill older open PRs

- **WHEN** a maintainer dispatches the report with a PR-number upper bound
- **THEN** all open PRs below that number receive updated line-change tables
- **AND** existing coverage content is retained
- **AND** only trusted main-branch report code executes
