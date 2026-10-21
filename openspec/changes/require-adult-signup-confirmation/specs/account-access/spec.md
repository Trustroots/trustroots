## ADDED Requirements

### Requirement: Adult signup confirmation

New members SHALL explicitly confirm they are 18 years old or older using an initially unticked accessible checkbox. The signup API SHALL accept only literal `ageConfirmed: true` and SHALL reject other values with HTTP 400 before creating an account or sending email. Confirmation SHALL NOT be stored, require a birthdate, or affect existing accounts.

#### Scenario: Signup without adult confirmation

- **WHEN** a signup request omits confirmation or supplies a value other than boolean true
- **THEN** the API returns HTTP 400 with "You must confirm that you are 18 years old or older to sign up."
- **AND** no account is created or signup email sent

#### Scenario: Confirmed adult signs up

- **WHEN** a visitor ticks the adult confirmation and submits valid signup details
- **THEN** normal signup succeeds with `ageConfirmed: true` in the request

#### Scenario: Unconfirmed visitor cannot submit

- **WHEN** a visitor has not ticked the adult confirmation
- **THEN** the signup client prevents submission
