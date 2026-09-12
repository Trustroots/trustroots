## ADDED Requirements

### Requirement: New username policy preserves existing identities

New signups and username changes SHALL accept only 3–34 lowercase ASCII letters and digits with at least one letter, excluding reserved names. Existing usernames SHALL remain usable for authentication, lookups and unrelated profile updates.

#### Scenario: A member selects a new username

- **WHEN** a signup or username change uses punctuation, uppercase letters, only digits or a reserved name
- **THEN** the request is rejected with a validation message

#### Scenario: An existing member retains a legacy username

- **WHEN** a member with punctuation in their existing username signs in and updates their profile without changing that username
- **THEN** authentication and the update succeed

### Requirement: Member names retain ordinary punctuation

Signup and profile updates SHALL accept straight and curly apostrophes alongside supported international letters, combining marks, spaces, full stops, underscores, hyphens and emoji decoration. Names SHALL contain a letter and remain subject to the existing length and spam restrictions.

#### Scenario: An apostrophe is part of a member name

- **WHEN** a member signs up or updates their name using a straight or curly apostrophe
- **THEN** the name is accepted and preserved
