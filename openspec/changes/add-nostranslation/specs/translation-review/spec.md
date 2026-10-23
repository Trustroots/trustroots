## ADDED Requirements

### Requirement: AI drafts require human review

The translation tool SHALL generate missing or source-changed translations for
existing configured target languages, preserving published human translations.
Drafts SHALL record source text, original translation, model and source revision.
Only explicitly reviewed strings SHALL be submitted for publication.

#### Scenario: English changes after review

- **WHEN** the English text or target translation changes before submission
- **THEN** the conflicting review SHALL be rejected for renewed proofreading
- **AND** unrelated edits SHALL remain available

#### Scenario: Source changes while a PR awaits merge

- **WHEN** a PR's review fingerprints no longer match its merged English source
- **THEN** CI SHALL reject stale approvals pending renewed proofreading

### Requirement: Accepted human corrections guide generation

The tool SHALL allow contributors to propose improvements to published
translations as well as AI drafts. Editing SHALL clear previous approval.
Merged, current human corrections SHALL be supplied as language-specific
examples to subsequent generation requests, prioritising recent corrections
from the same section. Pending, stale or externally superseded review records
SHALL NOT be treated as accepted feedback. This feedback SHALL use prompt
context rather than requiring model training.

#### Scenario: A contributor improves wording

- **WHEN** the contributor's corrected translation is reviewed and merged
- **THEN** subsequent AI requests for that language SHALL use the correction
  as preferred terminology when relevant

### Requirement: Trustroots Nostr identity

Submission SHALL require a valid body-bound NIP-98 signature from a NIP-07 or
NIP-46 signer matching the submitted username at Trustroots' public NIP-05
endpoint. Keys and credentials SHALL remain outside the published frontend.

#### Scenario: A contributor signs with another key

- **WHEN** the submitted identity resolves to a different key
- **THEN** submission SHALL fail without writing to GitHub

### Requirement: Reviewed Git contribution

The service SHALL validate locale paths, plural forms, interpolation and markup,
then create one draft PR per reviewed batch with contributor attribution.
Retries SHALL recover the same PR, and all publication SHALL use normal CI and
maintainer merge controls. The frontend SHALL support local draft recovery,
search, missing-string filtering and mobile proofreading.

#### Scenario: A contributor compares and corrects translations

- **WHEN** the contributor opens the proofreading queue or batch review
- **THEN** a semantic table SHALL align English source, published translation,
  editable proposed translation and labelled review status/actions in columns
- **AND** table headers SHALL remain visible while scrolling through strings
- **AND** small screens SHALL support horizontal table scrolling without page overflow

#### Scenario: GitHub returns an uncertain submission outcome

- **WHEN** the contributor retries a previously submitted batch
- **THEN** the service SHALL recover its existing branch and PR without duplicates

### Requirement: Staged Weblate replacement

The team site SHALL host the frontend under `/nostranslation/`. Weblate SHALL
remain connected until a real reviewed translation has reached production
through the replacement workflow.

#### Scenario: Replacement has not passed production acceptance

- **WHEN** the translation tool is built or deployed for testing
- **THEN** existing Weblate access and workflows SHALL remain available
