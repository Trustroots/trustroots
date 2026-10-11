## ADDED Requirements

### Requirement: Pull request dependency summary

The automated pull request overview SHALL show added, removed, changed and net counts for direct runtime dependencies, direct development dependencies and resolved lockfile entries alongside line changes. It SHALL compare the PR merge base with its head, retain coverage content when refreshed, and list changed dependency declarations and resolved versions. Trusted reporting code SHALL parse manifests and lockfiles as data without executing PR code. Reports SHALL explain that lockfile entries count installed paths, including duplicates, and do not measure production-image pruning.

#### Scenario: Dependency removal and version update

- **WHEN** a PR removes a direct dependency and updates a resolved version
- **THEN** the overview reports the removal and update separately
- **AND** it lists the affected dependency names and before/after values

#### Scenario: Manifest or lockfile is absent

- **WHEN** a compared commit lacks a manifest or lockfile
- **THEN** its dependency inventory is empty for that file
- **AND** added or removed entries remain visible

#### Scenario: Refresh and merge-base comparison

- **WHEN** the overview is refreshed after the base branch advances
- **THEN** it compares against the merge base without counting unrelated base work
- **AND** the same comment contains one dependency summary and retains coverage content

### Requirement: Production image dependency inventory

The production image job SHALL inventory application npm packages from the built image after pruning. The overview SHALL show installed-path and unique name/version counts and provide a complete inventory artifact. It SHALL explicitly report an unavailable inventory when the image job is skipped or fails, and SHALL NOT infer installed packages from the source lockfile or claim an image-to-image delta without a baseline image inventory.

#### Scenario: Image built successfully

- **WHEN** the production image is built
- **THEN** CI collects package metadata from its actual application node_modules directory
- **AND** the overview shows installed and unique package counts with a downloadable inventory

#### Scenario: Image inventory unavailable

- **WHEN** the image is not built or its inventory cannot be collected
- **THEN** the overview states that its installed inventory is unavailable
- **AND** lockfile counts remain labelled separately
