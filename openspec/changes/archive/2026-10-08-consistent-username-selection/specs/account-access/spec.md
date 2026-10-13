## MODIFIED Requirements

### Requirement: Service usernames remain reserved

New accounts and username changes SHALL reject configured reserved names. Existing members SHALL retain unchanged reserved usernames when saving unrelated profile changes and using identity lookups.

#### Scenario: A new member selects a reserved service name

- **WHEN** a signup or username change selects a configured reserved name
- **THEN** the request is rejected without changing the stored identity

#### Scenario: An existing member retains a newly reserved name

- **WHEN** a member saves an unrelated profile change without changing their reserved username
- **THEN** the save succeeds and the username remains unchanged

## ADDED Requirements

### Requirement: Username selection is consistent and type safe

Signup, signup availability checks, profile username changes and model validation for new or changed usernames SHALL require 3–34 ASCII letters and digits including at least one letter. Uppercase input SHALL be accepted and stored lowercase. Explicitly supplied non-string usernames SHALL be rejected by the APIs before coercion. Profile updates MAY omit the username.

#### Scenario: A person selects a username

- **WHEN** a new username contains punctuation, only digits, or an invalid length
- **THEN** signup, availability checks and username changes reject it with validation feedback

#### Scenario: A person selects uppercase letters

- **WHEN** an otherwise valid new username contains uppercase letters
- **THEN** it is accepted and stored lowercase

#### Scenario: An API caller supplies a non-string username

- **WHEN** signup, signup availability or a profile update supplies a null, boolean, number, array or object username
- **THEN** it returns HTTP 400 without changing the stored identity or username-change timestamp

### Requirement: Existing username identities remain compatible

Unchanged existing usernames, including underscores, hyphens, dots, digits-only names and reserved names, SHALL remain usable for sign-in, profile lookup, NIP-05 lookup and unrelated saves. NIP-05 SHALL retain existing member visibility restrictions. Model validation SHALL enforce selection policy for new and changed usernames without revalidating unchanged identities.

#### Scenario: A member retains an existing identity

- **WHEN** an existing member signs in, resolves their visible profile or NIP-05 identity, or saves an unrelated change
- **THEN** their existing username remains usable without being renamed

#### Scenario: A member resubmits their normalised username

- **WHEN** a profile update supplies the same username after trimming and lowercasing
- **THEN** the update succeeds without applying the change cooldown or changing its timestamp

#### Scenario: A member changes their username

- **WHEN** a member selects a different valid username
- **THEN** the existing three-month cooldown applies and a successful change records the change timestamp
