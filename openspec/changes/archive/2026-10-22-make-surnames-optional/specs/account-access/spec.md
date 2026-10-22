## ADDED Requirements

### Requirement: Optional surnames

The system SHALL require a first name but SHALL allow an omitted or empty last
name during signup and profile editing. Forms SHALL label the surname optional
and explain that members may use a nickname without sharing a full name.
Display names SHALL join the available name parts without missing-value text or
surrounding whitespace. Existing surnames SHALL remain until a member changes
or clears them.

#### Scenario: Person signs up without a surname

- **WHEN** a person submits otherwise valid signup details without a surname
- **THEN** their account is created with their first name as their display name

#### Scenario: Member clears their surname

- **WHEN** an existing member saves an empty surname
- **THEN** the surname is cleared and their display name uses their first name

#### Scenario: Member retains a surname

- **WHEN** a member with both names saves an unrelated profile change
- **THEN** their existing names are preserved
