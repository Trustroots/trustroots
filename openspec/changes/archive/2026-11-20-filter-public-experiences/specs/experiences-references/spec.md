## ADDED Requirements

### Requirement: Browsing public Experiences on member profiles

The public Experience list SHALL support filtering by recorded interaction
and recommendation and ordering by date.

#### Scenario: A member narrows a public list

- **WHEN** a visitor selects interaction or recommendation filters
- **THEN** the list shows primary Experiences matching every selected filter and retains their attached replies
- **AND** a missing interaction or recommendation is excluded from matching an affirmative category
- **AND** the visitor can set newest or oldest first
- **AND** the public summary and owner's reply section are unaffected

#### Scenario: A member uses a public Experience tag as a filter

- **WHEN** a visitor activates a primary tag in the public list
- **THEN** it toggles the corresponding filter and the result count updates
- **AND** tags on attached replies and cards outside the filtered list remain labels
