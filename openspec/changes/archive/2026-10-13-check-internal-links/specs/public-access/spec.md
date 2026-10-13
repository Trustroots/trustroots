## MODIFIED Requirements

### Requirement: FAQ category filtering

FAQ search SHALL match a case-insensitive phrase in questions and answers across
every category and label the matching category. Clearing the search SHALL restore
the selected category.

#### Scenario: Visitor filters FAQ questions

- **WHEN** a visitor searches from any FAQ category
- **THEN** matching questions and answers from all categories are shown
- **AND** each result group identifies its category

#### Scenario: Visitor clears the FAQ filter

- **WHEN** a visitor clears the FAQ search
- **THEN** the selected category's questions are restored

#### Scenario: No FAQ question matches

- **WHEN** the phrase matches no question or answer in any category
- **THEN** an empty-results message is shown

## ADDED Requirements

### Requirement: Internal navigation link validation

CI SHALL reject literal internal client links to unknown application routes or
missing fragment targets. The check SHALL report the source file and destination
and SHALL run without contacting external websites.

#### Scenario: A stale route is introduced

- **WHEN** a literal internal client link points to an unknown route
- **THEN** the internal link check fails and identifies the link

#### Scenario: A fragment target is removed

- **WHEN** a literal internal client link references a missing fragment target
- **THEN** the internal link check fails and identifies the link

### Requirement: Account removal navigation

The removal FAQ SHALL link to the focused account removal section, which SHALL
explain confirmation and permanence and provide a link back to the FAQ answer.
Sign-in redirects SHALL preserve the removal fragment.

#### Scenario: Member follows the account removal FAQ

- **WHEN** a signed-in member follows the account link in the removal FAQ
- **THEN** the account removal section is brought into view and receives focus
- **AND** it explains the confirmation email and permanent deletion steps
- **AND** it links back to the same FAQ answer

#### Scenario: Visitor needs to sign in

- **WHEN** a visitor follows the removal link without being signed in
- **THEN** the sign-in destination retains the removal fragment in its return URL
